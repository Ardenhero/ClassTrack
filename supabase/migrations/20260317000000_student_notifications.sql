-- Add student_id and type to notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS student_id BIGINT REFERENCES students(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info';

-- Create index for student_id
CREATE INDEX IF NOT EXISTS idx_notifications_student_id ON notifications(student_id);

-- Update RLS for students to see their own notifications
-- Assuming we'll have a student portal auth context soon
-- For now, let's make sure students can read notifications where student_id matches theirs once they are logged in via their system.

-- If current_user is authenticated but not an instructor, they might be a student
-- However student portal uses a custom session, so we might need service role for fetching anyway as seen in api/notifications/poll.
