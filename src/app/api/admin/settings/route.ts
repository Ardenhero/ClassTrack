import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/settings — Fetch all system settings
 * PUT /api/admin/settings — Update a system setting
 */
export async function GET() {
    const { data, error } = await supabase
        .from("system_settings")
        .select("key, value, description, updated_at")
        .order("key");

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert array to object for easy lookup
    const settings: Record<string, string> = {};
    for (const row of data || []) {
        settings[row.key] = row.value;
    }

    return NextResponse.json({ settings, rows: data });
}

export async function PUT(req: NextRequest) {
    const body = await req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
        return NextResponse.json({ error: "key and value required" }, { status: 400 });
    }

    const { error } = await supabase
        .from("system_settings")
        .upsert({
            key,
            value: String(value),
            updated_at: new Date().toISOString(),
        }, { onConflict: "key" });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, key, value });
}
