-- Migration: Fix Attendance Logging RPC with Robust Owner-Bridging Logic
-- Description: Corrects student and class lookup to use instructor_id -> owner_id bridge instead of direct user_id.

CREATE OR REPLACE FUNCTION log_attendance(
    email_input TEXT,
    student_name_input TEXT,
    class_name_input TEXT,
    status_input TEXT,
    timestamp_input TIMESTAMPTZ,
    instructor_id_input UUID DEFAULT NULL,
    class_id_input UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    u_id UUID;
    s_id BIGINT;
    c_id UUID;
    c_start_time TIME;
    c_end_time TIME;
    log_id UUID;
    current_day DATE;
    final_status TEXT;
    current_status TEXT;
    current_time_manila TIME;
    v_instructor_id UUID;
BEGIN
    -- 1. Identify owner by email
    SELECT id INTO u_id FROM auth.users WHERE email = email_input;
    IF u_id IS NULL THEN 
        RETURN json_build_object('error', 'Auth User not found for email: ' || email_input, 'code', 404); 
    END IF;

    -- 2. Resolve Student
    SELECT s.id, s.instructor_id INTO s_id, v_instructor_id 
    FROM students s
    JOIN instructors i ON s.instructor_id = i.id
    WHERE s.name = student_name_input AND i.owner_id = u_id
    LIMIT 1;

    IF s_id IS NULL THEN 
        -- Try full_name as fallback
        SELECT s.id, s.instructor_id INTO s_id, v_instructor_id 
        FROM students s
        JOIN instructors i ON s.instructor_id = i.id
        WHERE s.full_name = student_name_input AND i.owner_id = u_id
        LIMIT 1;
        
        IF s_id IS NULL THEN
            RETURN json_build_object('error', 'Student not found: ' || student_name_input, 'code', 404);
        END IF;
    END IF;

    -- 3. Resolve Class
    IF class_id_input IS NOT NULL THEN
        SELECT c.id, c.start_time, c.end_time INTO c_id, c_start_time, c_end_time 
        FROM classes c
        WHERE c.id = class_id_input;
    ELSE
        SELECT c.id, c.start_time, c.end_time INTO c_id, c_start_time, c_end_time 
        FROM classes c
        JOIN instructors i ON c.instructor_id = i.id
        WHERE c.name = class_name_input AND i.owner_id = u_id
        LIMIT 1;
    END IF;

    IF c_id IS NULL THEN 
        RETURN json_build_object('error', 'Class not found: ' || class_name_input, 'code', 404); 
    END IF;

    -- 4. Set Time Context (Manila Time)
    current_day := (timestamp_input AT TIME ZONE 'Asia/Manila')::DATE;
    current_time_manila := (timestamp_input AT TIME ZONE 'Asia/Manila')::TIME;

    -- 5. Logic Implementation
    IF status_input = 'TIME_IN' THEN
        final_status := 'Present';
        IF c_start_time IS NOT NULL THEN
            IF current_time_manila > (c_start_time + interval '30 minutes') THEN
                final_status := 'Absent';
            ELSIF current_time_manila > (c_start_time + interval '15 minutes') THEN
                final_status := 'Late';
            END IF;
        END IF;

        INSERT INTO attendance_logs (student_id, user_id, class_id, status, timestamp, time_out)
        VALUES (s_id, u_id, c_id, final_status, timestamp_input, NULL);
        
    ELSIF status_input = 'TIME_OUT' THEN
        SELECT id, status INTO log_id, current_status 
        FROM attendance_logs 
        WHERE student_id = s_id 
          AND class_id = c_id 
          AND (timestamp AT TIME ZONE 'Asia/Manila')::DATE = current_day 
          AND time_out IS NULL
        ORDER BY timestamp DESC LIMIT 1;

        IF log_id IS NOT NULL THEN
            final_status := current_status;
            IF current_status != 'Absent' AND c_end_time IS NOT NULL THEN
                IF (c_end_time - current_time_manila) > interval '15 minutes' THEN
                    final_status := 'Absent';
                ELSIF (current_time_manila - c_end_time) > interval '60 minutes' THEN
                    final_status := 'Absent';
                END IF;
            END IF;
            UPDATE attendance_logs SET time_out = timestamp_input, status = final_status WHERE id = log_id;
        ELSE
            INSERT INTO attendance_logs (student_id, user_id, class_id, status, timestamp, time_out)
            VALUES (s_id, u_id, c_id, 'Absent', timestamp_input, timestamp_input);
            RETURN json_build_object('success', true, 'message', 'Missing Time In - Marked Absent');
        END IF;
    END IF;

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM, 'code', 500);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
