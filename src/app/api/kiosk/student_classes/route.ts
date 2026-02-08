import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

interface ClassData {
    id: string;
    name: string;
    user_id: string;
}

interface EnrollmentData {
    class_id: string;
    classes: ClassData; // Supabase returns single object for foreign key
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get("student_id");
    const instructor_id = searchParams.get("instructor_id");

    if (!student_id || !instructor_id) {
        return NextResponse.json({ error: "Missing student_id or instructor_id" }, { status: 400 });
    }

    const supabase = createClient();

    // Fetch classes taught by this instructor where the student is enrolled
    const { data, error } = await supabase
        .from("enrollments")
        .select(`
      class_id,
      classes:class_id (
        id,
        name,
        user_id
      )
    `)
        .eq("student_id", student_id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Cast data to unknown first to avoid deep type matching issues, then to our interface
    const enrollments = data as unknown as EnrollmentData[];

    // Filter for the specified instructor
    const filteredClasses = enrollments
        .filter((record) => record.classes && record.classes.user_id === instructor_id)
        .map((record) => record.classes);

    return NextResponse.json(filteredClasses);
}
