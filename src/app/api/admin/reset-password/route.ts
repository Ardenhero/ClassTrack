import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

const MONTHLY_LIMIT = 10;

export async function POST(request: NextRequest) {
    try {
        const serverSupabase = createServerClient();
        const cookieStore = cookies();
        const profileId = cookieStore.get("sc_profile_id")?.value;

        if (!profileId) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Verify caller is super admin
        const { data: actor } = await serverSupabase
            .from("instructors")
            .select("id, is_super_admin, auth_user_id")
            .eq("id", profileId)
            .single();

        if (!actor?.is_super_admin) {
            return NextResponse.json({ error: "Forbidden: Super Admin only" }, { status: 403 });
        }

        const { target_user_id, new_password } = await request.json();

        if (!target_user_id || !new_password) {
            return NextResponse.json({ error: "Missing target_user_id or new_password" }, { status: 400 });
        }

        if (new_password.length < 6) {
            return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
        }

        // Check rate limit: count resets in last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { count } = await serverSupabase
            .from("admin_reset_log")
            .select("*", { count: "exact", head: true })
            .eq("actor_id", actor.id)
            .eq("reset_type", "password")
            .gte("created_at", thirtyDaysAgo);

        const used = count || 0;
        if (used >= MONTHLY_LIMIT) {
            return NextResponse.json({
                error: "Monthly reset limit reached (3/3). Try again next cycle.",
                remaining: 0,
                limit: MONTHLY_LIMIT,
            }, { status: 429 });
        }

        // Use service role to reset password
        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
            target_user_id,
            { password: new_password }
        );

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Log the reset
        await serverSupabase.from("admin_reset_log").insert({
            actor_id: actor.id,
            target_id: target_user_id,
            reset_type: "password",
        });

        // Audit log
        await serverSupabase.from("audit_logs").insert({
            actor_id: actor.id,
            action: "password_reset",
            target_type: "user",
            target_id: target_user_id,
            details: { method: "super_admin_reset" },
        });

        return NextResponse.json({
            success: true,
            remaining: MONTHLY_LIMIT - used - 1,
            limit: MONTHLY_LIMIT,
        });
    } catch (err) {
        console.error("Password reset error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
