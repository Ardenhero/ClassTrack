-- Production Performance Indexes

-- Students: Searching by name is common
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);

-- Students: Filtering by year level
CREATE INDEX IF NOT EXISTS idx_students_year_level ON students(year_level);

-- Attendance: Filtering by student and date (Compound)
-- Table is 'attendance_logs', column is 'timestamp'
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance_logs(student_id, timestamp);

-- Enrollment: Foreign keys
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class_id ON enrollments(class_id);

-- Notifications: Unread by user
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;
