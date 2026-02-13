ALTER TABLE evidence_documents 
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;

-- Update existing records if possible (optional, but good for data integrity if we can infer it)
-- For now, new records will be correct.
