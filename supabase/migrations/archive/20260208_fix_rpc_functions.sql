-- ============================================
-- HOTFIX: Fix get_my_students RPC Function
-- Date: 2026-02-08
-- Issue: "Failed to load students" error
-- ============================================

-- STEP 1: Drop existing functions to ensure clean slate
DROP FUNCTION IF EXISTS get_my_students(UUID, TEXT);
DROP FUNCTION IF EXISTS get_student_by_sin_secure(TEXT);

-- STEP 2: Recreate get_student_by_sin_secure (for SIN lookup)
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
    ) INTO result
    FROM students s
    WHERE s.sin = p_sin;

    RETURN result; -- Returns null if no match
END;
$$;

-- STEP 3: Recreate get_my_students with proper return structure
CREATE OR REPLACE FUNCTION get_my_students(
    p_instructor_id UUID, 
    p_search_query TEXT DEFAULT ''
)
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
        -- Case 1: I created the student
        s.instructor_id = p_instructor_id
        OR
        -- Case 2: Student is enrolled in my class
        c.instructor_id = p_instructor_id
    )
    AND (
        -- Search filter
        p_search_query = '' 
        OR s.name ILIKE '%' || p_search_query || '%'
    )
    ORDER BY name;
END;
$$;

-- STEP 4: Grant permissions
GRANT EXECUTE ON FUNCTION get_student_by_sin_secure(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_by_sin_secure(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION get_my_students(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_students(UUID, TEXT) TO service_role;

-- STEP 5: Test the function (optional - for verification)
-- You can run this query manually to test:
-- SELECT * FROM get_my_students('your-instructor-uuid', '');

-- STEP 6: Add helpful comments
COMMENT ON FUNCTION get_my_students(UUID, TEXT) IS 
'Returns students visible to an instructor: either created by them OR enrolled in their classes. 
Does NOT return fingerprint_id - that column has been removed.';

COMMENT ON FUNCTION get_student_by_sin_secure(TEXT) IS 
'Secure lookup of student by SIN for the add student form. Bypasses RLS for read-only lookup.';
