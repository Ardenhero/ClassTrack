-- ============================================
-- FIX: Relax RLS Policies for App Functionality
-- ============================================

-- 1. INSTRUCTORS: Allow ALL authenticated users to view list (Required for Profile Selection)
DROP POLICY IF EXISTS "users_view_own_instructor" ON instructors;
CREATE POLICY "users_view_all_instructors" 
ON instructors FOR SELECT 
TO authenticated 
USING (true); -- Allow all logged-in users to see the list

-- 2. DATA TABLES: Restore visibility (Frontend handles filtering for Kiosk mode)
-- Since users share a login (Kiosk), strict RLS based on auth.uid() hides data from them.
-- We fall back to "App Logic Isolation" but keep RLS enabled to block Anon users.

-- Students
DROP POLICY IF EXISTS "instructors_view_students" ON students;
CREATE POLICY "authenticated_view_students"
ON students FOR SELECT
TO authenticated
USING (true); -- Application layer handles profile-based filtering

-- Classes
DROP POLICY IF EXISTS "instructors_view_classes" ON classes;
CREATE POLICY "authenticated_view_classes"
ON classes FOR SELECT
TO authenticated
USING (true);

-- Attendance
DROP POLICY IF EXISTS "instructors_view_attendance" ON attendance;
CREATE POLICY "authenticated_view_attendance"
ON attendance FOR SELECT
TO authenticated
USING (true);
