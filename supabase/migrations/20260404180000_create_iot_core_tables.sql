-- migrations/20260404180000_create_iot_core_tables.sql
-- Establishes the missing IoT architecture tables required by the application.

-- 1. IoT Devices table
CREATE TABLE IF NOT EXISTS iot_devices (
    id TEXT PRIMARY KEY, -- Tuya Device ID
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    dp_code TEXT DEFAULT 'switch_1',
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    current_state BOOLEAN DEFAULT false,
    online BOOLEAN DEFAULT true,
    assigned_instructor_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. IoT Device Logs table
CREATE TABLE IF NOT EXISTS iot_device_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT REFERENCES iot_devices(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    value BOOLEAN NOT NULL,
    source TEXT NOT NULL,
    triggered_by UUID REFERENCES instructors(id) ON DELETE SET NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Legacy IoT Logs table (for compatibility)
CREATE TABLE IF NOT EXISTS iot_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    device_name TEXT,
    action TEXT,
    status TEXT
);

-- 4. Enable RLS
ALTER TABLE iot_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_device_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_logs ENABLE ROW LEVEL SECURITY;

-- 5. Basic RLS Policies (Mirroring application logic)
CREATE POLICY "Allow public read for authenticated" ON iot_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public read for authenticated logs" ON iot_device_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public read for authenticated legacy logs" ON iot_logs FOR SELECT TO authenticated USING (true);

-- 6. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE iot_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE iot_device_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE iot_logs;
