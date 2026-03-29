-- ============================================
-- FIX: Final Architectural Fix (Visibility & Purified Returns)
-- ============================================

-- 1. CLEANUP: Drop old functions to ensure clean slate
DROP FUNCTION IF EXISTS get_my_students(UUID, TEXT);
DROP FUNCTION IF EXISTS get_student_by_sin_secure(TEXT);

-- 2. SECURE LOOKUP (For Smart Find & Lock)
CREATE OR REPLACE FUNCTION get_student_by_sin_secure(p_sin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', s.id, 
        'name', COALESCE(s.name, ''), 
        'year_level', COALESCE(s.year_level, '')
    )
    INTO result
    FROM students s
    WHERE s.sin = p_sin;
    
    RETURN result; -- Returns null if no match
END;
$$;

-- 3. VISIBILITY RPC (The "Safe JOIN" & "Purified Query")
CREATE OR REPLACE FUNCTION get_my_students(p_instructor_id UUID, p_search_query TEXT DEFAULT '')
RETURNS TABLE (
    id UUID,
    name TEXT,
    sin TEXT,
    year_level TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT 
        s.id, 
        COALESCE(s.name, 'Unknown Student') as name, 
        COALESCE(s.sin, 'N/A') as sin, 
        COALESCE(s.year_level, 'N/A') as year_level,
        s.created_at
    FROM students s
    LEFT JOIN enrollments e ON s.id = e.student_id
    LEFT JOIN classes c ON e.class_id = c.id
    WHERE (
        s.instructor_id = p_instructor_id     -- Case 1: I created the student
        OR c.instructor_id = p_instructor_id  -- Case 2: Student is enrolled in my class (Shared)
    )
    AND (
        p_search_query = '' OR s.name ILIKE '%' || p_search_query || '%'
    )
    ORDER BY name;
END;
$$;

-- 4. PERMISSIONS
GRANT EXECUTE ON FUNCTION get_student_by_sin_secure(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_by_sin_secure(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION get_my_students(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_students(UUID, TEXT) TO service_role;
