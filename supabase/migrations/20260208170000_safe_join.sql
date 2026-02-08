-- ============================================
-- FIX: Safe JOIN & Robust Visibility
-- ============================================

-- 1. Updated get_my_students with COALESCE and Safe Logic
CREATE OR REPLACE FUNCTION get_my_students(p_instructor_id UUID, p_search_query TEXT DEFAULT '')
RETURNS SETOF students
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT 
        s.id, 
        s.created_at, 
        COALESCE(s.name, 'Unknown Student') as name, 
        s.sin, 
        s.rfid_uid, 
        s.image_url, 
        s.instructor_id, 
        COALESCE(s.year_level, 'N/A') as year_level,
        s.section,
        s.student_id, -- legacy field if present
        s.grade_level, -- legacy field if present
        s.fingerprint_id -- legacy field if present
    FROM students s
    LEFT JOIN enrollments e ON s.id = e.student_id
    LEFT JOIN classes c ON e.class_id = c.id
    WHERE (
        s.instructor_id = p_instructor_id     -- Created by me (Owner)
        OR c.instructor_id = p_instructor_id  -- Enrolled in my class (Viewer)
    )
    AND (
        p_search_query = '' OR s.name ILIKE '%' || p_search_query || '%'
    )
    ORDER BY name;
END;
$$;

-- 2. Verify Enrollments Indices (Performance)
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class_id ON enrollments(class_id);
