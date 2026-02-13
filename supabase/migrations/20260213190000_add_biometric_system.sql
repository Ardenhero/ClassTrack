-- Add fingerprint_slot_id and device_id to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS fingerprint_slot_id INTEGER;
ALTER TABLE students ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Add entry_method to attendance_logs table
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS entry_method TEXT DEFAULT 'biometric';

-- Create fingerprint_slots table for tracking AS608 memory slots per device
CREATE TABLE IF NOT EXISTS fingerprint_slots (
    id SERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    slot_index INTEGER NOT NULL,
    student_id BIGINT REFERENCES students(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(device_id, slot_index)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_fingerprint_slots_device ON fingerprint_slots(device_id);
CREATE INDEX IF NOT EXISTS idx_fingerprint_slots_student ON fingerprint_slots(student_id);
CREATE INDEX IF NOT EXISTS idx_students_fingerprint_slot ON students(fingerprint_slot_id);

-- RLS for fingerprint_slots
ALTER TABLE fingerprint_slots ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read fingerprint_slots
CREATE POLICY "Allow authenticated read fingerprint_slots"
    ON fingerprint_slots FOR SELECT
    TO authenticated
    USING (true);

-- Allow service role full access (API uses service role for writes)
CREATE POLICY "Allow service role manage fingerprint_slots"
    ON fingerprint_slots FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
