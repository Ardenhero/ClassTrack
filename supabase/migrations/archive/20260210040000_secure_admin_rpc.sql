-- Migration: Secure Admin RPC Functions
-- Description: Sets SECURITY DEFINER on approval functions to allow Super Admin access regardless of RLS.

-- Drop existing functions first because we are changing return type to JSON
DROP FUNCTION IF EXISTS approve_account_request(UUID);
DROP FUNCTION IF EXISTS reject_account_request(UUID);
DROP FUNCTION IF EXISTS delete_account_request(UUID);

CREATE OR REPLACE FUNCTION approve_account_request(p_request_id UUID)
RETURNS JSON AS $$
DECLARE
    v_request RECORD;
    v_instructor_id uuid;
BEGIN
    IF NOT is_super_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only super admins can approve requests.';
    END IF;

    SELECT * INTO v_request FROM account_requests WHERE id = p_request_id AND status = 'pending';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed.';
    END IF;

    INSERT INTO instructors (
        name, 
        auth_user_id, 
        user_id, 
        owner_id, 
        role, 
        is_super_admin, 
        is_visible_on_kiosk
    )
    VALUES (
        v_request.name, 
        v_request.user_id, 
        v_request.user_id, 
        v_request.user_id, 
        'admin', 
        false, 
        true
    )
    RETURNING id INTO v_instructor_id;

    UPDATE account_requests 
    SET status = 'approved', 
        reviewed_at = now(), 
        reviewed_by = auth.uid() 
    WHERE id = p_request_id;

    RETURN json_build_object('success', true, 'instructor_id', v_instructor_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_account_request(p_request_id UUID)
RETURNS JSON AS $$
BEGIN
    IF NOT is_super_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only super admins can reject requests.';
    END IF;

    UPDATE account_requests 
    SET status = 'rejected', 
        reviewed_at = now(), 
        reviewed_by = auth.uid() 
    WHERE id = p_request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed.';
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_account_request(p_request_id UUID)
RETURNS JSON AS $$
BEGIN
    IF NOT is_super_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only super admins can delete requests.';
    END IF;

    DELETE FROM account_requests WHERE id = p_request_id;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
