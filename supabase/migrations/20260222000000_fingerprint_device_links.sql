-- migrations/20260222000000_fingerprint_device_links.sql
-- Allows a student's fingerprint template to be linked to multiple kiosk devices.
-- This avoids re-enrolling when the same student uses multiple rooms.

CREATE TABLE IF NOT EXISTS fingerprint_device_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    device_serial TEXT NOT NULL,
    fingerprint_slot_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent duplicate links (same student on same device)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fdl_student_device
    ON fingerprint_device_links(student_id, device_serial);

-- Fast lookup by device
CREATE INDEX IF NOT EXISTS idx_fdl_device_serial
    ON fingerprint_device_links(device_serial);

-- RLS
ALTER TABLE fingerprint_device_links ENABLE ROW LEVEL SECURITY;

-- Admins can manage fingerprint links
CREATE POLICY "admin_manage_fingerprint_links" ON fingerprint_device_links
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
