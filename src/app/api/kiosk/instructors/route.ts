import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
        return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // Reuse the same secure RPC to get instructors
    const { data: syncData, error: syncError } = await supabase.rpc('get_sync_data_v2', {
        email_input: email.trim()
    });

    if (syncError) {
        return NextResponse.json({ error: syncError.message }, { status: 500 });
    }

    if (syncData?.error) {
        return NextResponse.json({ error: syncData.error }, { status: 404 });
    }

    // Return just the instructors part
    return NextResponse.json(syncData?.instructors || []);
}
