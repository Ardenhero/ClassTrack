-- Update deletion_requests entity_type constraint to include 'account_deletion'
ALTER TABLE deletion_requests 
DROP CONSTRAINT IF EXISTS deletion_requests_entity_type_check;

ALTER TABLE deletion_requests 
ADD CONSTRAINT deletion_requests_entity_type_check 
CHECK (entity_type IN ('student', 'class', 'account_deletion'));

-- Ensure RLS allows Super Admin to see and update all requests
-- Existing policies may already be broad enough, but let's be explicit
DROP POLICY IF EXISTS "super_admins_manage_deletion_requests" ON deletion_requests;
CREATE POLICY "super_admins_manage_deletion_requests" ON deletion_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND is_super_admin = true)
  );
