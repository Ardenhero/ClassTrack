-- ============================================
-- FIX: Remove fingerprint_id Ghost Column
-- Date: 2026-02-08
-- ============================================

-- STEP 1: Drop fingerprint_id column if it exists (safe operation)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'students' 
        AND column_name = 'fingerprint_id'
    ) THEN
        ALTER TABLE students DROP COLUMN fingerprint_id;
        RAISE NOTICE 'Dropped fingerprint_id column from students table';
    ELSE
        RAISE NOTICE 'fingerprint_id column does not exist - no action needed';
    END IF;
END $$;

-- STEP 2: Verify students table structure
-- Expected columns: id, name, sin, year_level, instructor_id, created_at, updated_at
DO $$
DECLARE
    col_count INT;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'students'
    AND column_name IN ('id', 'name', 'sin', 'year_level', 'instructor_id', 'created_at', 'updated_at');
    
    IF col_count < 5 THEN
        RAISE WARNING 'Students table may be missing expected columns. Found % expected columns.', col_count;
    ELSE
        RAISE NOTICE 'Students table structure verified - % expected columns present', col_count;
    END IF;
END $$;

-- STEP 3: Add helpful comment to the table
COMMENT ON TABLE students IS 'Student registry with enrollment-based visibility. NO fingerprint_id - removed 2026-02-08.';
