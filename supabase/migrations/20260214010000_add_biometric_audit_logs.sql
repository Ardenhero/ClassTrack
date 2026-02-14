-- Create biometric_audit_logs table for orphan scans and other events
CREATE TYPE biometric_event_type AS ENUM ('ORPHAN_SCAN', 'MATCH_FOUND', 'ENROLL_ERROR', 'ENROLL_SUCCESS', 'DEVICE_ERROR');

CREATE TABLE IF NOT EXISTS biometric_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    fingerprint_slot_id INTEGER,
    device_id TEXT,
    event_type biometric_event_type NOT NULL,
    details TEXT,
    metadata JSONB
);

-- Add RLS policies (viewable by admins)
ALTER TABLE biometric_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view biometric audit logs"
    ON biometric_audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM instructors
            WHERE instructors.user_id = auth.uid()
            AND (instructors.role = 'admin' OR instructors.is_super_admin = true)
        )
    );

-- Allow server (service role) to insert logs
CREATE POLICY "Service role can insert biometric logs"
    ON biometric_audit_logs
    FOR INSERT
    WITH CHECK (true); -- Typically service role bypasses RLS, but good to be explicit or leave open if needed

-- Index for faster queries
CREATE INDEX idx_biometric_logs_timestamp ON biometric_audit_logs(timestamp DESC);
CREATE INDEX idx_biometric_logs_event ON biometric_audit_logs(event_type);
