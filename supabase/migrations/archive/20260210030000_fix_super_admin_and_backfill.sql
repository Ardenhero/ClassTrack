-- Migration: Correct Super Admin Assignment
-- Description: Demotes System Admin and promotes Arden Hero to Super Admin.

-- 1. Remove Super Admin status from System Admin
UPDATE public.instructors 
SET is_super_admin = false 
WHERE name = 'System Admin';

-- 2. Grant Super Admin status to Arden Hero
UPDATE public.instructors 
SET is_super_admin = true 
WHERE name ILIKE '%Arden Hero%';
