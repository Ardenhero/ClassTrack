import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const LogSchema = z.object({
    student_name: z.string(),
    class: z.string(),
    year_level: z.union([z.string(), z.number()]),
    attendance_type: z.string(),
    timestamp: z.string(),
    instructor_id: z.string().optional(),
});

export async function POST(request: Request) {
    const supabase = createClient();

    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get("email");

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }

        const body = await request.json();
        const result = LogSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: "Invalid Request", details: result.error }, { status: 400 });
        }

        const { student_name, class: className, attendance_type, timestamp } = result.data;

        const { error } = await supabase.rpc('log_attendance', {
            email_input: email,
            student_name_input: student_name,
            class_name_input: className,
            status_input: attendance_type,
            timestamp_input: timestamp,
            instructor_id_input: result.data.instructor_id
        });

        if (error) {
            console.error("RPC Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Attendance Logged" });

    } catch (err) {
        console.error("API Error Log:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
