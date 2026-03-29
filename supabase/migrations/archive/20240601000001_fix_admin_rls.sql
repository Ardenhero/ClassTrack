-- ============================================
-- ClassTrack Admin Access Fix (Adapted for 'instructors' table)
-- ============================================

-- Step 1: Ensure RLS is enabled
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Step 2: Create/Replace Policies

-- INSTRUCTORS TABLE (formerly profiles)
-- ----------------
DROP POLICY IF EXISTS "Users can view own profile" ON instructors;
CREATE POLICY "Users can view own profile"
ON instructors FOR SELECT
TO authenticated
USING (auth.uid() = id OR id::text = 'admin-profile'); -- Allow admin-profile virtual ID if valid

DROP POLICY IF EXISTS "Admins can view all profiles" ON instructors;
CREATE POLICY "Admins can view all profiles"
ON instructors FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM instructors
    WHERE instructors.id = auth.uid() 
    AND instructors.role = 'admin'
  )
);

-- ATTENDANCE TABLE
-- ----------------
DROP POLICY IF EXISTS "Users can view own attendance" ON attendance;
CREATE POLICY "Users can view own attendance"
ON attendance FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM instructors
    WHERE instructors.id = auth.uid() 
    AND instructors.role = 'admin'
  )
);

-- STUDENTS TABLE
-- ----------------
DROP POLICY IF EXISTS "Users can view accessible students" ON students;
CREATE POLICY "Users can view accessible students"
ON students FOR SELECT
TO authenticated
USING (
  auth.uid() = instructor_id 
  OR instructor_id IS NULL -- Allow unassigned students?
  OR
  EXISTS (
    SELECT 1 FROM instructors
    WHERE instructors.id = auth.uid() 
    AND instructors.role = 'admin'
  )
);

-- CLASSES TABLE
-- ----------------
DROP POLICY IF EXISTS "Users can view accessible classes" ON classes;
CREATE POLICY "Users can view accessible classes"
ON classes FOR SELECT
TO authenticated
USING (
  auth.uid() = instructor_id 
  OR
  EXISTS (
    SELECT 1 FROM instructors
    WHERE instructors.id = auth.uid() 
    AND instructors.role = 'admin'
  )
);
