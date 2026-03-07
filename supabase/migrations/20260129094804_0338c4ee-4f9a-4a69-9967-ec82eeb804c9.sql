-- Add whapi_token column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whapi_token TEXT;

-- Admin role will be auto-assigned via on_auth_user_created_role trigger