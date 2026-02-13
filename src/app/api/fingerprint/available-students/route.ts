import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const instructorId = searchParams.get("instructor_id");

        if (!instructorId) {
            return NextResponse.json(
                { error: "instructor_id query param required" },
                { status: 400 }
            );
        }

        // Fetch students without fingerprint_slot_id, belonging to this instructor
        const { data: students, error } = await supabase
            .from("students")
            .select("id, name, year_level, fingerprint_slot_id")
            .eq("instructor_id", instructorId)
            .is("fingerprint_slot_id", null)
            .order("name");

        if (error) {
            console.error("Fetch unenrolled students error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            students: students || [],
            count: students?.length || 0,
        });

    } catch (err) {
        console.error("Available Students API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
export const dynamic = 'force-dynamic';
