-- migrations/20260404180000_create_iot_core_tables.sql
-- Fixes the missing iot_device_logs table while ensuring compatibility with existing iot_devices/iot_logs.

-- 1. IoT Device Logs table (The one specifically reported as missing)
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

-- 2. IoT Devices table (IF NOT EXISTS)
-- Only created if missing; otherwise ignored.
CREATE TABLE IF NOT EXISTS iot_devices (
    id TEXT PRIMARY KEY, 
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

-- 3. Legacy IoT Logs table (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS iot_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    device_name TEXT,
    action TEXT,
    status TEXT
);

-- 4. Enable RLS and Realtime (Safe to repeat)
DO $$ 
BEGIN
    ALTER TABLE iot_devices ENABLE ROW LEVEL SECURITY;
    ALTER TABLE iot_device_logs ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'iot_device_logs' AND policyname = 'Allow public read for authenticated logs') THEN
        CREATE POLICY "Allow public read for authenticated logs" ON iot_device_logs FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

