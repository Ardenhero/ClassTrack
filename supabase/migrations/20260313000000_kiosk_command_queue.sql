-- migrations/20260313000000_kiosk_command_queue.sql
-- Description: Introduces a command queue for kiosk devices to handle multiple rapid commands (e.g. multi-select delete).

CREATE TABLE IF NOT EXISTS kiosk_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_serial TEXT NOT NULL REFERENCES kiosk_devices(device_serial) ON DELETE CASCADE,
    command TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    delivered_at TIMESTAMPTZ
);

-- Index for rapid polling
CREATE INDEX IF NOT EXISTS idx_kiosk_commands_device_serial_status ON kiosk_commands(device_serial, status, created_at);

-- RLS
ALTER TABLE kiosk_commands ENABLE ROW LEVEL SECURITY;

-- Allow Service Role and Super Admins to manage commands
CREATE POLICY "service_role_full_access_commands" ON kiosk_commands
    FOR ALL USING (true);

-- Allow authenticated users with admin role to insert commands for their kiosks
CREATE POLICY "admins_insert_commands" ON kiosk_commands
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM kiosk_devices
            WHERE kiosk_devices.device_serial = kiosk_commands.device_serial
            AND (
                kiosk_devices.assigned_admin_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM instructors
                    WHERE instructors.auth_user_id = auth.uid() AND instructors.is_super_admin = true
                )
            )
        )
    );
