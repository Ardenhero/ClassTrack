-- =====================================================
-- Feature Additions Migration
-- deletion_requests, class_day_overrides
-- =====================================================

-- 1. Deletion Requests (Instructor → Admin approval for permanent deletion)
-- (Re-created here as standalone to fix migration parse error)
CREATE TABLE IF NOT EXISTS deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('student', 'class')),
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES instructors(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

-- Drop policy first if it already exists (idempotent)
DO $$ BEGIN
  DROP POLICY IF EXISTS "authenticated_access_deletion_requests" ON deletion_requests;
END $$;

CREATE POLICY "authenticated_access_deletion_requests" ON deletion_requests
  FOR ALL USING (auth.role() = 'authenticated');

-- 2. Class Day Overrides (Holiday / No-Class / Makeup markers)
CREATE TABLE IF NOT EXISTS class_day_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('holiday', 'cancelled', 'makeup', 'suspended')),
  note TEXT,
  created_by UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, date)  -- One override per class per day
);

ALTER TABLE class_day_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_access_class_day_overrides" ON class_day_overrides
  FOR ALL USING (auth.role() = 'authenticated');

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_class_day_overrides_lookup
  ON class_day_overrides(class_id, date);
