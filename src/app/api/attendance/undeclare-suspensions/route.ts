import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();
        const cookieStore = cookies();
        const profileId = cookieStore.get("sc_profile_id")?.value;

        if (!profileId) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Verify caller is admin or super admin
        const { data: profile } = await supabase
            .from("instructors")
            .select("role, is_super_admin")
            .eq("id", profileId)
            .single();

        if (!profile || (profile.role !== "admin" && !profile.is_super_admin)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = await request.json();
        const { date, classId } = body;

        if (!date) {
            return NextResponse.json({ error: "Date is required" }, { status: 400 });
        }

        let query = supabase.from("class_day_overrides").delete().eq("date", date);

        if (classId) {
            // Revert for a specific class
            query = query.eq("class_id", classId);
        } else {
            // Revert globally for all classes that day (typical during system-wide reversals)
            // Or alternatively, only those created by the system vs a specific instructor if needed
        }

        const { error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Audit log
        await supabase.from("audit_logs").insert({
            actor_id: profileId,
            action: classId ? "suspension_reverted_class" : "suspension_reverted_system",
            target_type: "system",
            target_id: date,
            details: { date, classId },
        });

        return NextResponse.json({ success: true, message: "Suspension reverted successfully" });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
