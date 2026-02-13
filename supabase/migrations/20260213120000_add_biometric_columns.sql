-- Add biometric columns to students table

-- Fingerprint Slot ID (Must be unique per student)
-- Allows linking a specific hardware slot (1-127) to a student UUID
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS fingerprint_slot_id INTEGER UNIQUE;

-- Device ID (string)
-- Tracks which device the fingerprint is stored on (e.g., "ESP32-LCD7-01")
-- Useful if multiple devices are used in the future
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Index for faster lookups during attendance
CREATE INDEX IF NOT EXISTS idx_students_fingerprint_slot_id ON students(fingerprint_slot_id);
