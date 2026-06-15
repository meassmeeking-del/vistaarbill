
-- ============ app_settings ============
CREATE TABLE public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  upi_id text,
  qr_image_url text,
  trial_price numeric NOT NULL DEFAULT 1,
  monthly_price numeric NOT NULL DEFAULT 99,
  trial_days integer NOT NULL DEFAULT 7,
  monthly_days integer NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
GRANT UPDATE, INSERT ON public.app_settings TO authenticated;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view app settings"
  ON public.app_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ============ subscription_requests ============
CREATE TYPE public.subscription_plan AS ENUM ('trial', 'monthly');
CREATE TYPE public.subscription_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL,
  amount numeric NOT NULL,
  utr text NOT NULL,
  note text,
  status public.subscription_status NOT NULL DEFAULT 'pending',
  reject_reason text,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_req_user ON public.subscription_requests(user_id, created_at DESC);
CREATE INDEX idx_sub_req_status ON public.subscription_requests(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.subscription_requests TO authenticated;
GRANT ALL ON public.subscription_requests TO service_role;

ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own requests"
  ON public.subscription_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own requests"
  ON public.subscription_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins update any request"
  ON public.subscription_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_sub_req_updated
  BEFORE UPDATE ON public.subscription_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ has_active_subscription ============
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscription_requests
    WHERE user_id = _user_id
      AND status = 'approved'
      AND expires_at IS NOT NULL
      AND expires_at > now()
  );
$$;

-- ============ Seed admin's own subscription so they never get locked ============
INSERT INTO public.subscription_requests (user_id, plan, amount, utr, status, approved_at, expires_at)
SELECT u.id, 'monthly'::public.subscription_plan, 0, 'ADMIN_AUTO',
       'approved'::public.subscription_status, now(), now() + interval '100 years'
FROM auth.users u
WHERE u.email = 'rajpandey565758@gmail.com'
ON CONFLICT DO NOTHING;
