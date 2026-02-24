-- =================================================================
-- Fix Class Day Overrides Type Check Constraint
-- =================================================================

-- Drop the existing tight constraint
ALTER TABLE class_day_overrides DROP CONSTRAINT IF EXISTS class_day_overrides_type_check;

-- Add the new constraint including 'weather' and 'university' overrides from the Admin Suspensions UI
ALTER TABLE class_day_overrides ADD CONSTRAINT class_day_overrides_type_check 
CHECK (type IN ('holiday', 'cancelled', 'makeup', 'suspended', 'weather', 'university'));
