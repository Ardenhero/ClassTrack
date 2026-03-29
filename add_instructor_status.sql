-- Adding is_active column to instructors for self-service deactivation
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Ensure existing profile_deactivation requests are handled as profile_deletion if necessary,
-- or just keep them as separate entity_types.
-- The user mentioned the approval didn't delete the profile, 
-- we will update the code to handle 'profile_deletion' type.
