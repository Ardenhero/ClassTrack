-- Add image_url to instructors table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'image_url') THEN
        ALTER TABLE instructors ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Ensure profile-photos bucket exists (This is often handled via Supabase dashboard, 
-- but we can attempt to document it or use a SQL snippet if the environment supports storage extensions)
-- Note: Storage buckets are usually managed via the 'storage' schema.

-- Example of ensuring bucket exists via SQL (requires storage extension)
INSERT INTO storage.buckets (id, name, public)
SELECT 'profile-photos', 'profile-photos', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'profile-photos'
);

-- Policies for profile-photos bucket
-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');

-- Allow authenticated upload/update/delete
CREATE POLICY "Authenticated Manage" ON storage.objects FOR ALL TO authenticated 
USING (bucket_id = 'profile-photos')
WITH CHECK (bucket_id = 'profile-photos');
