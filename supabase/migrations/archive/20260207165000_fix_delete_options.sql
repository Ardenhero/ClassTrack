-- ============================================
-- FIX: Relax DELETE Policies to match SELECT
-- ============================================

-- 1. STUDENTS
DROP POLICY IF EXISTS "instructors_delete_students" ON students;
CREATE POLICY "authenticated_delete_students"
ON students FOR DELETE
TO authenticated
USING (true); -- App logic handles safety

-- 2. CLASSES
DROP POLICY IF EXISTS "instructors_delete_classes" ON classes;
CREATE POLICY "authenticated_delete_classes"
ON classes FOR DELETE
TO authenticated
USING (true);

-- 3. ATTENDANCE / ATTENDANCE_LOGS
DROP POLICY IF EXISTS "instructors_delete_attendance" ON attendance_logs;
CREATE POLICY "authenticated_delete_attendance"
ON attendance_logs FOR DELETE
TO authenticated
USING (true);

-- 4. INSTRUCTORS (Optional, but good for consistency if needed)
-- usually we don't delete instructors from the app, but providing just in case
-- keeping strictly secure for now as it's sensitive
