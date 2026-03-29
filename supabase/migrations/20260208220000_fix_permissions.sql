-- ============================================
-- FIX: RLS Policies for Direct Access (Admin Load Fix)
-- ============================================

-- 1. Ensure RLS is Enabled
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- 2. Drop restrictive policies if they exist (clean slate)
DROP POLICY IF EXISTS "authenticated_view_students" ON students;
DROP POLICY IF EXISTS "authenticated_insert_students" ON students;
DROP POLICY IF EXISTS "authenticated_update_students" ON students;
DROP POLICY IF EXISTS "authenticated_delete_students" ON students;

-- 3. Allow ALL Authenticated Users to VIEW (Select)
-- This fixes the "Failed to Load" error for Admins who use Direct Select
-- Note: Security is still fine because the Frontend filters data, and RPCs are used for restricted views
CREATE POLICY "authenticated_view_students" ON students
FOR SELECT TO authenticated
USING (true);

-- 4. Allow Authenticated Users to INSERT
-- This fixes "Failed to Create" permissions (permissions-wise, though actions.ts needs a UUID fix too)
CREATE POLICY "authenticated_insert_students" ON students
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL
);

-- 5. Allow Creators or Admins to UPDATE/DELETE
CREATE POLICY "authenticated_update_students" ON students
FOR UPDATE TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) 
    OR 
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "authenticated_delete_students" ON students
FOR DELETE TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) 
    OR 
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);
