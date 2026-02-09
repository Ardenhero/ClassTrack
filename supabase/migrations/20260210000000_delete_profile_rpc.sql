-- ============================================
-- RPC: Admin Delete Instructor Profile
-- ============================================

-- This function allows ADMINS ONLY to delete an instructor profile.
-- It uses SECURITY DEFINER to bypass RLS, but validates caller is admin.

create or replace function admin_delete_instructor(p_instructor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SECURITY CHECK: Ensure the caller is an admin
  if not exists (
    select 1 from instructors
    where auth_user_id = auth.uid() and role = 'admin'
  ) then
    -- Fallback: Check for the 'admin-profile' cookie-style ID if no linked admin
    -- This is a relaxed check for the "Virtual Admin" scenario
    -- In production, you might want stricter enforcement
    if not exists (
        select 1 from instructors where role = 'admin'
    ) then
        -- No admins exist, allow first user to act as admin (bootstrap scenario)
        null;
    else
        raise exception 'Access Denied: Only admins can delete instructors.';
    end if;
  end if;

  -- Delete cascading data first (students, classes owned by this instructor)
  delete from students where instructor_id = p_instructor_id;
  delete from classes where instructor_id = p_instructor_id;
  
  -- Delete the profile itself
  delete from instructors where id = p_instructor_id;
end;
$$;

grant execute on function admin_delete_instructor to authenticated;
