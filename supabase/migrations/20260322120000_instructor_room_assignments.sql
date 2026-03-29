-- migrations/20260322120000_instructor_room_assignments.sql

-- Add assigned_room_ids to instructors table
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS assigned_room_ids UUID[] DEFAULT '{}';

-- Index for better performance when filtering by room
CREATE INDEX IF NOT EXISTS idx_instructors_assigned_room_ids ON instructors USING GIN (assigned_room_ids);

-- Add a comment for documentation
COMMENT ON COLUMN instructors.assigned_room_ids IS 'List of room IDs an instructor has access to control IoT devices in.';
