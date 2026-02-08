-- ============================================
-- ClassTrack Admin Access Fix
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Ensure you have an admin user
-- REPLACE 'your-email@example.com' with your actual admin email
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';

-- Verify admin exists
SELECT id, email, role FROM profiles WHERE role = 'admin';

-- ============================================
-- Step 2: Drop existing restrictive policies
-- ============================================

-- Profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;

-- Attendance table  
DROP POLICY IF EXISTS "Users can view own attendance" ON attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON attendance;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON attendance;

-- Students table
DROP POLICY IF EXISTS "Users can view own students" ON students;
DROP POLICY IF EXISTS "Admins can view all students" ON students;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON students;

-- Classes table
DROP POLICY IF EXISTS "Users can view own classes" ON classes;
DROP POLICY IF EXISTS "Admins can view all classes" ON classes;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON classes;

-- ============================================
-- Step 3: Enable RLS on all tables
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 4: Create new admin-friendly policies
-- ============================================

-- PROFILES TABLE
-- ----------------
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

-- ATTENDANCE TABLE
-- ----------------
CREATE POLICY "Users can view own attendance"
ON attendance FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

CREATE POLICY "Users can insert own attendance"
ON attendance FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

CREATE POLICY "Users can update own attendance"
ON attendance FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can delete attendance"
ON attendance FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

-- STUDENTS TABLE
-- ----------------
CREATE POLICY "Users can view accessible students"
ON students FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR user_id IS NULL
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

CREATE POLICY "Users can insert own students"
ON students FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

CREATE POLICY "Users can update own students"
ON students FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can delete students"
ON students FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

-- CLASSES TABLE
-- ----------------
CREATE POLICY "Users can view accessible classes"
ON classes FOR SELECT
TO authenticated
USING (
  auth.uid() = teacher_id 
  OR teacher_id IS NULL
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

CREATE POLICY "Users can insert own classes"
ON classes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = teacher_id
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

CREATE POLICY "Users can update own classes"
ON classes FOR UPDATE
TO authenticated
USING (
  auth.uid() = teacher_id
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can delete classes"
ON classes FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

-- ============================================
-- Step 5: Verify policies were created
-- ============================================

SELECT 
  tablename, 
  policyname, 
  cmd as operation,
  CASE 
    WHEN qual LIKE '%admin%' THEN 'Has admin check'
    ELSE 'No admin check'
  END as admin_support
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'attendance', 'students', 'classes')
ORDER BY tablename, policyname;

-- ============================================
-- Step 6: Test as admin user
-- ============================================

-- Run these queries while logged in as admin
-- You should see ALL records, not just your own

-- Test 1: View all profiles
SELECT COUNT(*) as total_profiles FROM profiles;

-- Test 2: View all attendance records
SELECT COUNT(*) as total_attendance FROM attendance;

-- Test 3: View all students
SELECT COUNT(*) as total_students FROM students;

-- Test 4: View all classes
SELECT COUNT(*) as total_classes FROM classes;

-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- If still not working, check:

-- 1. Verify your user has admin role:
SELECT id, email, role 
FROM profiles 
WHERE id = auth.uid();

-- 2. Check if policies are active:
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename;

-- 3. Test policy directly:
SELECT 
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  ) as am_i_admin;

-- If am_i_admin returns FALSE, your role isn't set correctly
-- Re-run the UPDATE statement in Step 1
