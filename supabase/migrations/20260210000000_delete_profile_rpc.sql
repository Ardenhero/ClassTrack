-- ============================================
-- RPC: Delete Own Instructor Profile
-- ============================================

create or replace function delete_own_instructor_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instructor_id uuid;
begin
  select id into v_instructor_id
  from instructors
  where auth_user_id = auth.uid();

  if v_instructor_id is null then
    return;
  end if;

  delete from students where instructor_id = v_instructor_id;
  delete from classes where instructor_id = v_instructor_id;
  delete from instructors where id = v_instructor_id;
end;
$$;

grant execute on function delete_own_instructor_profile to authenticated;
