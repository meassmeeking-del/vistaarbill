ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS trial_qr_image_url text,
  ADD COLUMN IF NOT EXISTS subscription_qr_image_url text;

UPDATE public.app_settings
SET trial_qr_image_url = COALESCE(trial_qr_image_url, qr_image_url),
    subscription_qr_image_url = COALESCE(subscription_qr_image_url, qr_image_url)
WHERE id = true;