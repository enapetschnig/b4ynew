-- 1. Add address_form column to contacts table
ALTER TABLE public.contacts 
ADD COLUMN address_form TEXT CHECK (address_form IN ('du', 'sie'));

-- 2. Add preferred_model column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN preferred_model TEXT DEFAULT 'gemini' CHECK (preferred_model IN ('gemini', 'openai'));

-- 3. Create prompts table for versioned prompt management
CREATE TABLE public.prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name, version)
);

-- Enable RLS on prompts table
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

-- RLS policies for prompts table
CREATE POLICY "Users can view their own prompts"
ON public.prompts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create prompts"
ON public.prompts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prompts"
ON public.prompts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prompts"
ON public.prompts
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at on prompts (reusing existing function)
CREATE TRIGGER update_prompts_updated_at
BEFORE UPDATE ON public.prompts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();