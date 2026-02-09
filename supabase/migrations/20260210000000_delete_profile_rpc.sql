-- ============================================
-- RPC: Delete Active Instructor Profile
-- ============================================

create or replace function delete_active_instructor_profile(p_instructor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instructor instructors%ROWTYPE;
begin
  select * into v_instructor
  from instructors
  where id = p_instructor_id;

  if v_instructor.id is null then
    return;
  end if;

  if v_instructor.auth_user_id is not null and v_instructor.auth_user_id != auth.uid() then
    raise exception 'Access Denied: You do not own this profile.';
  end if;

  delete from students where instructor_id = p_instructor_id;
  delete from classes where instructor_id = p_instructor_id;
  delete from instructors where id = p_instructor_id;
end;
$$;

grant execute on function delete_active_instructor_profile to authenticated;
