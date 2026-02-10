-- Migration: Final Fix for Approval Actions
-- Description: Maps reviewed_by to instructor_id and renames Super Admin to Arden Hero.

-- 1. Rename Admin
UPDATE public.instructors 
SET name = 'Arden Hero' 
WHERE auth_user_id = '0db12eb7-735d-4713-aed0-5f962543bdc2';

-- 2. Downgrade others
UPDATE public.instructors 
SET is_super_admin = false 
WHERE auth_user_id != '0db12eb7-735d-4713-aed0-5f962543bdc2';

-- 3. Correct RPCs
CREATE OR REPLACE FUNCTION approve_account_request(p_request_id UUID)
RETURNS JSON AS $$
DECLARE
    v_request RECORD;
    v_instructor_id uuid;
    v_reviewer_id uuid;
BEGIN
    SELECT id INTO v_reviewer_id FROM public.instructors WHERE auth_user_id = auth.uid();
    
    IF NOT is_super_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only super admins can approve requests.';
    END IF;

    SELECT * INTO v_request FROM account_requests WHERE id = p_request_id AND status = 'pending';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed.';
    END IF;

    INSERT INTO instructors (name, auth_user_id, user_id, owner_id, role, is_super_admin, is_visible_on_kiosk)
    VALUES (v_request.name, v_request.user_id, v_request.user_id, v_request.user_id, 'admin', false, true)
    RETURNING id INTO v_instructor_id;

    UPDATE account_requests 
    SET status = 'approved', reviewed_at = now(), reviewed_by = v_reviewer_id 
    WHERE id = p_request_id;

    RETURN json_build_object('success', true, 'instructor_id', v_instructor_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_account_request(p_request_id UUID)
RETURNS JSON AS $$
DECLARE
    v_reviewer_id uuid;
BEGIN
    SELECT id INTO v_reviewer_id FROM public.instructors WHERE auth_user_id = auth.uid();
    IF NOT is_super_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only super admins can reject requests.';
    END IF;

    UPDATE account_requests 
    SET status = 'rejected', reviewed_at = now(), reviewed_by = v_reviewer_id 
    WHERE id = p_request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed.';
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
