import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

const MONTHLY_LIMIT = 10;

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();
        const cookieStore = cookies();
        const profileId = cookieStore.get("sc_profile_id")?.value;

        if (!profileId) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Verify caller is admin (regular or super)
        const { data: actor } = await supabase
            .from("instructors")
            .select("id, role, is_super_admin")
            .eq("id", profileId)
            .single();

        if (!actor || actor.role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
        }

        const { target_instructor_id, new_pin } = await request.json();

        if (!target_instructor_id || !new_pin) {
            return NextResponse.json({ error: "Missing target_instructor_id or new_pin" }, { status: 400 });
        }

        if (!/^\d{4}$/.test(new_pin)) {
            return NextResponse.json({ error: "PIN must be exactly 4 digits" }, { status: 400 });
        }

        // Check rate limit: count resets in last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
            .from("admin_reset_log")
            .select("*", { count: "exact", head: true })
            .eq("actor_id", actor.id)
            .eq("reset_type", "pin")
            .gte("created_at", thirtyDaysAgo);

        const used = count || 0;
        if (used >= MONTHLY_LIMIT) {
            return NextResponse.json({
                error: "Monthly PIN reset limit reached (3/3). Try again next cycle.",
                remaining: 0,
                limit: MONTHLY_LIMIT,
            }, { status: 429 });
        }

        // Get the target instructor's auth_user_id for the instructor_pins table
        const { data: target } = await supabase
            .from("instructors")
            .select("id, auth_user_id, name")
            .eq("id", target_instructor_id)
            .single();

        if (!target || !target.auth_user_id) {
            return NextResponse.json({ error: "Instructor not found or has no linked account" }, { status: 404 });
        }

        // Update the PIN — store as plain text in pin_code column on instructors (matching existing pattern)
        await supabase
            .from("instructors")
            .update({ pin_code: new_pin, pin_enabled: true })
            .eq("id", target_instructor_id);

        // Also upsert instructor_pins (hashed or plain, matching existing system)
        await supabase
            .from("instructor_pins")
            .upsert({
                user_id: target.auth_user_id,
                pin_hash: new_pin,
                updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });

        // Log the reset
        await supabase.from("admin_reset_log").insert({
            actor_id: actor.id,
            target_id: target_instructor_id,
            reset_type: "pin",
        });

        // Audit log
        await supabase.from("audit_logs").insert({
            actor_id: actor.id,
            action: "pin_reset",
            target_type: "instructor",
            target_id: target_instructor_id,
            details: { target_name: target.name },
        });

        return NextResponse.json({
            success: true,
            remaining: MONTHLY_LIMIT - used - 1,
            limit: MONTHLY_LIMIT,
        });
    } catch (err) {
        console.error("PIN reset error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
