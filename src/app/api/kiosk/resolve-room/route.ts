import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const name = searchParams.get("name");

        if (!name) {
            return NextResponse.json({ error: "Room name is required" }, { status: 400 });
        }

        // Find room by exact or case-insensitive name match
        const { data, error } = await supabase
            .from("rooms")
            .select("id, name, building")
            .ilike("name", name.trim())
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("[Resolve Room] DB Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({ error: "Room not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            room_id: data.id,
            name: data.name,
            building: data.building
        });

    } catch (err) {
        console.error("[Resolve Room] Error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
