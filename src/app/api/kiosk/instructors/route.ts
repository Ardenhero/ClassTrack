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

    const trimmedEmail = email.trim();

    // 1. Get the owner_id from the email
    const { data: userData } = await supabase
        .from('instructors')
        .select('owner_id')
        .eq('email', trimmedEmail)
        .limit(1)
        .maybeSingle();

    const ownerId = userData?.owner_id;

    if (!ownerId) {
        return NextResponse.json({ error: "Account not found for this email" }, { status: 404 });
    }

    const { data, error } = await supabase
        .from("instructors")
        .select(`
            id, 
            name,
            departments (
                code
            )
        `)
        .eq("owner_id", ownerId)
        .eq("is_visible_on_kiosk", true)
        .order("name", { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten logic for ESP32 easy parsing
    const flattened = data.map((i) => ({
        id: i.id,
        name: i.name,
        department_code: (i.departments as unknown as { code: string })?.code || ""
    }));

    return NextResponse.json(flattened);
}
