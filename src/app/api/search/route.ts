import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const type = searchParams.get("type") || "all"; // 'all', 'classes', 'students'

    if (!query) {
        return NextResponse.json({ classes: [], students: [] });
    }

    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let classes: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let students: any[] = [];

    // Search Classes
    if (type === "all" || type === "classes") {
        const { data } = await supabase
            .from("classes")
            .select("id, name")
            .ilike("name", `%${query}%`)
            .limit(5);
        classes = data || [];
    }

    // Search Students
    if (type === "all" || type === "students") {
        const { data } = await supabase
            .from("students")
            .select("id, name, year_level")
            .ilike("name", `%${query}%`)
            .limit(5);
        students = data || [];
    }

    return NextResponse.json({
        classes: classes,
        students: students
    });
}
