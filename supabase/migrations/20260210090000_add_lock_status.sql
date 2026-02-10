-- Add is_locked column to instructors table to track account status
ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Update existing admins who are banned in auth (optional, but good for sync)
-- Note: This is a direct query, but since we can't easily join auth.users here, 
-- we leave it to the toggle function to sync on first use.
