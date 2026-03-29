-- Add metadata column to notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Ensure the student_id column exists from previous task
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS student_id BIGINT REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info';
