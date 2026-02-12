-- Fix DELETE constraints for attendance_logs to allow cascading deletion
-- This allows deleting a Student or Class even if they have attendance records

-- 1. Drop existing constraints
ALTER TABLE attendance_logs
DROP CONSTRAINT IF EXISTS attendance_logs_student_id_fkey,
DROP CONSTRAINT IF EXISTS attendance_logs_class_id_fkey;

-- 2. Re-add constraints with ON DELETE CASCADE
ALTER TABLE attendance_logs
ADD CONSTRAINT attendance_logs_student_id_fkey
FOREIGN KEY (student_id) REFERENCES students(id)
ON DELETE CASCADE;

ALTER TABLE attendance_logs
ADD CONSTRAINT attendance_logs_class_id_fkey
FOREIGN KEY (class_id) REFERENCES classes(id)
ON DELETE CASCADE;
