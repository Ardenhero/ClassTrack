-- Migration: Fix Super Admin Power and Backfill Requests
-- Description: Sets is_super_admin to true for System Admin and backfills account_requests for orphaned users.

-- 1. Grant Super Admin status to the main admin account
UPDATE public.instructors 
SET is_super_admin = true 
WHERE name = 'System Admin';

-- 2. Backfill account_requests for users who are stuck in "pending"
INSERT INTO public.account_requests (user_id, email, name, status, created_at)
SELECT 
    u.id, 
    u.email, 
    COALESCE(split_part(u.email, '@', 1), 'User') as name, 
    'pending' as status,
    u.created_at
FROM auth.users u
LEFT JOIN public.instructors i ON u.id = i.auth_user_id
LEFT JOIN public.account_requests ar ON u.id = ar.user_id
WHERE i.id IS NULL 
  AND ar.id IS NULL
  AND u.email != 'admin@engineering.edu';
