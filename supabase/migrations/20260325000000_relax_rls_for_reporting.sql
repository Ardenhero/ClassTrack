-- ============================================
-- RELAX RLS FOR ADMINISTRATIVE REPORTING
-- ============================================

-- 1. Relax CLASSES RLS
-- Allow all authenticated users to VIEW classes.
-- This is necessary for joins in the Super Admin attendance view.
DROP POLICY IF EXISTS "classes_owner_isolation" ON classes;
CREATE POLICY "classes_view_all_authenticated" ON classes
    FOR SELECT TO authenticated
    USING (true);

-- Reinstate restrictive policies for INSERT/UPDATE/DELETE if they were combined
CREATE POLICY "classes_manage_owner" ON classes
    FOR ALL TO authenticated
    USING (instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()))
    WITH CHECK (instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()));

-- 2. Relax INSTRUCTORS RLS
DROP POLICY IF EXISTS "instructors_owner_isolation" ON instructors;
CREATE POLICY "instructors_view_all_authenticated" ON instructors
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "instructors_manage_owner" ON instructors
    FOR ALL TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- 3. Relax DEPARTMENTS RLS
DROP POLICY IF EXISTS "departments_owner_isolation" ON departments;
CREATE POLICY "departments_view_all_authenticated" ON departments
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "departments_manage_admin" ON departments
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND (role = 'admin' OR is_super_admin = true)));
