import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

interface InstructorSync {
    id: string;
    name: string;
    department_code: string;
}

export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
        return NextResponse.json({ classes: [], students: [], instructors: [], debug: "No email provided" });
    }

    const trimmedEmail = email.trim();

    // 1. Get Sync Data via RPC (Strictly filtered by email inside the RPC)
    const { data: syncData, error: syncError } = await supabase.rpc('get_sync_data_v2', { email_input: trimmedEmail });

    if (syncError) {
        console.error("Sync RPC Error:", syncError);
        return NextResponse.json({ error: syncError.message }, { status: 500 });
    }

    // 2. Get the owner_id from the email to filter instructors
    const { data: userData } = await supabase
        .from('instructors')
        .select('owner_id')
        .eq('email', trimmedEmail)
        .limit(1)
        .maybeSingle();

    const ownerId = userData?.owner_id;
    let flattenedInstructors: InstructorSync[] = [];

    if (ownerId) {
        const { data: instructors } = await supabase
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

        flattenedInstructors = (instructors || []).map((i) => ({
            id: i.id,
            name: i.name,
            department_code: (i.departments as unknown as { code: string })?.code || ""
        }));
    }

    return NextResponse.json({
        classes: syncData?.classes || [],
        students: syncData?.students || [],
        instructors: flattenedInstructors
    });
}
