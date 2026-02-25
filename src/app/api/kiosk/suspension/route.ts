import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/kiosk/suspension?class_id=XXX&date=YYYY-MM-DD
 * 
 * Called by ESP32 after class selection to check if the class is suspended today.
 * Uses the existing `class_day_overrides` table (populated by DeclareSuspensionsButton
 * and MarkNoClassButton on the website).
 * 
 * Returns: { suspended: boolean, reason?: string }
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("class_id");
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

    if (!classId) {
        return NextResponse.json({ error: "class_id required" }, { status: 400 });
    }

    // Check for class-specific suspension on this date
    const { data: overrides } = await supabase
        .from("class_day_overrides")
        .select("id, type, note")
        .eq("class_id", classId)
        .eq("date", date)
        .limit(1);

    if (overrides && overrides.length > 0) {
        const override = overrides[0];
        const reason = override.note || override.type || "No Class";
        return NextResponse.json({
            suspended: true,
            reason
        });
    }

    return NextResponse.json({ suspended: false });
}
