-- Function to recover orphaned data (instructors = null)
-- and assign it to a target profile ID.

create or replace function assign_orphaned_data(target_profile_id uuid)
returns void as $$
begin
  -- 1. Update Students
  update students
  set instructor_id = target_profile_id
  where instructor_id is null;

  -- 2. Update Classes
  update classes
  set instructor_id = target_profile_id
  where instructor_id is null;
  
  -- 3. Note: We don't strictly need to update attendance_logs if they join via classes,
  -- but if you have a direct link, you might want to. 
  -- Typically attendance_logs are linked to classes, so updating classes fixes the visibility.
end;
$$ language plpgsql;
