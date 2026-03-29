-- ============================================
-- Add Performance Indexes to Speed Up Filtering
-- ============================================

-- Students table indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_students_department ON public.students(department);
CREATE INDEX IF NOT EXISTS idx_students_year_level ON public.students(year_level);
CREATE INDEX IF NOT EXISTS idx_students_instructor_id ON public.students(instructor_id);

-- Classes table indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_classes_department ON public.classes(department);
CREATE INDEX IF NOT EXISTS idx_classes_year_level ON public.classes(year_level);
CREATE INDEX IF NOT EXISTS idx_classes_instructor_id ON public.classes(instructor_id);

-- Enrollments table indexes for fast joins
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class_id ON public.enrollments(class_id);

-- Attendance logs table indexes for fast counts and reports
CREATE INDEX IF NOT EXISTS idx_attendance_logs_student_id ON public.attendance_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_class_id ON public.attendance_logs(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_timestamp ON public.attendance_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_status ON public.attendance_logs(status);
