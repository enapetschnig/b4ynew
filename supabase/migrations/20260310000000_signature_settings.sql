-- Add WhatsApp signature and message settings
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_signature text DEFAULT null;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS use_email_signature boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS use_whatsapp_signature boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_include_subject boolean DEFAULT false;
