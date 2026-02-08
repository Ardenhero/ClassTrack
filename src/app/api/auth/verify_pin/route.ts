import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { instructor_id, pin } = await request.json();

        if (!instructor_id) {
            return NextResponse.json({ error: "Missing instructor_id" }, { status: 400 });
        }

        const supabase = createClient();

        if (!pin) {
            return NextResponse.json({ error: "Missing pin" }, { status: 400 });
        }
        const { data, error } = await supabase
            .from("instructors")
            .select("pin_code")
            .eq("id", instructor_id)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
        }

        // Strict string conversion and trimming
        const inputPin = String(pin).trim();
        const storedPin = data.pin_code ? String(data.pin_code).trim() : null;

        if (storedPin && inputPin === storedPin) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
        }
    } catch {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
