import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = createClient();
    const results = [];

    // 1. Force Clear Arden Hero PIN
    const { data: arden, error: ardenError } = await supabase
        .from('instructors')
        .update({ pin_code: null, pin_enabled: false })
        .ilike('name', '%Arden hero%')
        .select();

    results.push({
        task: "Clear Arden Hero PIN",
        success: !ardenError,
        details: arden,
        error: ardenError
    });

    // 2. Clear PIN for any profile named "System Admin" (optional cleanup)
    // checking if we need to reset admin too? No, user wants to set it manually.

    return NextResponse.json({ results });
}
