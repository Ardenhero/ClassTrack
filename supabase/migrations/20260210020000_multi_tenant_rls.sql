-- =====================================================
-- MULTI-TENANT DATA ISOLATION VIA RLS
-- =====================================================

-- 1. Add owner_id to departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);
UPDATE departments SET owner_id = '0db12eb7-735d-4713-aed0-5f962543bdc2' WHERE owner_id IS NULL;

-- 2. Enable RLS
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- 3. INSTRUCTORS: owner isolation
DROP POLICY IF EXISTS "instructors_owner_isolation" ON instructors;
CREATE POLICY "instructors_owner_isolation" ON instructors 
    FOR ALL USING (owner_id = auth.uid());

-- 4. DEPARTMENTS: owner isolation
DROP POLICY IF EXISTS "departments_owner_isolation" ON departments;
CREATE POLICY "departments_owner_isolation" ON departments 
    FOR ALL USING (owner_id = auth.uid());

-- 5. CLASSES: via instructor ownership
DROP POLICY IF EXISTS "classes_owner_isolation" ON classes;
CREATE POLICY "classes_owner_isolation" ON classes 
    FOR ALL USING (
        instructor_id IN (SELECT id FROM instructors WHERE owner_id = auth.uid())
    );

-- 6. STUDENTS: via instructor ownership
DROP POLICY IF EXISTS "students_owner_isolation" ON students;
CREATE POLICY "students_owner_isolation" ON students 
    FOR ALL USING (
        instructor_id IN (SELECT id FROM instructors WHERE owner_id = auth.uid())
    );
