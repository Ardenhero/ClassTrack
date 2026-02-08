-- ============================================
-- RECOVERY MIGRATION: Schema + RLS
-- Based on user-provided safe-diagnostic, create-schema, and safe-rls-policies
-- ============================================

-- PART 1: Schema Updates (Safe)
-- ============================================

DO $$
BEGIN
    -- 1. Ensure INSTRUCTORS table exists
    CREATE TABLE IF NOT EXISTS instructors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name TEXT NOT NULL,
        email TEXT UNIQUE,
        role TEXT DEFAULT 'instructor' CHECK (role IN ('admin', 'instructor')),
        pin_code TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 2. Ensure extra columns exist (safe alter)
    -- auth_user_id needed for RLS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'auth_user_id') THEN
        ALTER TABLE instructors ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        CREATE INDEX idx_instructors_auth_user_id ON instructors(auth_user_id);
    END IF;

    -- pin_enabled needed for App Logic
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'pin_enabled') THEN
        ALTER TABLE instructors ADD COLUMN pin_enabled BOOLEAN DEFAULT false;
    END IF;

    -- department_id needed for App Logic
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'department_id') THEN
        -- Assuming departments table exists, if not we might fail FK constraint, so let's check or just add column loosely first?
        -- To be safe, just add UUID column. User can add FK later if missing.
        ALTER TABLE instructors ADD COLUMN department_id UUID; 
    END IF;

    -- 3. Ensure other tables exist
    CREATE TABLE IF NOT EXISTS students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instructor_id UUID REFERENCES instructors(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        student_id TEXT,
        grade_level TEXT,
        section TEXT,
        fingerprint_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS classes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instructor_id UUID REFERENCES instructors(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        schedule TEXT,
        room_number TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instructor_id UUID REFERENCES instructors(id) ON DELETE CASCADE,
        student_id UUID REFERENCES students(id) ON DELETE CASCADE,
        class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'present',
        check_in_time TIMESTAMPTZ DEFAULT NOW(),
        check_out_time TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

END $$;


-- PART 2: RLS Policies (Safe Replace)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- 1. INSTRUCTORS POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON instructors;
DROP POLICY IF EXISTS "Admins can view all profiles" ON instructors;
DROP POLICY IF EXISTS "users_view_own_instructor" ON instructors;
DROP POLICY IF EXISTS "users_update_own_instructor" ON instructors;

CREATE POLICY "users_view_own_instructor" ON instructors
FOR SELECT TO authenticated
USING (
    auth_user_id = auth.uid() 
    OR id::text = 'admin-profile' -- Keep app logic compatibility
    OR EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "users_update_own_instructor" ON instructors
FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid() OR EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin'));


-- 2. STUDENTS POLICIES
DROP POLICY IF EXISTS "Instructors view own students" ON students;
DROP POLICY IF EXISTS "Admins view all students" ON students;
DROP POLICY IF EXISTS "instructors_view_students" ON students;
DROP POLICY IF EXISTS "instructors_insert_students" ON students;
DROP POLICY IF EXISTS "instructors_update_students" ON students;
DROP POLICY IF EXISTS "instructors_delete_students" ON students;

CREATE POLICY "instructors_view_students" ON students FOR SELECT TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    instructor_id IS NULL OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "instructors_insert_students" ON students FOR INSERT TO authenticated
WITH CHECK (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "instructors_update_students" ON students FOR UPDATE TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "instructors_delete_students" ON students FOR DELETE TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);


-- 3. CLASSES POLICIES
DROP POLICY IF EXISTS "Instructors view own classes" ON classes;
DROP POLICY IF EXISTS "Admins view all classes" ON classes;
DROP POLICY IF EXISTS "instructors_view_classes" ON classes;
DROP POLICY IF EXISTS "instructors_insert_classes" ON classes;
DROP POLICY IF EXISTS "instructors_update_classes" ON classes;
DROP POLICY IF EXISTS "instructors_delete_classes" ON classes;

CREATE POLICY "instructors_view_classes" ON classes FOR SELECT TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "instructors_insert_classes" ON classes FOR INSERT TO authenticated
WITH CHECK (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "instructors_update_classes" ON classes FOR UPDATE TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "instructors_delete_classes" ON classes FOR DELETE TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);


-- 4. ATTENDANCE POLICIES
DROP POLICY IF EXISTS "Instructors view own attendance" ON attendance;
DROP POLICY IF EXISTS "Admins view all attendance" ON attendance;
DROP POLICY IF EXISTS "instructors_view_attendance" ON attendance;
DROP POLICY IF EXISTS "instructors_insert_attendance" ON attendance;
DROP POLICY IF EXISTS "instructors_update_attendance" ON attendance;
DROP POLICY IF EXISTS "instructors_delete_attendance" ON attendance;

CREATE POLICY "instructors_view_attendance" ON attendance FOR SELECT TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "instructors_insert_attendance" ON attendance FOR INSERT TO authenticated
WITH CHECK (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "instructors_update_attendance" ON attendance FOR UPDATE TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "instructors_delete_attendance" ON attendance FOR DELETE TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);
