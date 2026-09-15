CREATE TABLE public.pos_data (
  user_id uuid PRIMARY KEY,
  products jsonb NOT NULL DEFAULT '[]'::jsonb,
  sales jsonb NOT NULL DEFAULT '[]'::jsonb,
  shop jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_data TO authenticated;
GRANT ALL ON public.pos_data TO service_role;

ALTER TABLE public.pos_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own POS data"
  ON public.pos_data
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own POS data"
  ON public.pos_data
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own POS data"
  ON public.pos_data
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own POS data"
  ON public.pos_data
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);