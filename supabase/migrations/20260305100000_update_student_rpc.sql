-- ============================================
-- Update get_student_by_sin_secure RPC to include guardian fields
-- ============================================

DROP FUNCTION IF EXISTS get_student_by_sin_secure(TEXT);

CREATE OR REPLACE FUNCTION get_student_by_sin_secure(p_sin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', s.id,
        'name', s.name,
        'year_level', s.year_level,
        'department', s.department,
        'guardian_name', s.guardian_name,
        'guardian_email', s.guardian_email
    ) INTO result
    FROM students s
    WHERE s.sin = p_sin
    AND (s.is_archived IS NULL OR s.is_archived = false)
    LIMIT 1;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_student_by_sin_secure(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_by_sin_secure(TEXT) TO service_role;
