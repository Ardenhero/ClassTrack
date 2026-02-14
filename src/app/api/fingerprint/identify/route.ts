import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const slot_id = searchParams.get('slot_id');

    if (!slot_id) {
        return NextResponse.json({ error: "Missing slot_id" }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const slotIdInt = parseInt(slot_id, 10);
        console.log(`[API] Identify Fingerprint: Slot ID ${slot_id} (Int: ${slotIdInt})`);

        if (isNaN(slotIdInt)) {
            return NextResponse.json({ error: "Invalid Slot ID" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('students')
            .select('id, name, student_no')
            .eq('fingerprint_slot_id', slotIdInt) // Query as INT
            .maybeSingle(); // Use maybeSingle to avoid errors on duplicates

        if (error) {
            console.error("Identify Fingerprint Error:", error);
            return NextResponse.json({ error: "Database Error" }, { status: 500 });
        }

        if (!data) {
            console.warn(`[API] Identify: Slot ${slotIdInt} not found in DB.`);
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        console.log(`[API] Identify: Found Student ${data.name} (ID: ${data.id})`);

        return NextResponse.json({
            success: true,
            student: data
        });

    } catch (err) {
        console.error("Identify Fingerprint API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
