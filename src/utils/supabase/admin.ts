import { createClient } from '@supabase/supabase-js'

/**
 * Super Admin Client
 * Used for administrative tasks that require bypass of RLS (service_role)
 * such as creating users in auth.users or managing tenant metadata.
 */
export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase admin credentials missing from environment');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}
