import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

interface EnrollmentRecord {
    student_id: string;
    students: {
        id: string;
        name: string;
        year_level: string | null; // Added year_level
    };
}

export async function GET(request: Request) {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const class_id = searchParams.get('class_id') || searchParams.get('classId') || searchParams.get('id');

    console.log("Kiosk: Fetching students for class:", class_id);

    if (!class_id) {
        return NextResponse.json({ error: "class_id or classId is required" }, { status: 400 });
    }

    try {
        const { data, error } = await supabase
            .from('enrollments')
            .select(`
student_id,
    students(
        id,
        name,
        year_level
    )
        `)
            .eq('class_id', class_id);

        if (error) {
            console.error("Error fetching enrollments:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const enrollments = data as unknown as EnrollmentRecord[];

        // Map to flat list
        const students = enrollments.map((e) => ({
            id: e.students.id,
            name: e.students.name,
            year_level: e.students.year_level // Added year_level to the mapped student object
        }));

        // Sort alphabetically by name
        students.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json(students);
    } catch (err) {
        console.error("API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
