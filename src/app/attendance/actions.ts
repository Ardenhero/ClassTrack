"use server";

import { createClient } from "@/utils/supabase/server";

export interface StudentFullReport {
    name: string;
    sin?: string;
    year_level?: string;
    totalSessions: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    excusedCount: number;
    attendanceRate: number;
}

export async function getDepartmentAttendanceSummary(departmentId?: string) {
    const supabase = createClient();

    // 1. Get all instructors in the department if departmentId is provided
    let instructorIds: string[] = [];
    if (departmentId) {
        const { data: instructors } = await supabase
            .from('instructors')
            .select('id')
            .eq('department_id', departmentId);
        instructorIds = instructors?.map(i => i.id) || [];
    }

    // 2. Fetch students
    // We want students either in a class taught by these instructors OR directly in this department
    let studentQuery = supabase.from('students').select('id, name, sin, year_level, department_id');
    
    // For department admins, we might want to limit to their department students
    // But the user's requirement for the 360 view suggests we want "all students they have oversight for"
    if (departmentId) {
        // Find classes taught by department instructors
        const { data: deptClasses } = await supabase
            .from('classes')
            .select('id')
            .in('instructor_id', instructorIds);
        const classIds = deptClasses?.map(c => c.id) || [];

        // Find students enrolled in those classes
        const { data: enrollments } = await supabase
            .from('enrollments')
            .select('student_id')
            .in('class_id', classIds);
        const enrolledStudentIds = Array.from(new Set(enrollments?.map(e => e.student_id) || []));

        // Final student list: ONLY students enrolled in Department Classes
        studentQuery = studentQuery.in('id', enrolledStudentIds);
    }

    const { data: students } = await studentQuery;
    if (!students || students.length === 0) return [];

    const studentIds = students.map(s => s.id);

    // 3. Fetch ALL logs for these students across the relevant classes (or all classes if unrestricted)
    // To be most accurate, we should fetch all logs for these students.
    const { data: logs } = await supabase
        .from('attendance_logs')
        .select('student_id, status, class_id')
        .in('student_id', studentIds);

    const summaries: StudentFullReport[] = students.map(s => {
        const studentLogs = logs?.filter(l => l.student_id === s.id) || [];
        
        let present = 0;
        let late = 0;
        let absent = 0;
        let excused = 0;
        let totalSessions = 0;

        studentLogs.forEach(l => {
            const status = l.status || "Present";
            if (status === "No Class" || status === "Holiday" || status === "Suspended") return;

            totalSessions++;
            if (status === "Present" || status === "Manually Verified") present++;
            else if (status === "Late") late++;
            else if (status === "Excused") excused++;
            else absent++;
        });

        const rate = totalSessions > 0 ? ((present + late) / totalSessions) * 100 : 0;

        return {
            name: s.name,
            sin: s.sin,
            year_level: s.year_level,
            totalSessions,
            presentCount: present,
            lateCount: late,
            absentCount: absent,
            excusedCount: excused,
            attendanceRate: rate
        };
    });

    return summaries;
}
