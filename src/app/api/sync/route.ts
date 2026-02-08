import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const supabase = createClient();

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
        return NextResponse.json({ classes: [], students: [], debug: "No email provided" });
    }

    const { data, error } = await supabase.rpc('get_sync_data_v2', { email_input: email.trim() });

    if (error) {
        return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }
    // Fetch instructors for Kiosk
    const { data: instructors } = await supabase
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flattenedInstructors = instructors?.map((i: any) => ({
        id: i.id,
        name: i.name,
        department_code: i.departments?.code || ""
    })) || [];

    return NextResponse.json({
        classes: data?.classes || [],
        students: data?.students || [],
        instructors: flattenedInstructors
    });
}
