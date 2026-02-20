import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/qr/student-lookup?sin=<student_id_number>
 * Looks up a student by their School ID Number and returns their enrolled classes
 * with room information for the Student Portal.
 */
export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const sin = searchParams.get("sin");

        if (!sin || !sin.trim()) {
            return NextResponse.json(
                { error: "Student ID Number (sin) is required" },
                { status: 400 }
            );
        }

        // Find student by SIN
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('id, name, sin, year_level')
            .eq('sin', sin.trim())
            .maybeSingle();

        if (studentError) throw studentError;

        if (!student) {
            return NextResponse.json(
                { error: "No student found with this ID number" },
                { status: 404 }
            );
        }

        // Get enrolled classes with room info
        const { data: enrollments, error: enrollError } = await supabase
            .from('enrollments')
            .select('class_id, classes(id, name, start_time, end_time, day_of_week, room_id, room, rooms(id, name, building))')
            .eq('student_id', student.id);

        if (enrollError) throw enrollError;

        interface ClassData {
            id: string;
            name: string;
            start_time: string | null;
            end_time: string | null;
            day_of_week: string | null;
            room_id: string | null;
            room: string | null;
            rooms: { id: string; name: string; building: string | null } | { id: string; name: string; building: string | null }[] | null;
        }

        const classes = (enrollments || []).map((e: { class_id: string; classes: ClassData | ClassData[] | null }) => {
            const c = Array.isArray(e.classes) ? e.classes[0] : e.classes;
            if (!c) return null;

            const room = Array.isArray(c.rooms) ? c.rooms[0] : c.rooms;
            return {
                id: c.id,
                name: c.name,
                start_time: c.start_time,
                end_time: c.end_time,
                day_of_week: c.day_of_week,
                room_id: c.room_id || room?.id || null,
                room_name: room?.name || c.room || null,
            };
        }).filter(Boolean);

        return NextResponse.json({
            student: { id: student.id, name: student.name },
            classes,
        });

    } catch (err) {
        console.error("[QR Student Lookup] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
