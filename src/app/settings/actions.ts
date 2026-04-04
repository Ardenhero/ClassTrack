"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function deleteAccount() {
    const supabase = createClient();

    // Call the secure RPC function to delete the authenticated user
    const { error } = await supabase.rpc('delete_own_user');

    if (error) {
        console.error("Error deleting account:", error);
        return { error: error.message };
    }

    // Sign out to clean up session
    await supabase.auth.signOut({ scope: 'local' });
    revalidatePath("/", "layout");
    redirect("/login");
}


export async function togglePin(instructorId: string, enabled: boolean) {
    const supabase = createClient();
    const { error } = await supabase
        .from('instructors')
        .update({ pin_enabled: enabled })
        .eq('id', instructorId);

    if (error) {
        console.error("Error toggling PIN:", error);
        return { error: error.message };
    }

    revalidatePath("/identity");
    return { success: true };
}

export async function createAcademicYear(name: string) {
    const supabase = createClient();
    const { error } = await supabase.from("academic_years").insert({ name });
    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { success: true };
}

export async function setActiveAcademicYear(yearId: string) {
    const supabase = createClient();
    // 1. Deactivate all currently active
    await supabase.from("academic_years").update({ is_active: false }).is("is_active", true);
    // 2. Activate target
    const { error } = await supabase.from("academic_years").update({ is_active: true }).eq("id", yearId);
    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { success: true };
}

export async function deleteAcademicYear(yearId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("academic_years").delete().eq("id", yearId);
    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { success: true };
}

export async function deactivateAllAcademicYears() {
    const supabase = createClient();
    const { error } = await supabase.from("academic_years").update({ is_active: false }).is("is_active", true);
    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { success: true };
}

export async function createAcademicTerm(data: { academic_year_id: string; name: string; start_date: string; end_date: string }) {
    const supabase = createClient();
    const { error } = await supabase.from("academic_terms").insert(data);
    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { success: true };
}

export async function setActiveAcademicTerm(termId: string) {
    const supabase = createClient();
    // 1. Deactivate all terms
    await supabase.from("academic_terms").update({ is_active: false }).is("is_active", true);
    // 2. Activate target
    const { error } = await supabase.from("academic_terms").update({ is_active: true }).eq("id", termId);
    if (error) return { error: error.message };
    revalidatePath("/settings");
    revalidatePath("/classes");
    return { success: true };
}

export async function deleteAcademicTerm(termId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("academic_terms").delete().eq("id", termId);
    if (error) return { error: error.message };
    revalidatePath("/settings");
    revalidatePath("/classes");
    return { success: true };
}

export async function deactivateAllAcademicTerms() {
    const supabase = createClient();
    const { error } = await supabase.from("academic_terms").update({ is_active: false }).is("is_active", true);
    if (error) return { error: error.message };
    revalidatePath("/settings");
    revalidatePath("/classes");
    return { success: true };
}

export async function assignLegacyClassesToTerm(termId: string) {
    const supabase = createClient();
    const { error } = await supabase
        .from("classes")
        .update({ term_id: termId })
        .is("term_id", null);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/classes");
    return { success: true };
}

export async function promoteStudentsBatch(studentIds: string[], newGradeLevel: string, newStatus: string = 'active') {
    const adminSupabase = createAdminClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    const { error } = await adminSupabase
        .from("students")
        .update({
            year_level: newGradeLevel,
            enrollment_status: newStatus,
            updated_at: new Date().toISOString()
        })
        .in("id", studentIds);

    if (error) return { error: error.message };

    // Audit log
    if (profileId) {
        await adminSupabase.from("audit_logs").insert({
            action: "batch_promotion",
            entity_type: "students",
            details: `Promoted ${studentIds.length} students to ${newGradeLevel}`,
            performed_by: profileId
        });
    }

    revalidatePath("/enrollment-list");
    return { success: true };
}

export async function endCurrentSemester(semesterId: string) {
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) return { error: "Not authorized" };

    // 1. Mark semester as inactive
    const { error: semError } = await supabase
        .from("semesters")
        .update({ is_active: false })
        .eq("id", semesterId);

    if (semError) return { error: semError.message };

    // 2. Archive all active classes
    await supabase
        .from("classes")
        .update({ is_archived: true })
        .eq("is_archived", false);

    // 3. Archive all active students (using a direct bypass or the secure RPC per student)
    // To do it in bulk for all students in the system safely, we do a direct update.
    // However, RLS students restricts this unless we use service_role. We can use service_role here 
    // because this is a system admin wide action.
    const adminSupabase = createAdminClient();

    await adminSupabase
        .from("students")
        .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            archived_by: profileId
        })
        .eq("is_archived", false);

    // 4. Audit log
    await adminSupabase.from("audit_logs").insert({
        action: "semester_ended",
        entity_type: "system",
        entity_id: semesterId,
        details: "Ended semester and mass-archived all classes and students",
        performed_by: profileId
    });

    revalidatePath("/settings");
    revalidatePath("/classes");
    revalidatePath("/students");
    return { success: true };
}

export async function permanentlyDeleteInstructor(instructorId: string) {
    const adminSupabase = createAdminClient();

    // Evidence data
    await adminSupabase.from('evidence_date_links').delete().in('evidence_id',
        (await adminSupabase.from('evidence_documents').select('id').in('student_id',
            (await adminSupabase.from('students').select('id').eq('instructor_id', instructorId)).data?.map((s: { id: string }) => s.id) || []
        )).data?.map((e: { id: string }) => e.id) || []
    );

    // Delete evidence documents
    await adminSupabase.from('evidence_documents').delete().in('student_id',
        (await adminSupabase.from('students').select('id').eq('instructor_id', instructorId)).data?.map((s: { id: string }) => s.id) || []
    );

    // Delete fingerprint links
    await adminSupabase.from('fingerprint_device_links').delete().in('student_id',
        (await adminSupabase.from('students').select('id').eq('instructor_id', instructorId)).data?.map((s: { id: string }) => s.id) || []
    );

    // Delete attendance logs
    await adminSupabase.from('attendance_logs').delete().in('student_id',
        (await adminSupabase.from('students').select('id').eq('instructor_id', instructorId)).data?.map((s: { id: string }) => s.id) || []
    );

    // Delete enrollments
    await adminSupabase.from('enrollments').delete().in('student_id',
        (await adminSupabase.from('students').select('id').eq('instructor_id', instructorId)).data?.map((s: { id: string }) => s.id) || []
    );

    // Delete students
    await adminSupabase.from('students').delete().eq('instructor_id', instructorId);

    // Delete classes
    await adminSupabase.from('classes').delete().eq('instructor_id', instructorId);

    // 2. Delete the instructor profile
    const { error } = await adminSupabase
        .from('instructors')
        .delete()
        .eq('id', instructorId);

    if (error) {
        console.error("Error deleting instructor profile:", error);
        return { error: error.message };
    }

    revalidatePath("/dashboard/admin/instructors");
    return { success: true };
}

export async function deletePhotoAction(tableName: 'students' | 'instructors', recordId: string) {
    try {
        console.log(`[deletePhotoAction] Removing photo for ${tableName}:${recordId}`);
        const adminSupabase = createAdminClient();

        const { error: dbError } = await adminSupabase
            .from(tableName)
            .update({ image_url: null })
            .eq('id', recordId);

        if (dbError) throw dbError;

        return { success: true };
    } catch (err) {
        console.error("[deletePhotoAction] Failed:", err);
        const error = err as { message?: string; error_description?: string };
        return { error: error?.message || error?.error_description || "Failed to update database" };
    }
}

export async function initializeStorage() {
    try {
        const adminSupabase = createAdminClient();

        // Silently ensure bucket exists
        const { data: buckets } = await adminSupabase.storage.listBuckets();
        const exists = buckets?.some(b => b.name === 'profile-photos');

        if (!exists) {
            console.log("Initializing profile-photos storage bucket...");
            const { error: createError } = await adminSupabase.storage.createBucket('profile-photos', {
                public: true,
                fileSizeLimit: 2097152 // 2MB
            });

            if (createError && !createError.message.includes('already exists')) {
                throw createError;
            }

            // Set public read policy via RPC or manual check
            // Note: service role creates public buckets as public, but we ensure policies here if needed
        }

        return { success: true };
    } catch (err) {
        console.error("Failed to initialize storage bucket:", err);
        return { error: err instanceof Error ? err.message : "Unknown storage error" };
    }
}

/**
 * Server Action to upload a photo bypassing RLS (using service role).
 * This solves the "violates RLS policy" error for unauthenticated portal students.
 */
export async function uploadPhotoAction(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        const uploadPath = formData.get('uploadPath') as string;
        const tableName = formData.get('tableName') as 'students' | 'instructors';
        const recordId = formData.get('recordId') as string;

        console.log(`[uploadPhotoAction] Starting upload for ${tableName}:${recordId} to ${uploadPath}`);

        if (!file || !uploadPath || !tableName || !recordId) {
            console.error("[uploadPhotoAction] Missing fields:", { file: !!file, uploadPath, tableName, recordId });
            return { error: "Missing required fields for upload" };
        }

        const adminSupabase = createAdminClient();

        // 1. Get current photo URL to delete it later
        const { data: record } = await adminSupabase
            .from(tableName)
            .select('image_url')
            .eq('id', recordId)
            .single();

        const oldImageUrl = record?.image_url;

        // 2. Generate new unique path (Content-Addressing hack for eternal cache)
        // Original: students/123.jpg -> New: students/123_1710712345.jpg
        const fileExt = file.name.split('.').pop() || 'jpg';
        const pathParts = uploadPath.split('/');
        const baseDir = pathParts.length > 1 ? pathParts[0] : '';
        const timestamp = Date.now();
        const newPath = `${baseDir}/${recordId}_${timestamp}.${fileExt}`;

        console.log(`[uploadPhotoAction] Using unique path: ${newPath}`);

        // 3. Upload to Supabase Storage with 1-year immutable cache
        const { error: uploadError } = await adminSupabase.storage
            .from('profile-photos')
            .upload(newPath, file, {
                upsert: true,
                contentType: file.type,
                cacheControl: 'public, max-age=31536000, immutable'
            });

        if (uploadError) {
            console.error("[uploadPhotoAction] Storage error:", uploadError);
            throw uploadError;
        }

        // 4. Get Public URL
        const { data: { publicUrl } } = adminSupabase.storage
            .from('profile-photos')
            .getPublicUrl(newPath);

        // 5. Update Database with the NEW URL
        const { error: dbError } = await adminSupabase
            .from(tableName)
            .update({ image_url: publicUrl })
            .eq('id', recordId);

        if (dbError) {
            console.error("[uploadPhotoAction] DB Update error:", dbError);
            throw dbError;
        }

        // 6. Cleanup: Delete OLD photo from storage if it was a Supabase URL
        if (oldImageUrl && oldImageUrl.includes('supabase.co')) {
            try {
                const oldPath = oldImageUrl.split('/').pop();
                if (oldPath) {
                    await adminSupabase.storage.from('profile-photos').remove([`${baseDir}/${oldPath}`]);
                }
            } catch (cleanupErr) {
                console.warn("[uploadPhotoAction] Cleanup failed (non-fatal):", cleanupErr);
            }
        }

        // Scoped revalidation to avoid full page reloads where possible
        revalidatePath("/settings");
        revalidatePath("/student/portal");

        return { success: true, publicUrl };
    } catch (err) {
        console.error('Error in uploadPhotoAction:', err);
        const error = err as { message?: string; error_description?: string };
        return { error: error?.message || error?.error_description || "Upload failed" };
    }
}
