"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export interface PoolStudent {
    id: string;
    name: string;
    sin: string;
    year_level: string;
    department: string | null;
    created_at: string;
    is_archived: boolean | null;
    image_url: string | null;
    enrollment_count: number;
    enrollment_status?: string;
    batch_year?: string;
}

export async function getDepartmentStudentPool(): Promise<{
    students: PoolStudent[];
    departmentName: string | null;
    deptCode: string | null;
}> {
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) return { students: [], departmentName: null, deptCode: null };

    // Get admin's department
    const { data: adminProfile } = await supabase
        .from("instructors")
        .select("department_id, departments(name, code)")
        .eq("id", profileId)
        .single();

    if (!adminProfile?.department_id) {
        return { students: [], departmentName: null, deptCode: null };
    }

    // @ts-expect-error - Supabase joined type inference limitation
    const deptName = adminProfile.departments?.name || null;
    // @ts-expect-error - Supabase joined type inference limitation
    const deptCode = adminProfile.departments?.code || null;

    // 1. Fetch all students in this department
    const { data: deptStudents } = await supabase
        .from("students")
        .select("id, name, sin, year_level, department, created_at, is_archived, image_url, enrollment_status, batch_year")
        .eq("department", deptCode)
        .order("name");

    // 2. Get all instructor IDs in this department to find "Other Dept" students
    const { data: deptInstructors } = await supabase
        .from("instructors")
        .select("id")
        .eq("department_id", adminProfile.department_id);
    
    const instructorIds = (deptInstructors || []).map(i => i.id);

    // 3. Fetch students who are NOT in this department but are either:
    //    a) Enrolled in classes of these instructors
    //    b) Directly assigned to these instructors (manual addition to list)
    let otherStudents: any[] = [];
    if (instructorIds.length > 0) {
        // Query A: Direct assignments (manual addition)
        const { data: directAssignments } = await supabase
            .from("students")
            .select(`id, name, sin, year_level, department, created_at, is_archived, image_url, enrollment_status, batch_year`)
            .neq("department", deptCode)
            .in("instructor_id", instructorIds);

        // Query B: Enrollment-based assignments
        const { data: enrollmentAssignments } = await supabase
            .from("students")
            .select(`
                id, name, sin, year_level, department, created_at, is_archived, image_url, enrollment_status, batch_year,
                enrollments!inner (
                    classes!inner (
                        instructor_id
                    )
                )
            `)
            .neq("department", deptCode)
            .in("enrollments.classes.instructor_id", instructorIds);

        const map = new Map();
        (directAssignments || []).forEach(s => map.set(s.id, s));
        (enrollmentAssignments || []).forEach(s => map.set(s.id, s));
        otherStudents = Array.from(map.values());
    }

    // Combine and deduplicate
    const allStudentsRaw = [...(deptStudents || []), ...otherStudents];
    const studentMap = new Map();
    allStudentsRaw.forEach(s => studentMap.set(s.id, s));
    const uniqueStudents = Array.from(studentMap.values());

    const studentIds = uniqueStudents.map(s => s.id);
    // Join with classes to filter by admin's department for privacy
    const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id, classes!inner(department_id)")
        .in("student_id", studentIds.length > 0 ? studentIds : ["__none__"])
        .eq("classes.department_id", adminProfile.department_id);

    const enrollCountMap = new Map<string, number>();
    (enrollments || []).forEach(e => {
        enrollCountMap.set(e.student_id, (enrollCountMap.get(e.student_id) || 0) + 1);
    });

    const poolStudents: PoolStudent[] = uniqueStudents.map(s => ({
        ...s,
        department: s.department || null,
        is_archived: s.is_archived || null,
        enrollment_count: enrollCountMap.get(s.id) || 0,
    })).sort((a, b) => a.name.localeCompare(b.name));

    return { students: poolStudents, departmentName: deptName, deptCode };
}

// ── Tier 3 Critical Deletion ──────────────────────────────────────────────────
export async function unenrollStudentFromDepartment(studentId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Not authenticated" };
    }

    // Use Service Role to bypass RLS for this admin operation
    const adminSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Capture fingerprint info BEFORE deleting
    const { data: student } = await adminSupabase
        .from("students")
        .select("fingerprint_slot_id, device_id, name")
        .eq("id", studentId)
        .single();

    if (!student) {
        return { error: "Student not found" };
    }

    const fingerprintSlot = student?.fingerprint_slot_id;
    const deviceId = student?.device_id;

    const { data: deviceLinks } = await adminSupabase
        .from("fingerprint_device_links")
        .select("device_serial, fingerprint_slot_id")
        .eq("student_id", studentId);

    // 2. Delete from DB (Nuclear - ignores is_archived)
    const { error: deleteError } = await adminSupabase
        .from("students")
        .delete()
        .eq("id", studentId);

    if (deleteError) {
        console.error("Error permanently deleting student from department:", deleteError);
        return { error: deleteError.message };
    }

    // 3. Push delete command to ESP32 for primary device in robust queue
    if (fingerprintSlot && deviceId) {
        await adminSupabase
            .from("kiosk_commands")
            .insert({
                device_serial: deviceId,
                command: `delete_finger:${fingerprintSlot}`,
                status: 'pending'
            });
    }

    // 4. Push delete commands for any copied fingerprint links in robust queue
    if (deviceLinks && deviceLinks.length > 0) {
        for (const link of deviceLinks) {
            await adminSupabase
                .from("kiosk_commands")
                .insert({
                    device_serial: link.device_serial,
                    command: `delete_finger:${link.fingerprint_slot_id}`,
                    status: 'pending'
                });
        }
    }

    // Clean up the device links table
    await adminSupabase.from("fingerprint_device_links").delete().eq("student_id", studentId);

    // 5. Audit Log
    await adminSupabase.from("audit_logs").insert({
        action: "student_unenrolled_from_department",
        entity_type: "student",
        entity_id: studentId,
        details: `Critical Deletion: Student ${student.name} fully removed from the database${fingerprintSlot ? ` (fingerprint slot ${fingerprintSlot} wipe queued)` : ""}`,
        performed_by: user.id,
    });

    revalidatePath("/enrollment-list");
    revalidatePath("/students");
    revalidatePath("/archived");

    return { success: true };
}

// ── Bulk Unenroll ────────────────────────────────────────────────────────────
export async function bulkUnenrollStudentsFromDepartment(studentIds: string[]) {
    if (studentIds.length === 0) return { success: true };

    const results = [];
    for (const id of studentIds) {
        results.push(await unenrollStudentFromDepartment(id));
    }

    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
        return { error: `Failed to unenroll ${errors.length} student(s)` };
    }

    return { success: true };
}

export async function promoteStudentsBatch(studentIds: string[], newGradeLevel: string, newStatus: string = 'active', batchYear?: string) {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const adminSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const updateData: {
        year_level: string;
        enrollment_status: string;
        updated_at: string;
        batch_year?: string;
    } = {
        year_level: newGradeLevel,
        enrollment_status: newStatus,
        updated_at: new Date().toISOString()
    };

    if (batchYear) {
        updateData.batch_year = batchYear;
    }

    const { error } = await adminSupabase
        .from("students")
        .update(updateData)
        .in("id", studentIds);

    if (error) return { error: error.message };

    // Audit log
    await adminSupabase.from("audit_logs").insert({
        action: "batch_promotion",
        entity_type: "students",
        details: `Promoted ${studentIds.length} students to ${newGradeLevel} (${newStatus})`,
        performed_by: user.id
    });

    revalidatePath("/enrollment-list");
    return { success: true };
}
