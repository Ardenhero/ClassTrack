-- =====================================================
-- ADD COLLEGE GROUPING + FIX DEPARTMENT RLS
-- =====================================================

-- 1. Add college column to departments
ALTER TABLE public.departments 
ADD COLUMN IF NOT EXISTS college TEXT DEFAULT 'CEAT';

-- 2. Fix RLS: Allow ALL authenticated users to READ departments
--    (departments are reference data, everyone needs to see them)
--    Keep write operations restricted to owner only.
DROP POLICY IF EXISTS "departments_owner_isolation" ON departments;

-- Read access: all authenticated users
CREATE POLICY "departments_read_all" ON departments
    FOR SELECT USING (auth.role() = 'authenticated');

-- Write access: only the owner (Super Admin who created it)
CREATE POLICY "departments_write_owner" ON departments
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "departments_update_owner" ON departments
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "departments_delete_owner" ON departments
    FOR DELETE USING (owner_id = auth.uid());
