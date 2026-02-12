import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function GET() {
    try {
        const supabase = createClient();
        const cookieStore = cookies();
        const profileId = cookieStore.get("sc_profile_id")?.value;

        if (!profileId) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Get all students with their attendance logs for the current semester
        const { data: students } = await supabase
            .from("students")
            .select("id, name, sin, year_level");

        if (!students || students.length === 0) {
            return NextResponse.json({ students: [], at_risk: [] });
        }

        // Get attendance logs for this semester (last 6 months)
        const semesterStart = new Date();
        semesterStart.setMonth(semesterStart.getMonth() - 6);

        const { data: logs } = await supabase
            .from("attendance_logs")
            .select("student_id, status, timestamp")
            .gte("timestamp", semesterStart.toISOString())
            .order("timestamp", { ascending: true });

        if (!logs) {
            return NextResponse.json({ students: [], at_risk: [] });
        }

        // Group logs by student
        const studentLogs: Record<number, { status: string; timestamp: string }[]> = {};
        for (const log of logs) {
            if (!studentLogs[log.student_id]) studentLogs[log.student_id] = [];
            studentLogs[log.student_id].push(log);
        }

        const atRiskStudents: {
            student_id: number;
            name: string;
            sin: string;
            year_level: string;
            total_sessions: number;
            absences: number;
            attendance_rate: number;
            consecutive_absences: number;
            reason: string;
        }[] = [];

        for (const student of students) {
            const sLogs = studentLogs[student.id] || [];
            if (sLogs.length === 0) continue;

            const total = sLogs.length;
            const absences = sLogs.filter(
                (l) => l.status?.toLowerCase().includes("absent") || l.status?.toLowerCase().includes("cut")
            ).length;
            const attendanceRate = total > 0 ? ((total - absences) / total) * 100 : 100;

            // Calculate consecutive absences (most recent streak)
            let consecutiveAbsences = 0;
            for (let i = sLogs.length - 1; i >= 0; i--) {
                const s = sLogs[i].status?.toLowerCase() || "";
                if (s.includes("absent") || s.includes("cut")) {
                    consecutiveAbsences++;
                } else {
                    break;
                }
            }

            const reasons: string[] = [];
            if (consecutiveAbsences >= 3) reasons.push(`${consecutiveAbsences} consecutive absences`);
            if (attendanceRate < 80) reasons.push(`${attendanceRate.toFixed(1)}% attendance (below 80%)`);

            if (reasons.length > 0) {
                atRiskStudents.push({
                    student_id: student.id,
                    name: student.name,
                    sin: student.sin,
                    year_level: student.year_level,
                    total_sessions: total,
                    absences,
                    attendance_rate: Math.round(attendanceRate * 10) / 10,
                    consecutive_absences: consecutiveAbsences,
                    reason: reasons.join("; "),
                });
            }
        }

        // Sort by attendance rate ascending (worst first)
        atRiskStudents.sort((a, b) => a.attendance_rate - b.attendance_rate);

        return NextResponse.json({
            at_risk: atRiskStudents,
            total_students: students.length,
            at_risk_count: atRiskStudents.length,
        });
    } catch (err) {
        console.error("At-risk check error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
