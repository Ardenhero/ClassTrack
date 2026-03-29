-- migrations/20260322130000_multi_admin_kiosks.sql

-- 1. Add assigned_admin_ids to kiosk_devices
ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS assigned_admin_ids UUID[] DEFAULT '{}';

-- 2. Migrate existing data (optional but good practice)
UPDATE kiosk_devices SET assigned_admin_ids = ARRAY[assigned_admin_id] WHERE assigned_admin_id IS NOT NULL;

-- 3. Update RLS Policies to support multi-admin
-- We drop old policies and add new ones using array overlap or containment

DROP POLICY IF EXISTS "system_admin_read_own_kiosks" ON kiosk_devices;
CREATE POLICY "system_admin_read_own_kiosks" ON kiosk_devices
    FOR SELECT TO authenticated
    USING (
        assigned_admin_ids @> ARRAY[auth.uid()] OR assigned_admin_id = auth.uid()
    );

DROP POLICY IF EXISTS "system_admin_update_own_kiosks" ON kiosk_devices;
CREATE POLICY "system_admin_update_own_kiosks" ON kiosk_devices
    FOR UPDATE TO authenticated
    USING (
        assigned_admin_ids @> ARRAY[auth.uid()] OR assigned_admin_id = auth.uid()
    );

-- 4. Index for performance
CREATE INDEX IF NOT EXISTS idx_kiosk_devices_assigned_admin_ids ON kiosk_devices USING GIN (assigned_admin_ids);

-- 5. Comment
COMMENT ON COLUMN kiosk_devices.assigned_admin_ids IS 'List of admin IDs assigned to manage this kiosk (multi-admin support).';
