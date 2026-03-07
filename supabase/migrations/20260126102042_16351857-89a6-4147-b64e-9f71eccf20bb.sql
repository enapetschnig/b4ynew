-- Create storage bucket for WhatsApp media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media', 
  'whatsapp-media', 
  false,
  16777216, -- 16MB limit (WhatsApp limit)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']
);

-- Policy: Users can upload their own media
CREATE POLICY "Users can upload their own media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own media
CREATE POLICY "Users can view their own media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'whatsapp-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own media
CREATE POLICY "Users can delete their own media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'whatsapp-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);