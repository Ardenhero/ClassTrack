-- Fix for foreign key constraint errors during user deletion
ALTER TABLE public.room_settings 
DROP CONSTRAINT IF EXISTS room_settings_user_id_fkey,
ADD CONSTRAINT room_settings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.instructor_pins
DROP CONSTRAINT IF EXISTS instructor_pins_user_id_fkey,
ADD CONSTRAINT instructor_pins_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey,
ADD CONSTRAINT notifications_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.account_requests
DROP CONSTRAINT IF EXISTS account_requests_user_id_fkey,
ADD CONSTRAINT account_requests_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Also add cascade to instructors to ensure clean removal
ALTER TABLE public.instructors
DROP CONSTRAINT IF EXISTS instructors_user_id_fkey,
ADD CONSTRAINT instructors_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.instructors
DROP CONSTRAINT IF EXISTS instructors_auth_user_id_fkey,
ADD CONSTRAINT instructors_auth_user_id_fkey
FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
