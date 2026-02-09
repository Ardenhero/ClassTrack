-- ============================================
-- Account Requests & Approval System
-- ============================================

-- Create table for pending account requests
create table if not exists account_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    email text not null,
    name text not null,
    department_id uuid references departments(id) on delete set null,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references instructors(id) on delete set null
);

-- Enable RLS
alter table account_requests enable row level security;

-- Policies: Users can see their own request, admins can see all
create policy "users_view_own_request" on account_requests
for select to authenticated
using (user_id = auth.uid());

create policy "admins_view_all_requests" on account_requests
for select to authenticated
using (
    exists (select 1 from instructors where auth_user_id = auth.uid() and role = 'admin')
);

create policy "admins_update_requests" on account_requests
for update to authenticated
using (
    exists (select 1 from instructors where auth_user_id = auth.uid() and role = 'admin')
);

-- Allow authenticated users to insert their own request
create policy "users_create_own_request" on account_requests
for insert to authenticated
with check (user_id = auth.uid());

-- Index for faster lookups
create index if not exists idx_account_requests_user_id on account_requests(user_id);
create index if not exists idx_account_requests_status on account_requests(status);

-- ============================================
-- RPC: Approve Account Request
-- ============================================

create or replace function approve_account_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request account_requests%rowtype;
    v_admin_id uuid;
begin
    -- Get admin's instructor ID
    select id into v_admin_id from instructors where auth_user_id = auth.uid() and role = 'admin';
    if v_admin_id is null then
        raise exception 'Access Denied: Only admins can approve requests.';
    end if;

    -- Get the request
    select * into v_request from account_requests where id = p_request_id;
    if v_request.id is null then
        raise exception 'Request not found.';
    end if;

    if v_request.status != 'pending' then
        raise exception 'Request has already been reviewed.';
    end if;

    -- Create the instructor profile linked to the auth user
    insert into instructors (name, department_id, auth_user_id, role)
    values (v_request.name, v_request.department_id, v_request.user_id, 'instructor');

    -- Update request status
    update account_requests
    set status = 'approved', reviewed_at = now(), reviewed_by = v_admin_id
    where id = p_request_id;
end;
$$;

grant execute on function approve_account_request to authenticated;

-- ============================================
-- RPC: Reject Account Request
-- ============================================

create or replace function reject_account_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request account_requests%rowtype;
    v_admin_id uuid;
begin
    -- Get admin's instructor ID
    select id into v_admin_id from instructors where auth_user_id = auth.uid() and role = 'admin';
    if v_admin_id is null then
        raise exception 'Access Denied: Only admins can reject requests.';
    end if;

    -- Get the request
    select * into v_request from account_requests where id = p_request_id;
    if v_request.id is null then
        raise exception 'Request not found.';
    end if;

    if v_request.status != 'pending' then
        raise exception 'Request has already been reviewed.';
    end if;

    -- Update request status
    update account_requests
    set status = 'rejected', reviewed_at = now(), reviewed_by = v_admin_id
    where id = p_request_id;
end;
$$;

grant execute on function reject_account_request to authenticated;
