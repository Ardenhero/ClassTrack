-- ============================================
-- RPC: Delete Active Instructor Profile
-- ============================================

-- This function allows deleting a specific instructor profile.
-- It performs security checks to prevent unauthorized usage.

create or replace function delete_active_instructor_profile(p_instructor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instructor instructors%ROWTYPE;
begin
  -- Get the instructor profile
  select * into v_instructor
  from instructors
  where id = p_instructor_id;

  if v_instructor.id is null then
    -- Profile not found, consider it done
    return;
  end if;

  -- SECURITY CHECK:
  -- 1. If the profile is linked to an Auth User (auth_user_id IS NOT NULL),
  --    only THAT user can delete it.
  if v_instructor.auth_user_id is not null and v_instructor.auth_user_id != auth.uid() then
    raise exception 'Access Denied: You do not own this profile.';
  end if;

  -- 2. If the profile is UNLINKED (auth_user_id IS NULL),
  --    we assume the caller has "claimed" it via the application logic (cookie/PIN)
  --    and is therefore allowed to delete it.
  --    (This supports the "Select Profile" flow where profiles are created by Admin and unlinked)

  -- Delete cascading data
  delete from students where instructor_id = p_instructor_id;
  delete from classes where instructor_id = p_instructor_id;
  
  -- Delete the profile itself
  delete from instructors where id = p_instructor_id;
end;
$$;

grant execute on function delete_active_instructor_profile to authenticated;
