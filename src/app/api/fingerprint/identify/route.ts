import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const slot_id = searchParams.get('slot_id');

    if (!slot_id) {
        return NextResponse.json({ error: "Missing slot_id" }, { status: 400 });
    }

    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from('students')
            .select('id, name, student_no')
            .eq('fingerprint_slot_id', slot_id)
            .single();

        if (error) {
            console.error("Identify Fingerprint Error:", error);
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            student: data
        });

    } catch (err) {
        console.error("Identify Fingerprint API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
