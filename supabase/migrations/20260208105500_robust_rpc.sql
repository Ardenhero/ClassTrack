DROP FUNCTION IF EXISTS log_attendance(text,text,text,text,timestamp with time zone,uuid);

CREATE OR REPLACE FUNCTION log_attendance(
  email_input text,
  student_name_input text,
  class_name_input text, -- Keep for backward compatibility/logging
  status_input text,
  timestamp_input timestamptz,
  instructor_id_input uuid,
  class_id_input uuid DEFAULT NULL -- New optional parameter
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id uuid;
  v_class_id uuid;
  v_attendance_id uuid;
  v_current_status text;
  v_class_start time;
  v_class_end time;
  v_new_status text;
  v_time_diff float;
  v_current_time time;
  v_today_start timestamptz;
BEGIN
  -- 1. Find Class
  IF class_id_input IS NOT NULL THEN
      -- Precise Lookup by ID
      SELECT id, start_time, end_time INTO v_class_id, v_class_start, v_class_end
      FROM classes
      WHERE id = class_id_input;
  ELSE
      -- Fallback Lookup by Name (Brittle)
      SELECT id, start_time, end_time INTO v_class_id, v_class_start, v_class_end
      FROM classes
      WHERE name = class_name_input AND instructor_id = instructor_id_input
      LIMIT 1;
  END IF;

  IF v_class_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Class not found', 'success', false);
  END IF;

  -- 2. Find Student
  -- Use instructor_id from class to ensure correct student scope if input was missing
  -- But we need instructor_id for student lookup if not reusing class's context
  -- Assuming student is linked to instructor
  SELECT id INTO v_student_id
  FROM students
  WHERE name = student_name_input AND instructor_id = instructor_id_input
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Student not found', 'success', false);
  END IF;

  -- 3. Handle Status Logic
  IF status_input = 'TIME_OUT' THEN
      -- STRICT SEQUENCE: Check for open session (Time Out is NULL)
      v_today_start := timestamp_input::date;
      
      SELECT id, status INTO v_attendance_id, v_current_status
      FROM attendance_logs
      WHERE student_id = v_student_id
        AND class_id = v_class_id
        AND time_out IS NULL
        AND timestamp >= v_today_start
      ORDER BY timestamp DESC
      LIMIT 1;

      IF v_attendance_id IS NOT NULL THEN
          -- Update existing session
          UPDATE attendance_logs
          SET time_out = timestamp_input
          WHERE id = v_attendance_id;
          
          RETURN jsonb_build_object('success', true, 'message', 'Time Out Recorded');
      ELSE
          -- REJECT: No Time In found
          RETURN jsonb_build_object('error', 'Access Denied: You must Time In first.', 'success', false);
      END IF;

  ELSIF status_input = 'TIME_IN' THEN
      v_new_status := 'Present';

      -- Check Late Logic
      IF v_class_start IS NOT NULL THEN
         v_current_time := timestamp_input::time;
         
         SELECT EXTRACT(EPOCH FROM (v_current_time - v_class_start))/60 INTO v_time_diff;

         IF v_time_diff > 30 THEN
             v_new_status := 'Absent';
         ELSIF v_time_diff > 15 THEN
             v_new_status := 'Late';
         END IF;
      END IF;

      -- Check for existing open session
      SELECT id INTO v_attendance_id
      FROM attendance_logs
      WHERE student_id = v_student_id
        AND class_id = v_class_id
        AND time_out IS NULL
        AND timestamp >= (timestamp_input::date);
        
      IF v_attendance_id IS NOT NULL THEN
          RETURN jsonb_build_object('success', true, 'message', 'Already Timed In');
      END IF;

      INSERT INTO attendance_logs (student_id, class_id, user_id, status, timestamp)
      VALUES (v_student_id, v_class_id, instructor_id_input, v_new_status, timestamp_input);

      RETURN jsonb_build_object('success', true, 'message', 'Time In Recorded (' || v_new_status || ')');

  ELSE
      RETURN jsonb_build_object('error', 'Invalid Status', 'success', false);
  END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM, 'success', false);
END;
$$;
