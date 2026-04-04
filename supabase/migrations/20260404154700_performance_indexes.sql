-- ============================================================
-- ClassTrack Performance Indexes
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. ATTENDANCE LOGS (hottest table — queried on every student portal load)
CREATE INDEX IF NOT EXISTS idx_attendance_logs_student_id ON attendance_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_class_id ON attendance_logs(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_timestamp ON attendance_logs(timestamp DESC);
-- Composite index for the most common query pattern: "get all logs for student X in class Y"
CREATE INDEX IF NOT EXISTS idx_attendance_logs_student_class ON attendance_logs(student_id, class_id, timestamp DESC);

-- 2. STUDENTS (login, QR scan, evidence lookup by SIN)
CREATE INDEX IF NOT EXISTS idx_students_sin ON students(sin);

-- 3. ENROLLMENTS (student portal class list, class detail pages)
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class_id ON enrollments(class_id);
-- Composite for the "get all classes for student X" query
CREATE INDEX IF NOT EXISTS idx_enrollments_student_class ON enrollments(student_id, class_id);

-- 4. NOTIFICATIONS (student dashboard)
CREATE INDEX IF NOT EXISTS idx_notifications_student_id ON notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 5. CLASSES (term filtering, instructor lookup)
CREATE INDEX IF NOT EXISTS idx_classes_term_id ON classes(term_id);
CREATE INDEX IF NOT EXISTS idx_classes_instructor_id ON classes(instructor_id);

-- 6. QR SESSIONS (instructor dashboard, session lookup)
CREATE INDEX IF NOT EXISTS idx_qr_sessions_class_instructor ON qr_sessions(class_id, instructor_id, status);
CREATE INDEX IF NOT EXISTS idx_qr_scans_session_id ON qr_scans(session_id);

-- 7. IOT DEVICES (device control, room filtering)
CREATE INDEX IF NOT EXISTS idx_iot_devices_room_id ON iot_devices(room_id);
CREATE INDEX IF NOT EXISTS idx_iot_device_logs_device_id ON iot_device_logs(device_id);

-- 8. EVIDENCE DOCUMENTS (student upload tracking)
CREATE INDEX IF NOT EXISTS idx_evidence_docs_student_id ON evidence_documents(student_id);

-- 9. FINGERPRINTS (biometric lookup)
CREATE INDEX IF NOT EXISTS idx_fingerprints_student_id ON fingerprints(student_id);

-- Verify indexes were created
SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;
