-- =====================================================
-- Add Fingerprint Lock capability
-- =====================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS fingerprint_locked BOOLEAN DEFAULT false;
