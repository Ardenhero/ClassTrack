import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const supabase = createClient();
        const cookieStore = cookies();
        const profileId = cookieStore.get("sc_profile_id")?.value;

        if (!profileId) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const dateFrom = searchParams.get("date_from");
        const dateTo = searchParams.get("date_to");
        const yearLevel = searchParams.get("year_level");
        const classId = searchParams.get("class_id");

        if (!dateFrom || !dateTo) {
            return NextResponse.json({ error: "date_from and date_to are required" }, { status: 400 });
        }

        // Build students query
        let studentsQuery = supabase.from("students").select("id, name, sin, year_level");
        if (yearLevel) studentsQuery = studentsQuery.eq("year_level", yearLevel);
        const { data: students } = await studentsQuery;

        if (!students || students.length === 0) {
            return new Response("No students found", { status: 404 });
        }

        // If class_id, filter to students in that class
        let targetStudentIds = students.map((s) => s.id);
        if (classId) {
            const { data: classStudents } = await supabase
                .from("students")
                .select("id")
                .eq("class_id", parseInt(classId));
            if (classStudents) {
                const classStudentIds = new Set(classStudents.map((s) => s.id));
                targetStudentIds = targetStudentIds.filter((id) => classStudentIds.has(id));
            }
        }

        // Get attendance logs for date range
        const { data: logs } = await supabase
            .from("attendance_logs")
            .select("student_id, status, timestamp")
            .gte("timestamp", `${dateFrom}T00:00:00`)
            .lte("timestamp", `${dateTo}T23:59:59`)
            .in("student_id", targetStudentIds)
            .order("student_id");

        // Group by student
        const studentLogs: Record<number, { status: string }[]> = {};
        for (const log of logs || []) {
            if (!studentLogs[log.student_id]) studentLogs[log.student_id] = [];
            studentLogs[log.student_id].push(log);
        }

        // Build CSV rows
        const csvRows: string[] = [];
        csvRows.push("Student,SIN,Year Level,Total Sessions,Present,Late,Absent,Excused,Attendance %,Status");

        const studentMap = new Map(students.map((s) => [s.id, s]));

        for (const studentId of targetStudentIds) {
            const student = studentMap.get(studentId);
            if (!student) continue;

            const sLogs = studentLogs[studentId] || [];
            const total = sLogs.length;

            const present = sLogs.filter((l) => {
                const s = l.status?.toLowerCase() || "";
                return s.includes("present") || s === "on time" || s === "time in";
            }).length;

            const late = sLogs.filter((l) => {
                const s = l.status?.toLowerCase() || "";
                return s.includes("late");
            }).length;

            const absent = sLogs.filter((l) => {
                const s = l.status?.toLowerCase() || "";
                return s.includes("absent") || s.includes("cut");
            }).length;

            const excused = sLogs.filter((l) => {
                const s = l.status?.toLowerCase() || "";
                return s.includes("excused");
            }).length;

            const attendanceRate = total > 0 ? (((total - absent) / total) * 100) : 0;
            const roundedRate = Math.round(attendanceRate * 10) / 10;

            let statusLabel = "GOOD";
            if (roundedRate >= 95) statusLabel = "EXCELLENT";
            else if (roundedRate < 80) statusLabel = "AT-RISK";

            const name = `"${student.name.replace(/"/g, '""')}"`;
            csvRows.push(`${name},${student.sin},${student.year_level},${total},${present},${late},${absent},${excused},${roundedRate}%,${statusLabel}`);
        }

        const csv = csvRows.join("\n");
        const fileName = `attendance_report_${dateFrom}_to_${dateTo}.csv`;

        return new Response(csv, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="${fileName}"`,
            },
        });
    } catch (err) {
        console.error("Semester export error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
