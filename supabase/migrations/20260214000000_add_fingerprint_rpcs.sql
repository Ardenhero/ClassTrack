
-- ============================================
-- ADD: Fingerprint RPC Functions
-- ============================================

-- 1. get_unenrolled_students
-- Returns students who do not have a fingerprint registered yet (fingerprint_slot_id IS NULL)
DROP FUNCTION IF EXISTS get_unenrolled_students();
CREATE OR REPLACE FUNCTION get_unenrolled_students()
RETURNS SETOF students
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM students WHERE fingerprint_slot_id IS NULL OR fingerprint_slot_id = 0 ORDER BY name ASC;
$$;

-- 2. link_fingerprint
-- Links a fingerprint slot ID to a student
DROP FUNCTION IF EXISTS link_fingerprint(BIGINT, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION link_fingerprint(p_student_id BIGINT, p_slot_id INTEGER, p_device_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if slot is already taken by ANOTHER student
  IF EXISTS (SELECT 1 FROM students WHERE fingerprint_slot_id = p_slot_id AND id != p_student_id) THEN
    RAISE EXCEPTION 'Slot ID % is already assigned to another student.', p_slot_id;
  END IF;

  -- Update the student record
  UPDATE students 
  SET fingerprint_slot_id = p_slot_id,
      device_id = p_device_id
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student with ID % not found.', p_student_id;
  END IF;
END;
$$;
