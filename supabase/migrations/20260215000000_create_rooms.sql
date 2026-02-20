-- migrations/20260215000000_create_rooms.sql

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    building TEXT,
    capacity INT,
    department_id UUID REFERENCES departments(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure RLS is enabled
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users based on department
CREATE POLICY "Enable read access for authenticated users to their department's rooms" ON rooms
    FOR SELECT TO authenticated
    USING (
      department_id IN (
        SELECT department_id FROM instructors 
        WHERE auth_user_id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM instructors 
        WHERE auth_user_id = auth.uid() AND is_super_admin = true
      ) OR department_id IS NULL -- Global rooms
    );

-- Allow admins/super admins to manage rooms
CREATE POLICY "Enable full access for admins" ON rooms
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM instructors 
        WHERE auth_user_id = auth.uid() AND role = 'admin' AND (department_id = rooms.department_id OR is_super_admin = true)
      )
    );

-- Alter iot_devices to link a specific room properly
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id);

-- Alter classes to link a room properly (optional but good idea if not existing)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id);
