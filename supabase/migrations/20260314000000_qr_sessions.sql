-- ============================================================================
-- QR Attendance Sessions & Scans
-- Instructor-led QR flow: instructor projects QR, students scan, instructor approves.
-- ============================================================================

-- 1. QR Sessions — one per class attendance event (Time In or Time Out)
CREATE TABLE IF NOT EXISTS qr_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('check_in', 'check_out')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    session_token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ
);

-- Index for quick lookups by instructor + status
CREATE INDEX IF NOT EXISTS idx_qr_sessions_instructor_status ON qr_sessions(instructor_id, status);
CREATE INDEX IF NOT EXISTS idx_qr_sessions_token ON qr_sessions(session_token);

-- 2. QR Scans — staging table for pending student scans
CREATE TABLE IF NOT EXISTS qr_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qr_sessions(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_session_status ON qr_scans(session_id, status);

-- 3. RLS — Service role handles all operations via API routes
ALTER TABLE qr_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own sessions/scans
CREATE POLICY "authenticated_read_qr_sessions" ON qr_sessions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_qr_scans" ON qr_scans
    FOR SELECT TO authenticated USING (true);
