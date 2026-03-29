-- Make Rooms Global (Shared Resource Model)
-- Migration: 20260322140000_global_rooms.sql

-- 1. Remove department_id constraint and column from rooms
-- First check if there are any dependent views or functions (usually not in this schema)
ALTER TABLE public.rooms DROP COLUMN IF EXISTS department_id;

-- 2. Update RLS policies for rooms
-- We want rooms to be visible to:
--   a) Super Admins (all rooms)
--   b) Instructors/Admins whose ID is in the rooms (Wait, rooms don't have assigned IDs, Instructors have assigned_room_ids)

DROP POLICY IF EXISTS "Rooms are viewable by everyone" ON public.rooms;
DROP POLICY IF EXISTS "Rooms are manageable by super admins" ON public.rooms;

-- Policy: Everyone can view rooms (for scheduling/browsing)
CREATE POLICY "Rooms are viewable by authenticated users" 
ON public.rooms FOR SELECT 
TO authenticated 
USING (true);

-- Policy: Only Super Admins can Insert/Update/Delete rooms
CREATE POLICY "Rooms are manageable by super admins only" 
ON public.rooms FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (is_super_admin = true OR role = 'super_admin')
  )
);

-- Note: We already have assigned_room_ids in the instructors table from a previous migration.
-- We will use that for UI-level filtering to show only "Your Rooms".
