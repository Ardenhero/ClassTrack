"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";
import { z } from 'zod';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const StudentSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(200, "Name must be less than 200 characters"),
    sin: z.string().regex(/^\d{2}-\d{5,6}$/, "Invalid SIN format. Use YY-XXXXX or YY-XXXXXX (e.g., 22-00001)"),
    year_level: z.string().min(1, "Year level is required"),
    department: z.string().optional().default("Unknown"),
    class_ids: z.array(z.string().uuid()).optional().default([]) // OPTIONAL
});

export async function addStudent(formData: FormData) {
    const supabase = createClient();

    const rawData = {
        name: formData.get("name"),
        sin: formData.get("sin"),
        year_level: formData.get("year_level"),
        department: formData.get("department"),
        class_ids: formData.get("class_ids") ? JSON.parse(formData.get("class_ids") as string) : []
    };

    const parseResult = StudentSchema.safeParse(rawData);
    if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return { error: `${firstError.path.join('.')}: ${firstError.message}` };
    }

    const { name, sin, year_level, department, class_ids: classIds } = parseResult.data;



    // Get Profile ID from cookie
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    let profileId = cookieStore.get("sc_profile_id")?.value;

    // System Admin override
    const instructorIdOverride = formData.get("instructor_id_override") as string | null;
    if (instructorIdOverride) {
        profileId = instructorIdOverride;
    }

    if (!profileId) {
        return { error: "Profile not found. Please select a profile." };
    }

    // RESOLVE "admin-profile" to actual UUID & Auto-Create if missing
    if (profileId === 'admin-profile') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: adminProfile } = await supabase
                .from('instructors')
                .select('id')
                .eq('auth_user_id', user.id)
                .maybeSingle();

            if (adminProfile) {
                profileId = adminProfile.id;
            } else {
                // AUTO-CREATE Admin Profile if missing
                const { data: newProfile, error: createProfileError } = await supabase
                    .from('instructors')
                    .insert({
                        auth_user_id: user.id,
                        name: 'System Admin',
                        role: 'admin',
                        email: user.email || 'admin@classtrack.edu'
                    })
                    .select('id')
                    .single();

                if (newProfile) {
                    console.log("DEBUG: Auto-created admin profile:", newProfile.id);
                    profileId = newProfile.id;
                } else if (createProfileError) {
                    console.error("DEBUG: Failed to auto-create admin profile:", createProfileError);
                    // Fallback: This will likely fail downstream with UUID error if profileId remains 'admin-profile'
                }
            }
        }
    }

    // STEP 1: Check if student exists (Global Lookup via Secure RPC)
    let studentId: string;
    let existingStudent: { id: string; name: string } | null = null;

    const { data: existingStudentData, error: findError } = await supabase
        .rpc('get_student_by_sin_secure', { p_sin: sin });

    if (findError) {
        console.error("Error finding student:", findError);
        return { error: `Database error checking existence: ${findError.message}` };
    }

    if (existingStudentData) {
        // EXISTING STUDENT FOUND: Use their ID
        existingStudent = existingStudentData as { id: string; name: string };
        studentId = existingStudent.id;

        console.log(`Found existing student: ${existingStudent.name} (${studentId})`);
    } else {
        // NEW STUDENT: Create record
        // If profileId is still "admin-profile" (meaning Admin didn't select an instructor and auto-create failed or was skipped),
        // we leave instructor_id as null. They will belong to the department pool.
        const finalInstructorId = profileId === 'admin-profile' || !profileId ? null : profileId;

        const { data: newStudent, error: createError } = await supabase
            .from("students")
            .insert({
                name,
                sin,
                year_level,
                department,
                instructor_id: finalInstructorId,
            })
            .select("id")
            .single();

        if (createError) {
            console.error("Error creating student:", createError);
            if (createError.code === '23505') { // Unique violation
                if (createError.message.includes('sin')) {
                    return { error: "A student with this SIN already exists." };
                }
            }
            return { error: `Failed to create student: ${createError.message || JSON.stringify(createError)}` };
        }

        if (!newStudent) {
            return { error: "Failed to create student. No DB record returned." };
        }

        studentId = newStudent.id;
        console.log(`Created new student: ${name} (${studentId}) with instructor: ${finalInstructorId}`);
    }

    // STEP 2: Validate Class Ownership (Security Check)
    if (classIds && classIds.length > 0) {
        const isAdmin = await import("@/lib/auth-utils").then(m => m.checkIsAdmin());

        if (!isAdmin) {
            const { count } = await supabase
                .from("classes")
                .select("*", { count: 'exact', head: true })
                .in("id", classIds)
                .eq("instructor_id", profileId);

            if (count !== classIds.length) {
                return { error: "Unauthorized: You can only assign students to your own classes." };
            }
        }

        // STEP 3: Create Enrollments (If classes were selected)
        const enrollments = classIds.map(classId => ({
            class_id: classId,
            student_id: studentId
        }));

        const { error: enrollError } = await supabase
            .from("enrollments")
            .upsert(enrollments, { onConflict: 'student_id, class_id' });

        if (enrollError) {
            console.error("Enrollment error:", enrollError);
            return { error: "Failed to enroll student in selected classes." };
        }

        console.log(`Enrolled student ${studentId} in ${classIds.length} class(es)`);
    } else {
        console.log(`Created student ${studentId} with no class assignments.`);
    }

    // STEP 4: Send Success Notification
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        await createNotification(
            user.id,
            existingStudent ? "Student Linked" : "New Student Added",
            `${name} (${sin}) has been successfully enrolled in ${classIds.length} class(es).${existingStudent ? ' (Linked to existing record)' : ''}`,
            "success"
        );
    }

    // STEP 5: Revalidate Path to Force UI Refresh
    revalidatePath("/students");

    // Return specific success message
    if (existingStudent) {
        return {
            success: true,
            message: classIds.length > 0
                ? `Existing student "${existingStudent.name}" successfully enrolled in your ${classIds.length} class(es).`
                : `Existing student "${existingStudent.name}" found (no classes assigned).`
        };
    } else {
        return {
            success: true,
            message: classIds.length > 0
                ? `New student "${name}" created and enrolled in ${classIds.length} class(es).`
                : `New student "${name}" created successfully (no classes assigned).`
        };
    }
}

export async function checkStudentBySIN(sin: string) {
    const supabase = createClient();

    // Use the secure RPC to bypass RLS for lookup
    const { data, error } = await supabase
        .rpc('get_student_by_sin_secure', { p_sin: sin });

    if (error) {
        console.error("Error checking student:", error);
        return { error: error.message };
    }

    // data is { id, name, year_level } (or null if not found)
    return { data };
}

export async function getAssignableClasses() {
    const supabase = createClient();
    const { cookies } = await import("next/headers");
    const { getProfileRole } = await import("@/lib/auth-utils");

    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;
    const role = await getProfileRole();

    if (!profileId) return [];

    if (role === 'admin') {
        // Admin sees all classes, with instructor names for clarity
        const { data } = await supabase
            .from("classes")
            .select("id, name, description, instructors!classes_instructor_id_fkey(name)")
            .order("name");

        return (data || []).map((c: { id: string; name: string; description: string | null; instructors: { name: string }[] | null }) => {
            const instructorName = c.instructors && c.instructors[0] ? c.instructors[0].name : '';
            return {
                id: c.id,
                name: `${c.name}${instructorName ? ` - ${instructorName}` : ''}`,
                description: c.description
            };
        });
    } else {
        // Instructors see only their own classes
        const { data } = await supabase
            .from("classes")
            .select("id, name, description")
            .eq("instructor_id", profileId)
            .order("name");

        return data || [];
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateStudent(id: string, data: any) {
    const supabase = createClient();
    const { error } = await supabase.from("students").update(data).eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/students");
    return { success: true };
}

export async function archiveStudent(id: string, profileId?: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Use Service Role to bypass RLS
    const adminSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await adminSupabase
        .from("students")
        .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            archived_by: profileId || user?.id || null,
        })
        .eq("id", id);

    if (error) {
        console.error("Archive student error:", error);
        return { error: `Failed to archive student: ${error.message}` };
    }

    if (user) {
        await supabase.from("audit_logs").insert({
            action: "student_archived",
            entity_type: "student",
            entity_id: id,
            details: "Student moved to archive",
            performed_by: user.id,
        });
    }

    revalidatePath("/students");
    revalidatePath("/archived");
    return { success: true };
}

// Keep old name as alias for backwards compat
export const removeStudentFromDirectory = archiveStudent;

export async function bulkArchiveStudents(ids: string[], profileId?: string) {
    if (ids.length === 0) return { success: true, count: 0 };

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Use Service Role to bypass RLS
    const adminSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await adminSupabase
        .from("students")
        .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            archived_by: profileId || user?.id || null,
        })
        .in("id", ids);

    if (error) {
        console.error("Bulk archive error:", error);
        return { error: `Failed to archive students: ${error.message}` };
    }

    if (user) {
        await supabase.from("audit_logs").insert({
            action: "students_bulk_archived",
            entity_type: "student",
            entity_id: ids[0],
            details: `Bulk archived ${ids.length} students`,
            performed_by: user.id,
        });
    }

    revalidatePath("/students");
    revalidatePath("/archived");
    return { success: true, count: ids.length };
}

// Keep old name as alias for backwards compat
export const bulkRemoveStudentsFromDirectory = bulkArchiveStudents;

export async function restoreStudent(id: string) {
    const supabase = createClient();

    // Use Service Role to bypass RLS
    const adminSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await adminSupabase
        .from("students")
        .update({
            is_archived: false,
            archived_at: null,
            archived_by: null,
        })
        .eq("id", id);

    if (error) return { error: error.message };

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        await supabase.from("audit_logs").insert({
            action: "student_restored",
            entity_type: "student",
            entity_id: id,
            details: "Student restored from archive",
            performed_by: user.id,
        });
    }

    revalidatePath("/students");
    return { success: true };
}

export async function permanentlyDeleteStudent(id: string) {
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;
    const { data: { user } } = await supabase.auth.getUser();

    if (!profileId || !user) return { error: "Unauthorized" };

    // Get the caller's role
    const { data: profile } = await supabase
        .from("instructors")
        .select("role")
        .eq("id", profileId)
        .single();

    const isInstructor = profile?.role === "instructor";

    // ── Step 1: Capture student info ──
    const { data: student } = await supabase
        .from("students")
        .select("name, fingerprint_slot_id, device_id, instructor_id")
        .eq("id", id)
        .single();

    if (!student) return { error: "Student not found" };

    // Use Service Role to bypass RLS
    const adminSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (isInstructor) {
        // ── ROSTER REMOVAL FLOW (Instructor) ──
        // 1. If the instructor "owns" the student, clear the ownership
        if (student.instructor_id === profileId) {
            await adminSupabase
                .from("students")
                .update({ instructor_id: null })
                .eq("id", id);
        }

        // 2. Clear the archival state for the student
        await adminSupabase
            .from("students")
            .update({
                is_archived: false,
                archived_at: null,
                archived_by: null
            })
            .eq("id", id);

        // 3. Delete enrollments for this student in classes taught by this instructor
        const { data: instructorClasses } = await adminSupabase
            .from("classes")
            .select("id")
            .eq("instructor_id", profileId);

        const classIds = instructorClasses?.map(c => c.id) || [];
        if (classIds.length > 0) {
            await adminSupabase
                .from("enrollments")
                .delete()
                .eq("student_id", id)
                .in("class_id", classIds);
        }

        // 4. Audit Log
        await adminSupabase.from("audit_logs").insert({
            action: "student_roster_removal",
            entity_type: "student",
            entity_id: id,
            details: `Roster Removal: Student ${student.name} fully removed from instructor roster and classes. Data preserved.`,
            performed_by: user.id,
        });

        revalidatePath("/students");
        revalidatePath("/archived");
        return { success: true };
    }

    // ── CRITICAL DELETE FLOW (Admin) ──
    const fingerprintSlot = student?.fingerprint_slot_id;
    const deviceId = student?.device_id;

    const { data: deviceLinks } = await supabase
        .from("fingerprint_device_links")
        .select("device_serial, fingerprint_slot_id")
        .eq("student_id", id);

    const { error } = await adminSupabase
        .from("students")
        .delete()
        .eq("id", id)
        .eq("is_archived", true);

    if (error) return { error: error.message };

    if (fingerprintSlot && deviceId) {
        // Queue the delete command, fallback if table missing
        const { error: cmdError } = await adminSupabase
            .from("kiosk_commands")
            .insert({
                device_serial: deviceId,
                command: `delete_finger:${fingerprintSlot}`,
                status: 'pending'
            });

        if (cmdError && cmdError.code === '42P01') {
            await adminSupabase
                .from("kiosk_devices")
                .update({ pending_command: `delete_finger:${fingerprintSlot}` })
                .eq("device_serial", deviceId);
            console.log(`[Delete] Fallback: Queued delete_finger:${fingerprintSlot} on device ${deviceId}`);
        } else {
            console.log(`[Delete] Queued delete_finger:${fingerprintSlot} in kiosk_commands for device ${deviceId}`);
        }
    }

    if (deviceLinks && deviceLinks.length > 0) {
        for (const link of deviceLinks) {
            await adminSupabase
                .from("kiosk_commands")
                .insert({
                    device_serial: link.device_serial,
                    command: `delete_finger:${link.fingerprint_slot_id}`,
                    status: 'pending'
                });
            console.log(`[Delete] Queued delete_finger:${link.fingerprint_slot_id} in kiosk_commands for linked device ${link.device_serial}`);
        }
        await adminSupabase.from("fingerprint_device_links").delete().eq("student_id", id);
    }

    if (user) {
        await supabase.from("audit_logs").insert({
            action: "student_permanently_deleted",
            entity_type: "student",
            entity_id: id,
            details: `Student permanently deleted from archive${fingerprintSlot ? ` (fingerprint slot ${fingerprintSlot} queued for hardware wipe)` : ""}`,
            performed_by: user.id,
        });
    }

    revalidatePath("/students");
    revalidatePath("/dashboard/admin/archived");
    return { success: true };
}

// ⚡ BATCH: Delete multiple students SEQUENTIALLY to preserve hardware command queue
export async function bulkPermanentlyDeleteStudents(ids: string[]) {
    if (ids.length === 0) return { success: true };

    const results = [];
    for (const id of ids) {
        results.push(await permanentlyDeleteStudent(id));
    }

    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
        return { error: `Completed with ${errors.length} errors.` };
    }

    return { success: true };
}

export async function clearBiometricData(id: string) {
    const supabase = createClient();
    // Nullify slot_id and device_id
    const { error } = await supabase
        .from("students")
        .update({ fingerprint_slot_id: null, device_id: null })
        .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/students");
    return { success: true };
}

// ─── Bulk Import ────────────────────────────────────────────────────────────

interface StudentRow {
    name: string;
    sin: string;
    year_level: string;
    department?: string;
}

interface BulkStudentResult {
    success: number;
    linked: number;
    failed: { row: number; reason: string }[];
}

const SIN_REGEX = /^\d{2}-\d{5,6}$/;

export async function bulkImportStudents(rows: StudentRow[], classIds: string[], instructorIdOverride?: string): Promise<BulkStudentResult> {
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    let profileId = cookieStore.get("sc_profile_id")?.value;

    // System Admin override
    if (instructorIdOverride) {
        profileId = instructorIdOverride;
    }

    if (!profileId) {
        return { success: 0, linked: 0, failed: [{ row: 0, reason: "Profile not found. Please select a profile." }] };
    }

    const supabase = createClient();

    // Resolve admin-profile to actual UUID
    if (profileId === 'admin-profile') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: adminProfile } = await supabase
                .from('instructors')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();
            if (adminProfile) profileId = adminProfile.id;
        }
    }

    // Validate class ownership (skip for admin and skip if no classes selected)
    if (classIds && classIds.length > 0) {
        const isAdmin = await import("@/lib/auth-utils").then(m => m.checkIsAdmin());

        if (!isAdmin) {
            const { count } = await supabase
                .from("classes")
                .select("*", { count: 'exact', head: true })
                .in("id", classIds)
                .eq("instructor_id", profileId);

            if (count !== classIds.length) {
                return { success: 0, linked: 0, failed: [{ row: 0, reason: "Unauthorized: You can only import students into your own classes." }] };
            }
        }
    }

    const result: BulkStudentResult = { success: 0, linked: 0, failed: [] };

    // ⚡ PHASE 1: Validate all rows upfront (CPU-only, no DB)
    interface ValidatedRow {
        index: number;
        name: string;
        sin: string;
        yearLevel: string;
        department?: string;
    }
    const validRows: ValidatedRow[] = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = row.name?.trim();
        const sin = row.sin?.trim();
        const yearLevel = row.year_level?.trim();

        if (!name || name.length < 2) {
            result.failed.push({ row: i + 1, reason: "Name is missing or too short (min 2 chars)." });
            continue;
        }
        if (!sin || !SIN_REGEX.test(sin)) {
            result.failed.push({ row: i + 1, reason: `Invalid SIN format "${sin || ''}". Expected YY-XXXXX.` });
            continue;
        }
        if (!yearLevel) {
            result.failed.push({ row: i + 1, reason: "Year level is missing." });
            continue;
        }
        validRows.push({ index: i, name, sin, yearLevel, department: row.department?.trim() || undefined });
    }

    if (validRows.length === 0) {
        return result;
    }

    // ⚡ PHASE 2: Batch lookup ALL existing students by SIN in ONE query
    const allSins = validRows.map(r => r.sin);
    const { data: existingStudents } = await supabase
        .from('students')
        .select('id, sin')
        .in('sin', allSins);

    const sinToIdMap = new Map((existingStudents || []).map(s => [s.sin, s.id]));

    // ⚡ PHASE 3: Separate into existing (link) vs new (insert)
    const toInsert: ValidatedRow[] = [];
    const toLink: { row: ValidatedRow; studentId: string }[] = [];

    for (const row of validRows) {
        const existingId = sinToIdMap.get(row.sin);
        if (existingId) {
            toLink.push({ row, studentId: existingId });
        } else {
            toInsert.push(row);
        }
    }

    // ⚡ PHASE 4: Batch INSERT all new students in ONE query
    const insertedStudentIds: Map<string, string> = new Map(); // sin -> id

    if (toInsert.length > 0) {
        const finalInstructorId = profileId === 'admin-profile' || !profileId ? null : profileId;

        const insertPayload = toInsert.map(r => ({
            name: r.name,
            sin: r.sin,
            year_level: r.yearLevel,
            instructor_id: finalInstructorId,
            ...(r.department ? { department: r.department } : {}),
        }));

        const { data: inserted, error: insertError } = await supabase
            .from("students")
            .insert(insertPayload)
            .select("id, sin");

        if (insertError) {
            // If batch insert fails (e.g., duplicate SINs), fall back to one-by-one for detailed errors
            for (const row of toInsert) {
                const finalInstructorId = profileId === 'admin-profile' || !profileId ? null : profileId;
                const { data: single, error: singleError } = await supabase
                    .from("students")
                    .insert({
                        name: row.name,
                        sin: row.sin,
                        year_level: row.yearLevel,
                        instructor_id: finalInstructorId,
                        ...(row.department ? { department: row.department } : {}),
                    })
                    .select("id")
                    .single();

                if (singleError) {
                    if (singleError.code === '23505') {
                        result.failed.push({ row: row.index + 1, reason: `Duplicate SIN "${row.sin}".` });
                    } else {
                        result.failed.push({ row: row.index + 1, reason: singleError.message });
                    }
                } else if (single) {
                    insertedStudentIds.set(row.sin, single.id);
                    result.success++;
                }
            }
        } else {
            // Batch insert succeeded
            inserted?.forEach(s => insertedStudentIds.set(s.sin, s.id));
            result.success = inserted?.length || 0;
        }
    }

    // Count linked
    result.linked = toLink.length;

    // ⚡ PHASE 5: Batch ENROLL all students in ONE upsert
    const allEnrollments: { class_id: string; student_id: string }[] = [];

    for (const { studentId } of toLink) {
        for (const classId of classIds) {
            allEnrollments.push({ class_id: classId, student_id: studentId });
        }
    }
    for (const [, studentId] of Array.from(insertedStudentIds)) {
        for (const classId of classIds) {
            allEnrollments.push({ class_id: classId, student_id: studentId });
        }
    }

    if (allEnrollments.length > 0) {
        const { error: enrollError } = await supabase
            .from("enrollments")
            .upsert(allEnrollments, { onConflict: 'student_id, class_id' });

        if (enrollError) {
            result.failed.push({ row: 0, reason: `Enrollment batch failed: ${enrollError.message}` });
        }
    }

    revalidatePath("/students");
    revalidatePath("/classes");
    return result;
}

// ----------------------------------------------------------------------------
// PHASE 4: INSTRUCTOR CLAIM FROM POOL
// ----------------------------------------------------------------------------
export async function claimStudentsFromPool(studentIds: string[]) {
    const supabase = createClient();
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId || profileId === 'admin-profile') {
        return { error: "Valid instructor profile not found." };
    }

    if (!studentIds || studentIds.length === 0) {
        return { error: "No students selected." };
    }

    const { error } = await supabase
        .from("students")
        .update({ instructor_id: profileId })
        .in("id", studentIds);

    if (error) {
        console.error("Error claiming students:", error);
        return { error: `Failed to claim students: ${error.message}` };
    }

    revalidatePath("/students");
    return { success: true };
}

export async function getPoolStudentsForInstructor() {
    const supabase = createClient();
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    let profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) return { data: [] };

    if (profileId === 'admin-profile') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: adminProfile } = await supabase
                .from('instructors')
                .select('id')
                .eq('auth_user_id', session.user.id)
                .maybeSingle();
            if (adminProfile) profileId = adminProfile.id;
        }
    }

    // Find students the instructor already has in their personal directory (via ownership or class enrollment)
    const [{ data: createdData }, { data: enrolledData }] = await Promise.all([
        supabase.from('students').select('id').eq('instructor_id', profileId),
        supabase.from('enrollments').select('student_id, classes!inner(instructor_id)').eq('classes.instructor_id', profileId)
    ]);

    const alreadyOwnedIds = new Set([
        ...(createdData?.map(s => s.id) || []),
        ...(enrolledData?.map(e => e.student_id) || [])
    ]);

    const { data: poolStudents, error } = await supabase
        .from('students')
        .select('id, name, sin, year_level, department, enrollment_status')
        .or('enrollment_status.eq.active,enrollment_status.is.null')
        .order('name');

    if (error) {
        console.error("Error fetching available pool students:", error);
        return { data: [] };
    }

    // Filter out students the instructor already sees
    const availableToClaim = (poolStudents || []).filter(s => !alreadyOwnedIds.has(s.id));

    return { data: availableToClaim };
}

