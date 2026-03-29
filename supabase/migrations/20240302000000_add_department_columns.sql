-- ============================================
-- Add department columns to students and classes
-- ============================================

-- 1. Students: department TEXT (e.g. "BSIT", "BSCS")
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS department TEXT;

-- 2. Classes: department TEXT
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS department TEXT;

-- 3. Classes: schedule_days TEXT (comma-separated: "Mon,Wed,Fri")
-- Note: day_of_week already exists but is per-row. schedule_days stores the
-- full weekly schedule as a single comma-separated string.
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS schedule_days TEXT;

-- 4. Update the secure RPC to include department in output
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
        'department', s.department
    ) INTO result
    FROM students s
    WHERE s.sin = p_sin
    AND (s.is_archived IS NULL OR s.is_archived = false)
    LIMIT 1;

    RETURN result;
END;
$$;
