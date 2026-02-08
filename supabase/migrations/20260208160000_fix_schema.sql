-- ============================================
-- FIX: Schema Consistency & Insert Policies
-- ============================================

-- 1. Ensure Columns Exist (Code uses 'name', 'sin', 'year_level', 'rfid_uid', 'image_url')
DO $$
BEGIN
    -- Ensure 'name' exists (recovery_plan had 'full_name')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'name') THEN
        ALTER TABLE students ADD COLUMN name TEXT;
        -- Migrate data if full_name exists and name is empty
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'full_name') THEN
            UPDATE students SET name = full_name WHERE name IS NULL;
        END IF;
    END IF;

    -- Ensure 'year_level' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'year_level') THEN
        ALTER TABLE students ADD COLUMN year_level TEXT;
    END IF;

    -- Ensure 'sin' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'sin') THEN
        ALTER TABLE students ADD COLUMN sin TEXT UNIQUE;
    END IF;

    -- Ensure 'rfid_uid' exists (Code selects it)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'rfid_uid') THEN
        ALTER TABLE students ADD COLUMN rfid_uid TEXT;
    END IF;

    -- Ensure 'image_url' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'image_url') THEN
        ALTER TABLE students ADD COLUMN image_url TEXT;
    END IF;
    
    -- Ensure columns are nullable to prevent insert errors
    ALTER TABLE students ALTER COLUMN rfid_uid DROP NOT NULL;
    ALTER TABLE students ALTER COLUMN image_url DROP NOT NULL;
    
END $$;


-- 2. REFRESH RLS POLICIES FOR STUDENTS (Ensure Insert Works)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_view_students" ON students;
DROP POLICY IF EXISTS "authenticated_insert_students" ON students;
DROP POLICY IF EXISTS "authenticated_update_students" ON students;
DROP POLICY IF EXISTS "authenticated_delete_students" ON students;
DROP POLICY IF EXISTS "instructors_insert_students" ON students;

-- View: See if instructor created OR enrolled
CREATE POLICY "authenticated_view_students" ON students
FOR SELECT TO authenticated
USING (true); -- App logic handles filtering via get_my_students RPC

-- Insert: Allow creation if authenticated
CREATE POLICY "authenticated_insert_students" ON students
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL
);

-- Update: Allow update if creator or admin
CREATE POLICY "authenticated_update_students" ON students
FOR UPDATE TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

-- Delete: Allow delete if creator or admin
CREATE POLICY "authenticated_delete_students" ON students
FOR DELETE TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

