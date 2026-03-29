"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function getSINChangeRequests() {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("sin_change_requests")
        .select(`
            *,
            students (name, sin),
            requester:requested_by (name),
            reviewer:reviewed_by (name)
        `)
        .order("created_at", { ascending: false });

    if (error) return { error: error.message };
    return { data };
}

export async function reviewSINRequest(requestId: string, action: "approved" | "rejected") {
    const supabase = createClient();

    // Get current user's instructor profile for reviewer
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: reviewer } = await supabase
        .from("instructors")
        .select("id, is_super_admin")
        .eq("auth_user_id", user.id)
        .single();

    if (!reviewer?.is_super_admin) return { error: "Only Super Admins can review SIN change requests." };

    // Get the request
    const { data: request, error: fetchErr } = await supabase
        .from("sin_change_requests")
        .select("*")
        .eq("id", requestId)
        .single();

    if (fetchErr || !request) return { error: "Request not found." };
    if (request.status !== "pending") return { error: "Request already reviewed." };

    // Update request status
    const { error: updateErr } = await supabase
        .from("sin_change_requests")
        .update({
            status: action,
            reviewed_by: reviewer.id,
            reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

    if (updateErr) return { error: updateErr.message };

    // If approved, update the student's SIN
    if (action === "approved") {
        const { error: sinErr } = await supabase
            .from("students")
            .update({ sin: request.new_sin })
            .eq("id", request.student_id);

        if (sinErr) return { error: `Approved but failed to update SIN: ${sinErr.message}` };
    }

    // Log to audit
    await supabase.from("audit_logs").insert({
        action: `sin_change_${action}`,
        entity_type: "student",
        entity_id: request.student_id,
        details: `SIN change ${action}: ${request.current_sin} → ${request.new_sin}`,
        performed_by: user.id,
    });

    revalidatePath("/dashboard/admin/approval-inbox");
    return { success: true };
}

export async function requestSINChange(studentId: string, currentSin: string, newSin: string, reason: string) {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: profile } = await supabase
        .from("instructors")
        .select("id, role")
        .eq("auth_user_id", user.id)
        .single();

    if (!profile || profile.role !== "admin") return { error: "Only System Admins can request SIN changes." };

    // Validate new SIN format
    if (!/^\d{2}-\d{5,6}$/.test(newSin)) return { error: "Invalid SIN format. Use YY-XXXXX." };

    const { error } = await supabase.from("sin_change_requests").insert({
        student_id: studentId,
        requested_by: profile.id,
        current_sin: currentSin,
        new_sin: newSin,
        reason: reason,
    });

    if (error) return { error: error.message };

    // Log to audit
    await supabase.from("audit_logs").insert({
        action: "sin_change_requested",
        entity_type: "student",
        entity_id: studentId,
        details: `SIN change requested: ${currentSin} → ${newSin} (Reason: ${reason})`,
        performed_by: user.id,
    });

    revalidatePath("/dashboard/admin/approval-inbox");
    return { success: true };
}
