-- Migration: Add Audit Logs and Department Status
-- Description: Creates the audit_logs infrastructure and adds is_active to departments.

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.instructors(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add status to departments
ALTER TABLE public.departments 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 3. Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Only Super Admins can READ all logs
CREATE POLICY "Super Admins can read all audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (is_super_admin());

-- 5. Helper function for logging actions
CREATE OR REPLACE FUNCTION log_action(
    p_action TEXT,
    p_target_type TEXT,
    p_target_id UUID,
    p_details JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
DECLARE
    v_actor_id UUID;
BEGIN
    SELECT id INTO v_actor_id FROM public.instructors WHERE auth_user_id = auth.uid();
    
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, details)
    VALUES (v_actor_id, p_action, p_target_type, p_target_id, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
