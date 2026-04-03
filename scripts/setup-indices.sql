-- ============================================
-- CLASSTRACK PRODUCTION PERFORMANCE INDICES
-- Purpose: Optimize attendance search and student lookups.
-- Estimated Speed Increase: 10x - 50x for large datasets.
-- ============================================

-- 1. Optimize Attendance Logs (The highest-traffic table)
-- Speeds up filtering by student, class, and date ranges.
CREATE INDEX IF NOT EXISTS idx_attendance_logs_composite 
ON attendance_logs (student_id, class_id, timestamp DESC);

-- 2. Optimize Student Lookups
-- Speeds up the enrollment pool search and directory filtering.
CREATE INDEX IF NOT EXISTS idx_students_search 
ON students (name, sin);

-- 3. Optimize Class Lookups
-- Speeds up instructor dashboard loading and class matching.
CREATE INDEX IF NOT EXISTS idx_classes_instructor 
ON classes (instructor_id, room_id);

-- 4. Optimize Audit Logs
-- Speeds up the administrative audit review and history tracking.
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_action_timestamp 
ON audit_logs (actor_id, action, created_at DESC);

-- 5. Optimize Notification Delivery
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created 
ON notifications (user_id, type, created_at DESC);

-- 6. Optimize Departmental Grouping
CREATE INDEX IF NOT EXISTS idx_students_department 
ON students (department_id);

-- Verify index usage after creation:
-- EXPLAIN ANALYZE SELECT * FROM attendance_logs WHERE student_id = '...' ORDER BY timestamp DESC LIMIT 20;
