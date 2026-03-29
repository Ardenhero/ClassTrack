-- Fix: Classes RLS Policy for INSERT
-- Allows instructors to manage their own classes
-- Allows Department Admins and Super Admins to manage all classes

DROP POLICY IF EXISTS "instructors_insert_classes" ON classes;
DROP POLICY IF EXISTS "authenticated_insert_classes" ON classes;

CREATE POLICY "authenticated_insert_classes" ON classes
FOR INSERT TO authenticated
WITH CHECK (
    -- 1. Instructor creating for themselves
    instructor_id IN (
        SELECT id FROM instructors 
        WHERE auth_user_id = auth.uid()
    )
    OR
    -- 2. Department Admin or Super Admin
    EXISTS (
        SELECT 1 FROM instructors 
        WHERE auth_user_id = auth.uid() 
        AND (role = 'admin' OR is_super_admin = true)
    )
    OR
    -- 3. Super Admin (Direct check if needed)
    auth.jwt() ->> 'email' IN (SELECT email FROM instructors WHERE is_super_admin = true)
);

-- Ensure other policies (UPDATE, DELETE) also support Super Admins
DROP POLICY IF EXISTS "instructors_update_classes" ON classes;
CREATE POLICY "instructors_update_classes" ON classes
FOR UPDATE TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND (role = 'admin' OR is_super_admin = true))
);

DROP POLICY IF EXISTS "instructors_delete_classes" ON classes;
CREATE POLICY "instructors_delete_classes" ON classes
FOR DELETE TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND (role = 'admin' OR is_super_admin = true))
);
