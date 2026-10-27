CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0 AND (discount_type <> 'percent' OR discount_value <= 100)),
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupons_code_normalized_unique UNIQUE (code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER coupons_set_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  subscription_request_id uuid REFERENCES public.subscription_requests(id) ON DELETE SET NULL,
  discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_amount numeric NOT NULL DEFAULT 0 CHECK (final_amount >= 0),
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupon_redemptions_coupon_user_unique UNIQUE (coupon_id, user_id)
);
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own coupon redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

ALTER TABLE public.subscription_requests
  ADD COLUMN coupon_code text,
  ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.create_subscription_request_with_coupon(
  p_plan_id uuid,
  p_legacy_plan public.subscription_plan,
  p_utr text,
  p_note text,
  p_coupon_code text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_plan public.subscription_plans%ROWTYPE;
  v_settings public.app_settings%ROWTYPE;
  v_coupon public.coupons%ROWTYPE;
  v_request public.subscription_requests%ROWTYPE;
  v_base numeric;
  v_amount numeric;
  v_discount numeric := 0;
  v_days integer;
  v_kind text;
  v_label text;
  v_coupon_code text := nullif(upper(trim(p_coupon_code)), '');
  v_legacy public.subscription_plan;
  v_existing boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id AND active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Plan nahi mila'; END IF;
    v_base := v_plan.price;
    v_days := v_plan.days;
    v_kind := v_plan.kind;
    v_label := v_plan.name;
  ELSE
    SELECT * INTO v_settings FROM public.app_settings WHERE id = true;
    v_kind := coalesce(p_legacy_plan::text, 'monthly');
    v_base := CASE WHEN v_kind = 'trial' THEN coalesce(v_settings.trial_price, 1) ELSE coalesce(v_settings.monthly_price, 99) END;
    v_days := CASE WHEN v_kind = 'trial' THEN coalesce(v_settings.trial_days, 7) ELSE coalesce(v_settings.monthly_days, 30) END;
    v_label := CASE WHEN v_kind = 'trial' THEN 'Trial' ELSE 'Monthly' END;
  END IF;
  IF v_base < 0 OR v_days < 1 THEN RAISE EXCEPTION 'Invalid plan'; END IF;
  v_legacy := CASE WHEN v_kind = 'trial' OR v_kind = 'free' THEN 'trial'::public.subscription_plan ELSE 'monthly'::public.subscription_plan END;

  SELECT EXISTS (
    SELECT 1 FROM public.subscription_requests
    WHERE user_id = v_user AND status = 'pending'::public.subscription_status
  ) INTO v_existing;
  IF v_existing THEN RAISE EXCEPTION 'Pehle se ek request pending hai — admin approval ka wait karein'; END IF;
  IF v_kind = 'trial' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.subscription_requests
      WHERE user_id = v_user AND plan = 'trial'::public.subscription_plan
        AND status IN ('approved'::public.subscription_status, 'pending'::public.subscription_status)
    ) INTO v_existing;
    IF v_existing THEN RAISE EXCEPTION 'Trial pehle hi le chuke hain — paid plan chunein'; END IF;
  END IF;

  IF v_coupon_code IS NOT NULL THEN
    SELECT * INTO v_coupon FROM public.coupons WHERE upper(code) = v_coupon_code AND active = true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Coupon code valid nahi hai'; END IF;
    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN RAISE EXCEPTION 'Coupon expire ho gaya'; END IF;
    IF v_coupon.max_uses IS NOT NULL AND (
      SELECT count(*) FROM public.coupon_redemptions WHERE coupon_id = v_coupon.id
    ) >= v_coupon.max_uses THEN RAISE EXCEPTION 'Coupon ki usage limit poori ho gayi'; END IF;
    IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE coupon_id = v_coupon.id AND user_id = v_user) THEN
      RAISE EXCEPTION 'Aap ye coupon pehle use kar chuke hain';
    END IF;
    v_discount := CASE WHEN v_coupon.discount_type = 'percent'
      THEN round(v_base * v_coupon.discount_value / 100, 2)
      ELSE least(v_base, v_coupon.discount_value) END;
  END IF;
  v_amount := greatest(0, v_base - v_discount);
  IF v_amount > 0 AND length(trim(coalesce(p_utr, ''))) < 4 THEN RAISE EXCEPTION 'UTR/Reference number bahut chhota hai'; END IF;

  INSERT INTO public.subscription_requests (
    user_id, plan, amount, utr, note, status, approved_at, expires_at,
    plan_id, plan_label, days, coupon_code, discount_amount
  ) VALUES (
    v_user, v_legacy, v_amount,
    CASE WHEN v_amount = 0 THEN 'COUPON-FREE' ELSE trim(p_utr) END,
    nullif(trim(coalesce(p_note, '')), ''),
    CASE WHEN v_amount = 0 THEN 'approved'::public.subscription_status ELSE 'pending'::public.subscription_status END,
    CASE WHEN v_amount = 0 THEN now() ELSE NULL END,
    CASE WHEN v_amount = 0 THEN now() + make_interval(days => v_days) ELSE NULL END,
    p_plan_id, v_label, v_days, v_coupon_code, v_discount
  ) RETURNING * INTO v_request;

  IF v_coupon_code IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, subscription_request_id, discount_amount, final_amount)
    VALUES (v_coupon.id, v_user, v_request.id, v_discount, v_amount);
  END IF;
  RETURN to_jsonb(v_request);
END;
$$;
REVOKE ALL ON FUNCTION public.create_subscription_request_with_coupon(uuid, public.subscription_plan, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_subscription_request_with_coupon(uuid, public.subscription_plan, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_free_plan()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_request public.subscription_requests%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  PERFORM 1 FROM auth.users WHERE id = v_user FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.subscription_requests
    WHERE user_id = v_user AND utr = 'FREE_PLAN' AND status = 'approved'::public.subscription_status
  ) THEN RAISE EXCEPTION 'Aapka free plan pehle hi activate ho chuka hai'; END IF;
  INSERT INTO public.subscription_requests (
    user_id, plan, amount, utr, status, approved_at, expires_at, plan_label, days, discount_amount
  ) VALUES (
    v_user, 'trial'::public.subscription_plan, 0, 'FREE_PLAN', 'approved'::public.subscription_status,
    now(), now() + interval '7 days', 'Free plan', 7, 0
  ) RETURNING * INTO v_request;
  RETURN to_jsonb(v_request);
END;
$$;
REVOKE ALL ON FUNCTION public.activate_free_plan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_free_plan() TO authenticated;