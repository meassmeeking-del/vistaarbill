
CREATE POLICY "Anyone authenticated can view qr-codes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'qr-codes');

CREATE POLICY "Admins can upload qr-codes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'qr-codes' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update qr-codes"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'qr-codes' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete qr-codes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'qr-codes' AND public.has_role(auth.uid(), 'admin'::app_role));
