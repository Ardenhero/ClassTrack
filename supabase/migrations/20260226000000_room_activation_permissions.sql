-- Migration: Add room activation permission columns to instructors
-- These control who can activate room devices (IoT) via the web dashboard

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS can_activate_room BOOLEAN DEFAULT false;
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS can_activate_outside_schedule BOOLEAN DEFAULT false;
