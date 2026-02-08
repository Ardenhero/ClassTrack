import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const instructor_id = searchParams.get('instructor_id') || searchParams.get('instructorId') || searchParams.get('id');

    console.log("Kiosk: Fetching classes for instructor:", instructor_id);

    if (!instructor_id) {
        return NextResponse.json({ error: "instructor_id or instructorId is required" }, { status: 400 });
    }

    try {
        // Fetch classes for the instructor
        // We also return start_time and end_time for the ESP32 to display or usage
        const { data: classes, error } = await supabase
            .from('classes')
            .select('id, name, start_time, end_time')
            .eq('instructor_id', instructor_id)
            .order('start_time', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            console.error("Error fetching classes:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(classes);
    } catch (err) {
        console.error("API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
