-- 1. Create iot_device_groups Table
CREATE TABLE iot_device_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- e.g., 'Lights', 'Fans'
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create iot_group_members Table
CREATE TABLE iot_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES iot_device_groups(id) ON DELETE CASCADE,
    device_id TEXT REFERENCES iot_devices(id) ON DELETE CASCADE,
    dp_code TEXT NOT NULL, -- e.g., 'switch_1', 'switch_2'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(group_id, device_id, dp_code)
);

-- Enable Realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE iot_device_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE iot_group_members;

-- RLS Policies (Simplified for now, mirroring iot_devices)
ALTER TABLE iot_device_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for authenticated" ON iot_device_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public read for authenticated members" ON iot_group_members FOR SELECT TO authenticated USING (true);
