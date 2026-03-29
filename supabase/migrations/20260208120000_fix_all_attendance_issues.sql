-- ============================================
-- FIX: Relax RLS Policies for App Functionality
-- ============================================

-- 1. INSTRUCTORS
DROP POLICY IF EXISTS "instructors_view_instructors" ON instructors;
DROP POLICY IF EXISTS "users_view_own_instructor" ON instructors;
DROP POLICY IF EXISTS "users_view_all_instructors" ON instructors;
CREATE POLICY "users_view_all_instructors" 
ON instructors FOR SELECT 
TO authenticated 
USING (true);

-- 2. STUDENTS
DROP POLICY IF EXISTS "instructors_view_students" ON students;
DROP POLICY IF EXISTS "instructors_delete_students" ON students;
DROP POLICY IF EXISTS "authenticated_view_students" ON students;
CREATE POLICY "authenticated_view_students"
ON students FOR SELECT
TO authenticated
USING (true);
DROP POLICY IF EXISTS "authenticated_delete_students" ON students;
CREATE POLICY "authenticated_delete_students"
ON students FOR DELETE
TO authenticated
USING (true);

-- 3. CLASSES
DROP POLICY IF EXISTS "instructors_view_classes" ON classes;
DROP POLICY IF EXISTS "instructors_delete_classes" ON classes;
DROP POLICY IF EXISTS "authenticated_view_classes" ON classes;
CREATE POLICY "authenticated_view_classes"
ON classes FOR SELECT
TO authenticated
USING (true);
DROP POLICY IF EXISTS "authenticated_delete_classes" ON classes;
CREATE POLICY "authenticated_delete_classes"
ON classes FOR DELETE
TO authenticated
USING (true);

-- 4. ATTENDANCE LOGS
DROP POLICY IF EXISTS "instructors_view_attendance" ON attendance_logs;
DROP POLICY IF EXISTS "authenticated_view_attendance" ON attendance_logs;
DROP POLICY IF EXISTS "instructors_delete_attendance" ON attendance_logs;
DROP POLICY IF EXISTS "authenticated_view_attendance_logs" ON attendance_logs;

CREATE POLICY "authenticated_view_attendance_logs"
ON attendance_logs FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_delete_attendance" ON attendance_logs;
CREATE POLICY "authenticated_delete_attendance"
ON attendance_logs FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- FIX: Schema Repair + Notifications
-- ============================================

-- 1. FIX MISSING COLUMN (Critical for Admin/RLS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'auth_user_id') THEN
        ALTER TABLE instructors ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        CREATE INDEX idx_instructors_auth_user_id ON instructors(auth_user_id);
    END IF;
END $$;

-- 2. FIX NOTIFICATIONS ISOLATION
-- Add instructor_id column
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES instructors(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_instructor_id ON notifications(instructor_id);

-- Link existing notifications (Best Effort)
UPDATE notifications 
SET instructor_id = (
    SELECT id FROM instructors 
    WHERE auth_user_id = notifications.user_id 
    LIMIT 1
)
WHERE instructor_id IS NULL;

-- 3. UPDATE POLICIES FOR NOTIFICATIONS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_notifications" ON notifications;
DROP POLICY IF EXISTS "authenticated_view_notifications" ON notifications;
DROP POLICY IF EXISTS "authenticated_insert_notifications" ON notifications;

-- Allow reading (Frontend filters by instructor_id)
CREATE POLICY "authenticated_view_notifications"
ON notifications FOR SELECT
TO authenticated
USING (true);

-- Allow inserting
CREATE POLICY "authenticated_insert_notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- FIX: API Functions (Sync & Log Attendance)
-- ============================================

CREATE OR REPLACE FUNCTION get_sync_data_v2(email_input TEXT)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    result JSON;
BEGIN
    SELECT id INTO user_record FROM auth.users WHERE email = email_input;

    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    SELECT json_build_object(
        'classes', (
            SELECT json_agg(
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'instructor_id', i.id 
                )
            )
            FROM classes c
            JOIN instructors i ON c.instructor_id = i.id
        ),
        'students', (
            SELECT json_agg(
                json_build_object(
                    'id', s.id,
                    'name', s.name,
                    'year_level', s.year_level,
                    'enrolled_classes', (
                        SELECT json_agg(c.name)
                        FROM enrollments e
                        JOIN classes c ON e.class_id = c.id
                        WHERE e.student_id = s.id
                    )
                )
            )
            FROM students s
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ATTENDANCE LOGIC UPDATE
-- Handles orphan check-outs and enrollment verification
CREATE OR REPLACE FUNCTION log_attendance(
    email_input text,
    student_name_input text, 
    class_name_input text,
    status_input text,
    timestamp_input timestamp with time zone,
    instructor_id_input uuid DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  u_id uuid;
  s_id bigint;
  c_id uuid;
  c_start_time time;
  c_end_time time;
  log_id uuid;
  current_day date;
  final_status text;
  current_status text;
  current_time_manila time;
begin
  -- 1. Get User ID
  select id into u_id from auth.users where email = email_input;
  if u_id is null then return json_build_object('error', 'Auth User not found', 'code', 404); end if;

  -- 2. Validate Student
  select id into s_id from students where name = student_name_input and user_id = u_id;
  if s_id is null then return json_build_object('error', 'Student not found', 'code', 404); end if;

  -- 3. Resolve Class (Improved with Null Protection)
  select c.id, c.start_time, c.end_time into c_id, c_start_time, c_end_time 
  from classes c
  left join enrollments e on e.class_id = c.id
  where c.name = class_name_input 
    and (e.student_id = s_id OR c.user_id = u_id) -- Look for enrollment OR ownership
  limit 1;

  if c_id is null then return json_build_object('error', 'Class resolution failed', 'code', 400); end if;

  current_day := timestamp_input::date;
  current_time_manila := (timestamp_input at time zone 'Asia/Manila')::time;

  -- 4. Logic Implementation
  IF status_input = 'TIME_IN' THEN
      final_status := 'Present';
      IF c_start_time IS NOT NULL THEN
          IF current_time_manila > (c_start_time + interval '30 minutes') THEN
              final_status := 'Absent';
          ELSIF current_time_manila > (c_start_time + interval '15 minutes') THEN
              final_status := 'Late';
          END IF;
      END IF;

      insert into attendance_logs (student_id, user_id, class_id, status, timestamp, time_out)
      values (s_id, u_id, c_id, final_status, timestamp_input, NULL);
      
  ELSIF status_input = 'TIME_OUT' THEN
      select id, status into log_id, current_status from attendance_logs 
      where student_id = s_id and class_id = c_id and timestamp::date = current_day and time_out is null
      order by timestamp desc limit 1;

      IF log_id IS NOT NULL THEN
          final_status := current_status;
          IF current_status != 'Absent' AND c_end_time IS NOT NULL THEN
              IF (c_end_time - current_time_manila) > interval '15 minutes' THEN
                  final_status := 'Absent'; -- Cutting Class
              ELSIF (current_time_manila - c_end_time) > interval '60 minutes' THEN
                  final_status := 'Absent'; -- Ghosting
              END IF;
          END IF;
          update attendance_logs set time_out = timestamp_input, status = final_status where id = log_id;
      ELSE
          -- FIX: Instead of 400 error, we log an "Incomplete" entry as Absent
          insert into attendance_logs (student_id, user_id, class_id, status, timestamp, time_out)
          values (s_id, u_id, c_id, 'Absent', timestamp_input, timestamp_input);
          return json_build_object('success', true, 'message', 'Missing Time In - Marked Absent');
      END IF;
  END IF;

  return json_build_object('success', true);
exception when others then
  return json_build_object('error', SQLERRM, 'code', 500);
end;
$function$;

-- Temporarily disable RLS on attendance_logs to verify data flow if needed
-- ALTER TABLE attendance_logs DISABLE ROW LEVEL SECURITY;
