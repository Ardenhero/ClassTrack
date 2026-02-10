-- Final fix for foreign key constraint errors during user deletion
-- Addressing owner_id references in instructors and departments

-- 1. instructors.owner_id
ALTER TABLE public.instructors
DROP CONSTRAINT IF EXISTS instructors_owner_id_fkey,
ADD CONSTRAINT instructors_owner_id_fkey
FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. departments.owner_id
ALTER TABLE public.departments
DROP CONSTRAINT IF EXISTS departments_owner_id_fkey,
ADD CONSTRAINT departments_owner_id_fkey
FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
