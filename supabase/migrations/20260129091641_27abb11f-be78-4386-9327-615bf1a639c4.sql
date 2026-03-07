-- Add anleitung_completed column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS anleitung_completed BOOLEAN DEFAULT false;