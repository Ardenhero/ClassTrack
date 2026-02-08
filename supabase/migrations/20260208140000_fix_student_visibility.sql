-- ============================================
-- FIX: Student Visibility & Upsert Logic
-- ============================================

-- 1. Secure Lookup for "Find or Create" logic (Bypassing RLS)
-- Changing to RETURNS JSON to avoid "structure of query does not match function result type" (42804)
DROP FUNCTION IF EXISTS get_student_by_sin_secure(TEXT);

CREATE OR REPLACE FUNCTION get_student_by_sin_secure(p_sin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object('id', s.id, 'name', s.name)
    INTO result
    FROM students s
    WHERE s.sin = p_sin;
    
    RETURN result; -- Returns null if no match
END;
$$;

-- 2. Unified Visibility for Instructors (Created + Enrolled)
CREATE OR REPLACE FUNCTION get_my_students(p_instructor_id UUID, p_search_query TEXT DEFAULT '')
RETURNS SETOF students
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT s.*
    FROM students s
    LEFT JOIN enrollments e ON s.id = e.student_id
    LEFT JOIN classes c ON e.class_id = c.id
    WHERE (
        s.instructor_id = p_instructor_id     -- Created by me
        OR c.instructor_id = p_instructor_id  -- Enrolled in my class
    )
    AND (
        p_search_query = '' OR s.name ILIKE '%' || p_search_query || '%'
    )
    ORDER BY s.name;
END;
$$;

-- 3. Explicit Permissions (Crucial for execution)
GRANT EXECUTE ON FUNCTION get_student_by_sin_secure(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_by_sin_secure(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION get_my_students(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_students(UUID, TEXT) TO service_role;
