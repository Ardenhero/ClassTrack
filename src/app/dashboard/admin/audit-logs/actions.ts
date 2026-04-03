"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Bulk delete audit logs
 * Super Admin only (enforced by RLS and manual check)
 */
export async function bulkDeleteAuditLogs(logIds: string[]) {
    if (!logIds || logIds.length === 0) return { error: "No logs selected" };

    const supabase = createClient();
    
    // Verify Super Admin status
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
        .from("instructors")
        .select("is_super_admin")
        .eq("auth_user_id", user.id)
        .single();

    if (!profile?.is_super_admin) {
        return { error: "Forbidden: Super Admin only" };
    }

    // Use Admin Client to bypass RLS for administrative deletion
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
        .from("audit_logs")
        .delete()
        .in("id", logIds);

    if (error) {
        console.error("[BulkDeleteLogs] Error:", error);
        return { error: error.message };
    }

    revalidatePath("/dashboard/admin/audit-logs");
    return { success: true };
}
