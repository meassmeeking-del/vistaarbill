CREATE OR REPLACE FUNCTION public.preview_plan_coupon(p_plan_id uuid, p_coupon_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_plan public.subscription_plans%ROWTYPE;
  v_coupon public.coupons%ROWTYPE;
  v_code text := upper(trim(coalesce(p_coupon_code, '')));
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan nahi mila'; END IF;
  IF v_code = '' THEN RAISE EXCEPTION 'Coupon code daalein'; END IF;
  SELECT * INTO v_coupon FROM public.coupons WHERE upper(code) = v_code AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coupon code valid nahi hai'; END IF;
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN RAISE EXCEPTION 'Coupon expire ho gaya'; END IF;
  IF v_coupon.max_uses IS NOT NULL AND (
    SELECT count(*) FROM public.coupon_redemptions WHERE coupon_id = v_coupon.id
  ) >= v_coupon.max_uses THEN RAISE EXCEPTION 'Coupon ki usage limit poori ho gayi'; END IF;
  IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE coupon_id = v_coupon.id AND user_id = v_user) THEN
    RAISE EXCEPTION 'Aap ye coupon pehle use kar chuke hain';
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'price', v_plan.price,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value
  );
END;
$$;
REVOKE ALL ON FUNCTION public.preview_plan_coupon(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_plan_coupon(uuid, text) TO authenticated;