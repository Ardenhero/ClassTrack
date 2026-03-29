-- ============================================================================
-- Student Authentication Upgrade
-- Add password_hash column to students table and secure access.
-- ============================================================================

DO $$
BEGIN
    -- 1. Add password_hash column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'password_hash') THEN
        ALTER TABLE students ADD COLUMN password_hash TEXT;
    END IF;

    -- 2. Ensure index on sin for fast lookups
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'students' AND indexname = 'idx_students_sin') THEN
        CREATE INDEX idx_students_sin ON students(sin);
    END IF;

END $$;

-- 3. Update existing students to have their SIN as the initial password_hash (as per requirement)
-- NOTE: In a real app, we'd hash this. For now, since we'll implement scrypt hashing in server actions,
-- we can either leave it null and handle "first login" or pre-hash them.
-- The requirement says "default password should be the student's SIN".
-- We will handle this in the login logic: if password_hash is null and input matches SIN, we hash it on the fly.
