-- ============================================
-- FIX: Update Sync Function to Return Instructor ID
-- ============================================

CREATE OR REPLACE FUNCTION get_sync_data_v2(email_input TEXT)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    result JSON;
BEGIN
    -- 1. Get the user ID from the email
    SELECT id INTO user_record FROM auth.users WHERE email = email_input;

    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- 2. Fetch Data (Admins see all, Instructors see theirs)
    -- We simply return ALL data if the user is valid, let the device filter
    -- effectively offline-first. Or we can filter here.
    -- The user wants to filter LOCALLY on device to allow "shared" device usage.
    
    SELECT json_build_object(
        'classes', (
            SELECT json_agg(
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'instructor_id', i.id -- Critical for local filtering
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
                        -- We include specific class names here
                    )
                )
            )
            FROM students s
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
