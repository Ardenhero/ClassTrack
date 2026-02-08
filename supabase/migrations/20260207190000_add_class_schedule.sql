-- Add schedule columns to classes table
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS start_time TIME WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS end_time TIME WITHOUT TIME ZONE;

-- Add comment
COMMENT ON COLUMN classes.start_time IS 'Class start time for grading logic';
COMMENT ON COLUMN classes.end_time IS 'Class end time for grading logic';
