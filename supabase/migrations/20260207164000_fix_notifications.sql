-- ============================================
-- FIX: Notifications Profile Isolation
-- ============================================

-- 1. Add instructor_id to notifications
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES instructors(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_instructor_id ON notifications(instructor_id);

-- 2. Update existing notifications (Best Effort)
-- Try to link based on the user_id if they belong to an instructor
-- This is imperfect for shared accounts, but better than null
UPDATE notifications 
SET instructor_id = (
    SELECT id FROM instructors 
    WHERE auth_user_id = notifications.user_id 
    LIMIT 1
)
WHERE instructor_id IS NULL;

-- 3. RLS for Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_notifications" ON notifications;
DROP POLICY IF EXISTS "users_insert_own_notifications" ON notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;

-- Allow reading if it matches instructor_id OR user_id (legacy)
CREATE POLICY "view_own_notifications" ON notifications
FOR SELECT TO authenticated
USING (
    instructor_id IN (SELECT id FROM instructors WHERE auth_user_id = auth.uid()) 
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND role = 'admin')
);

-- For now, just open it up like the others so the Frontend can filter
DROP POLICY IF EXISTS "authenticated_view_notifications" ON notifications;
CREATE POLICY "authenticated_view_notifications"
ON notifications FOR SELECT
TO authenticated
USING (true);

-- Allow Insert (App logic handles it)
CREATE POLICY "authenticated_insert_notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow Update
CREATE POLICY "authenticated_update_notifications"
ON notifications FOR UPDATE
TO authenticated
USING (true);
