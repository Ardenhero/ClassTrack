-- migrations/20260221000000_kiosk_provisioning.sql
-- Extends kiosk_devices with provisioning status, system admin assignment, and RLS.

-- 1. Add provisioning columns
ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'));
ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES auth.users(id);
ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- 2. Enable RLS
ALTER TABLE kiosk_devices ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Super Admins: full access to all kiosks
CREATE POLICY "super_admin_full_access_kiosks" ON kiosk_devices
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM instructors
            WHERE auth_user_id = auth.uid() AND is_super_admin = true
        )
    );

-- System Admins: read + update kiosks assigned directly to them
CREATE POLICY "system_admin_read_own_kiosks" ON kiosk_devices
    FOR SELECT TO authenticated
    USING (
        assigned_admin_id = auth.uid()
    );

CREATE POLICY "system_admin_update_own_kiosks" ON kiosk_devices
    FOR UPDATE TO authenticated
    USING (
        assigned_admin_id = auth.uid()
    );

-- Instructors: zero access (no policy = no rows visible)
-- Service role key bypasses RLS for API routes.
