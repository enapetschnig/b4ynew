-- Add n8n webhook and smtp_from_email columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS smtp_from_email TEXT;
