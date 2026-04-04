-- Add missing 'read' column to notifications table
-- This column is required by the student portal and instructor dashboard
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "read" BOOLEAN DEFAULT FALSE;

-- Ensure an index exists for performance when filtering unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications("read") WHERE "read" = false;
