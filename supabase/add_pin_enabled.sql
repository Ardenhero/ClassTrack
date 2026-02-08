-- Add pin_enabled column to instructors table
ALTER TABLE instructors 
ADD COLUMN IF NOT EXISTS pin_enabled boolean DEFAULT false;

-- Update existing instructors to have pin_enabled = true if they have a pin_code
UPDATE instructors 
SET pin_enabled = true 
WHERE pin_code IS NOT NULL AND pin_code != '';
