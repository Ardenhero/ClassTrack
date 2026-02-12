-- ============================================
-- FIX: Final RPC Cleanup (No Fingerprint ID)
-- ============================================

-- Switch from SETOF students to RETURNS TABLE to avoid schema mismatch
DROP FUNCTION IF EXISTS get_my_students(UUID, TEXT);

CREATE OR REPLACE FUNCTION get_my_students(p_instructor_id UUID, p_search_query TEXT DEFAULT '')
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMPTZ,
    name TEXT,
    sin TEXT,
    year_level TEXT,
    image_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT 
        s.id, 
        s.created_at, 
        COALESCE(s.name, 'Unknown Student') as name, 
        COALESCE(s.sin, 'N/A') as sin, 
        COALESCE(s.year_level, 'N/A') as year_level,
        s.image_url
    FROM students s
    LEFT JOIN enrollments e ON s.id = e.student_id
    LEFT JOIN classes c ON e.class_id = c.id
    WHERE (
        s.instructor_id = p_instructor_id     
        OR c.instructor_id = p_instructor_id  
    )
    AND (
        p_search_query = '' OR s.name ILIKE '%' || p_search_query || '%'
    )
    ORDER BY name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_students(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_students(UUID, TEXT) TO service_role;
