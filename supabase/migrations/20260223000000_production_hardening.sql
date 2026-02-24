-- =====================================================
-- Production Hardening Migration
-- sin_change_requests, archive system, attendance notes
-- =====================================================

-- 1. SIN Change Requests (Super Admin Approval Queue)
CREATE TABLE IF NOT EXISTS sin_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  current_sin TEXT NOT NULL,
  new_sin TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES instructors(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- RLS for sin_change_requests
ALTER TABLE sin_change_requests ENABLE ROW LEVEL SECURITY;

-- Super Admins can see all requests
CREATE POLICY "super_admins_full_access_sin_requests" ON sin_change_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM instructors
      WHERE instructors.auth_user_id = auth.uid()
      AND instructors.is_super_admin = true
    )
  );

-- Department admins can see their own requests
CREATE POLICY "admins_own_requests" ON sin_change_requests
  FOR SELECT USING (
    requested_by IN (
      SELECT id FROM instructors
      WHERE auth_user_id = auth.uid()
    )
  );

-- Department admins can create requests
CREATE POLICY "admins_create_requests" ON sin_change_requests
  FOR INSERT WITH CHECK (
    requested_by IN (
      SELECT id FROM instructors
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- 2. Archive System
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES instructors(id);

ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES instructors(id);

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- 3. Guardian Contact Info (for auto-absent email notifications)
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_email TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_name TEXT;

-- 3. Attendance Notes (Admin/Instructor notes on records)
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS note_by UUID REFERENCES instructors(id);
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS note_at TIMESTAMPTZ;

-- 4. Frozen Records (48-hour timer)
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;

-- 5. API Keys table (Super Admin key provisioning)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- first 8 chars for display
  device_type TEXT NOT NULL CHECK (device_type IN ('kiosk', 'tuya', 'esp32')),
  department_id UUID REFERENCES departments(id),
  created_by UUID NOT NULL REFERENCES instructors(id),
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_full_access_api_keys" ON api_keys
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM instructors
      WHERE instructors.auth_user_id = auth.uid()
      AND instructors.is_super_admin = true
    )
  );

-- Index for archive queries
CREATE INDEX IF NOT EXISTS idx_students_archived ON students(is_archived) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_classes_archived ON classes(is_archived) WHERE is_archived = false;

-- 5. Deletion Requests (Instructor → Admin approval for permanent deletion)
CREATE TABLE IF NOT EXISTS deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('student', 'class')),
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES instructors(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access_deletion_requests" ON deletion_requests
  FOR ALL USING (auth.role() = 'authenticated');
