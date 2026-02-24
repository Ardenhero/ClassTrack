"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";
import { z } from 'zod';

const StudentSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(200, "Name must be less than 200 characters"),
    sin: z.string().regex(/^\d{2}-\d{5,6}$/, "Invalid SIN format. Use YY-XXXXX or YY-XXXXXX (e.g., 22-00001)"),
    year_level: z.string().min(1, "Year level is required"),
    class_ids: z.array(z.string().uuid()).min(1, "At least one class must be selected") // MANDATORY
});

export async function addStudent(formData: FormData) {
    const supabase = createClient();

    const rawData = {
        name: formData.get("name"),
        sin: formData.get("sin"),
        year_level: formData.get("year_level"),
        class_ids: formData.get("class_ids") ? JSON.parse(formData.get("class_ids") as string) : []
    };

    const parseResult = StudentSchema.safeParse(rawData);
    if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return { error: `${firstError.path.join('.')}: ${firstError.message}` };
    }

    const { name, sin, year_level, class_ids: classIds } = parseResult.data;

    // Guardian contact (optional)
    const guardian_email = (formData.get("guardian_email") as string)?.trim() || null;
    const guardian_name = (formData.get("guardian_name") as string)?.trim() || null;

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
                .eq('user_id', user.id)
                .maybeSingle();

            if (adminProfile) {
                profileId = adminProfile.id;
            } else {
                // AUTO-CREATE Admin Profile if missing
                const { data: newProfile, error: createProfileError } = await supabase
                    .from('instructors')
                    .insert({
                        user_id: user.id,
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
        const { data: newStudent, error: createError } = await supabase
            .from("students")
            .insert({
                name,
                sin,
                year_level,
                instructor_id: profileId,
                guardian_email,
                guardian_name,
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
            return { error: "Failed to create student. Please try again." };
        }

        studentId = newStudent.id;
        console.log(`Created new student: ${name} (${studentId})`);
    }

    // STEP 2: Validate Class Ownership (Security Check)
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

    // STEP 3: Create Enrollments (CRITICAL for Visibility)
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
            message: `Existing student "${existingStudent.name}" successfully enrolled in your ${classIds.length} class(es).`
        };
    } else {
        return {
            success: true,
            message: `New student "${name}" created and enrolled in ${classIds.length} class(es).`
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
            .select("id, name, description, instructors(name)")
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

export async function deleteStudent(id: string) {
    // PRODUCTION HARDENING: Archive instead of delete
    return archiveStudent(id);
}

export async function archiveStudent(id: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get archiver profile
    let archivedBy: string | null = null;
    if (user) {
        const { data: profile } = await supabase
            .from('instructors')
            .select('id')
            .eq('auth_user_id', user.id)
            .single();
        archivedBy = profile?.id || null;
    }

    const { error } = await supabase
        .from("students")
        .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            archived_by: archivedBy,
        })
        .eq("id", id);

    if (error) return { error: error.message };

    // Audit log
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
    return { success: true };
}

export async function restoreStudent(id: string) {
    const supabase = createClient();
    const { error } = await supabase
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
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", id)
        .eq("is_archived", true); // Safety: only permanently delete if already archived

    if (error) return { error: error.message };

    if (user) {
        await supabase.from("audit_logs").insert({
            action: "student_permanently_deleted",
            entity_type: "student",
            entity_id: id,
            details: "Student permanently deleted from archive",
            performed_by: user.id,
        });
    }

    revalidatePath("/students");
    revalidatePath("/dashboard/admin/archived");
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

    if (!classIds || classIds.length === 0) {
        return { success: 0, linked: 0, failed: [{ row: 0, reason: "At least one class must be selected." }] };
    }

    // Validate class ownership (skip for admin)
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

    const result: BulkStudentResult = { success: 0, linked: 0, failed: [] };

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = row.name?.trim();
        const sin = row.sin?.trim();
        const yearLevel = row.year_level?.trim();

        // Validate required fields
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

        // Registry check
        let studentId: string;
        let wasLinked = false;

        try {
            const { data: existing, error: findError } = await supabase
                .rpc('get_student_by_sin_secure', { p_sin: sin });

            if (findError) {
                result.failed.push({ row: i + 1, reason: `Registry check failed: ${findError.message}` });
                continue;
            }

            if (existing) {
                // Existing student — link to class
                studentId = (existing as { id: string }).id;
                wasLinked = true;
            } else {
                // New student — insert
                const { data: newStudent, error: createError } = await supabase
                    .from("students")
                    .insert({
                        name,
                        sin,
                        year_level: yearLevel,
                        instructor_id: profileId,
                    })
                    .select("id")
                    .single();

                if (createError) {
                    if (createError.code === '23505') {
                        result.failed.push({ row: i + 1, reason: `Duplicate SIN "${sin}".` });
                    } else {
                        result.failed.push({ row: i + 1, reason: createError.message });
                    }
                    continue;
                }
                studentId = newStudent.id;
            }

            // Create enrollments
            const enrollments = classIds.map(classId => ({
                class_id: classId,
                student_id: studentId,
            }));

            const { error: enrollError } = await supabase
                .from("enrollments")
                .upsert(enrollments, { onConflict: 'student_id, class_id' });

            if (enrollError) {
                result.failed.push({ row: i + 1, reason: `Enrollment failed: ${enrollError.message}` });
                continue;
            }

            if (wasLinked) {
                result.linked++;
            } else {
                result.success++;
            }
        } catch (err) {
            result.failed.push({ row: i + 1, reason: `Unexpected error: ${String(err)}` });
        }
    }

    revalidatePath("/students");
    revalidatePath("/classes");
    return result;
}
