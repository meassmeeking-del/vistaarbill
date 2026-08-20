CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'monthly',
  price numeric NOT NULL DEFAULT 0,
  days integer NOT NULL DEFAULT 30,
  description text,
  badge text,
  is_combo boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
  FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.subscription_requests
  ADD COLUMN plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN plan_label text,
  ADD COLUMN days integer;

INSERT INTO public.subscription_plans (name, kind, price, days, description, badge, is_combo, sort_order) VALUES
  ('Trial', 'trial', 1, 7, '7 din full access — sirf ₹1', 'Try it!', false, 1),
  ('Monthly', 'monthly', 99, 30, '1 mahine ka full access', 'Popular', false, 2),
  ('Yearly', 'yearly', 999, 365, 'Poora saal — 2 mahine free', 'Best value', false, 3),
  ('Combo (Yearly + Support)', 'combo', 1299, 365, 'Yearly plan + priority support + free setup', 'Combo', true, 4);