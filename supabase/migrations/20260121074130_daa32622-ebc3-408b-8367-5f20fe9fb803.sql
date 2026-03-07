-- Add reply_to_email field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN reply_to_email text;