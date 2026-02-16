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
        const scope = searchParams.get("scope") || "instructor";
        const requestedProfileId = searchParams.get("profile_id") || profileId;

        // Get the profile to determine role
        const { data: actorProfile } = await supabase
            .from("instructors")
            .select("id, role, is_super_admin, auth_user_id")
            .eq("id", requestedProfileId)
            .single();

        if (!actorProfile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        let studentIds: number[] = [];

        if (scope === "super_admin" && actorProfile.is_super_admin) {
            // Super Admin: ALL students
            const { data: allStudents } = await supabase
                .from("students")
                .select("id");
            studentIds = (allStudents || []).map((s: { id: number }) => s.id);

        } else if (scope === "admin" && actorProfile.role === "admin") {
            // System Admin: students belonging to instructors under the same account
            // Find all instructor profiles that share this auth_user_id (same account)
            const { data: accountProfiles } = await supabase
                .from("instructors")
                .select("id")
                .eq("auth_user_id", actorProfile.auth_user_id);

            const profileIds = (accountProfiles || []).map((p: { id: string }) => p.id);
            const studentIdSet = new Set<number>();

            // 1. Enrolled in classes taught by these profiles
            const { data: classes } = await supabase
                .from("classes")
                .select("id")
                .in("instructor_id", profileIds);

            const classIds = (classes || []).map((c: { id: string }) => c.id);

            if (classIds.length > 0) {
                const { data: enrollments } = await supabase
                    .from("enrollments")
                    .select("student_id")
                    .in("class_id", classIds);
                enrollments?.forEach((e: { student_id: number }) => studentIdSet.add(e.student_id));
            }

            // 2. Created by these profiles (even if not enrolled)
            if (profileIds.length > 0) {
                const { data: createdStudents } = await supabase
                    .from("students")
                    .select("id")
                    .in("instructor_id", profileIds);
                createdStudents?.forEach((s: { id: number }) => studentIdSet.add(s.id));
            }

            studentIds = Array.from(studentIdSet);

        } else {
            // Instructor: only students in their own classes OR created by them
            const studentIdSet = new Set<number>();

            // 1. Enrolled
            const { data: classes } = await supabase
                .from("classes")
                .select("id")
                .eq("instructor_id", requestedProfileId);

            const classIds = (classes || []).map((c: { id: string }) => c.id);

            if (classIds.length > 0) {
                const { data: enrollments } = await supabase
                    .from("enrollments")
                    .select("student_id")
                    .in("class_id", classIds);
                enrollments?.forEach((e: { student_id: number }) => studentIdSet.add(e.student_id));
            }

            // 2. Created by them
            const { data: createdStudents } = await supabase
                .from("students")
                .select("id")
                .eq("instructor_id", requestedProfileId);
            createdStudents?.forEach((s: { id: number }) => studentIdSet.add(s.id));

            studentIds = Array.from(studentIdSet);
        }

        if (studentIds.length === 0) {
            return NextResponse.json({ at_risk: [], total_students: 0, at_risk_count: 0 });
        }

        // Get student details
        const { data: students } = await supabase
            .from("students")
            .select("id, name, sin, year_level")
            .in("id", studentIds);

        if (!students || students.length === 0) {
            return NextResponse.json({ at_risk: [], total_students: 0 });
        }

        // Get attendance logs for the scoped students (last 6 months)
        const semesterStart = new Date();
        semesterStart.setMonth(semesterStart.getMonth() - 6);

        const { data: logs } = await supabase
            .from("attendance_logs")
            .select("student_id, status, timestamp")
            .in("student_id", studentIds)
            .gte("timestamp", semesterStart.toISOString())
            .order("timestamp", { ascending: true });

        if (!logs) {
            return NextResponse.json({ at_risk: [], total_students: students.length });
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
