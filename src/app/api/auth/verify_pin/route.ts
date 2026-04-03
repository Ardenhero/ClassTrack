import { createClient } from "../../../../utils/supabase/server";
import { NextResponse } from "next/server";
import { verifyCredential } from "@/lib/auth-crypto";
import { z } from "zod";

const VerifyPinSchema = z.object({
    instructor_id: z.string().uuid(),
    pin: z.string().min(1).max(10),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const result = VerifyPinSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
        }

        const { instructor_id, pin } = result.data;
        const supabase = createClient();

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

        if (!storedPin) {
            return NextResponse.json({ error: "PIN not set" }, { status: 401 });
        }

        // Check if stored PIN is hashed (contains ":") or legacy plain-text
        let isValid = false;
        if (storedPin.includes(":")) {
            isValid = verifyCredential(inputPin, storedPin);
        } else {
            // Legacy plain-text check
            isValid = inputPin === storedPin;
        }

        if (isValid) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
        }
    } catch {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
