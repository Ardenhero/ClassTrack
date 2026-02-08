-- ============================================
-- FIX: Ensure Enrollments Table & Policies
-- ============================================

-- 1. Ensure Table Exists
CREATE TABLE IF NOT EXISTS enrollments (
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (student_id, class_id)
);

-- 2. Enable RLS
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- DROP existing policies to avoid conflicts
DROP POLICY IF EXISTS "enrollments_select_policy" ON enrollments;
DROP POLICY IF EXISTS "enrollments_insert_policy" ON enrollments;
DROP POLICY IF EXISTS "enrollments_delete_policy" ON enrollments;

-- SELECT: Allow users to view enrollments for their classes or students they created
CREATE POLICY "enrollments_select_policy" ON enrollments
FOR SELECT TO authenticated
USING (
    -- Class Owner
    EXISTS (SELECT 1 FROM classes c WHERE c.id = enrollments.class_id AND c.instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()))
    OR
    -- Student Creator
    EXISTS (SELECT 1 FROM students s WHERE s.id = enrollments.student_id AND s.instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()))
    OR
    -- Admin
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

-- INSERT: Allow users to enroll students into THEIR classes
CREATE POLICY "enrollments_insert_policy" ON enrollments
FOR INSERT TO authenticated
WITH CHECK (
    -- Must own the class
    EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND c.instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()))
    OR
    -- Admin
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

-- DELETE: Allow users to unenroll students from THEIR classes
CREATE POLICY "enrollments_delete_policy" ON enrollments
FOR DELETE TO authenticated
USING (
    -- Must own the class
    EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND c.instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()))
    OR
    -- Admin
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);
