"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveRequest(requestId: string) {
    const supabase = createClient();

    const { error } = await supabase.rpc("approve_account_request", {
        p_request_id: requestId
    });

    if (error) {
        console.error("Error approving request:", error);
        return { error: error.message };
    }

    revalidatePath("/dashboard/admin/approvals");
    return { success: true };
}

export async function rejectRequest(requestId: string) {
    const supabase = createClient();

    const { error } = await supabase.rpc("reject_account_request", {
        p_request_id: requestId
    });

    if (error) {
        console.error("Error rejecting request:", error);
        return { error: error.message };
    }

    revalidatePath("/dashboard/admin/approvals");
    return { success: true };
}
