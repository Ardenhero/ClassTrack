import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("instructors")
        .select(`
            id, 
            name,
            departments (
                code
            )
        `)
        .eq("is_visible_on_kiosk", true)
        .order("name", { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten logic for ESP32 easy parsing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flattened = data.map((i: any) => ({
        id: i.id,
        name: i.name,
        department_code: i.departments?.code || ""
    }));

    return NextResponse.json(flattened);
}
