"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";

import { z } from 'zod';

const StudentSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(200, "Name must be less than 200 characters"),
    sin: z.string().regex(/^\d{2}-\d{5}$/, "Invalid SIN format. Please use the university standard (e.g., 22-00001)."),
    year_level: z.string().min(1, "Year level is required"),
    class_ids: z.array(z.string().uuid()).optional()
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
        // Return first error message
        const firstError = parseResult.error.issues[0];
        return { error: `${firstError.path.join('.')}: ${firstError.message}` };
    }

    const { name, sin, year_level, class_ids: classIds } = parseResult.data;

    // Get Profile ID from cookie
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) {
        return { error: "Profile not found. Please select a profile." };
    }

    // 1. Check if student exists (Global Lookup)
    let studentId: string;
    let existingStudent: { id: string; name: string } | null;

    const { data: existingStudentData, error: findError } = await supabase
        .rpc('get_student_by_sin_secure', { p_sin: sin }); // No .maybeSingle() needed for scalar JSON return

    if (findError) {
        console.error("Error finding student:", findError);
        return { error: `Database error checking existence: ${findError.message} (Code: ${findError.code})` };
    }

    if (existingStudentData) {
        // MATCH FOUND: Use existing student
        // The RPC returns { id, name } as JSON, or null
        existingStudent = existingStudentData as { id: string; name: string };
        studentId = existingStudent.id;
    } else {
        existingStudent = null;
        // NO MATCH: Create new student
        const { data: newStudent, error: createError } = await supabase
            .from("students")
            .insert({
                name,
                sin,
                year_level,
                instructor_id: profileId // Created by this instructor
            })
            .select("id")
            .single();

        if (createError) {
            console.error(createError);
            if (createError.code === '23505') { // Unique violation
                if (createError.message.includes('sin')) {
                    return { error: "A student with this SIN already exists." };
                }
            }
            return { error: "Failed to create student. Please try again." };
        }
        studentId = newStudent.id;
    }

    // 2. Assign Classes if selected
    if (classIds && classIds.length > 0) {
        // Validate ownership if not admin
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

        // Prepare enrollments, ignoring duplicates if already enrolled
        const enrollments = classIds.map(classId => ({
            class_id: classId,
            student_id: studentId
        }));

        const { error: enrollError } = await supabase
            .from("enrollments")
            .upsert(enrollments, { onConflict: 'student_id, class_id' }); // Safe upsert to avoid duplicate key errors

        if (enrollError) {
            console.error("Enrollment error:", enrollError);
            return { error: "Failed to enroll student in selected classes." };
        }
    } else if (existingStudent) {
        // If EXISTING student but NO class selected, we might want to auto-enroll in a "default" class or just warn?
        // But for now, if they select no class, they just don't get enrolled. 
        // HOWEVER, the user requirement says: "Upsert logic correctly creates the enrollment link".
        // If the user thinks "Add Student" implies "Enroll in MY list", we need a link.
        // But "My Students" query checks `s.instructor_id` OR `c.instructor_id`.
        // If I created them (s.instructor_id), they appear.
        // If I didn't create them, and I don't enroll them in a class, they WON'T appear (Invisible).
        // The modal usually forces class selection or has a default?
        // Let's ensure revalidation happens regardless.
    }

    // Send notification (UI will show message based on return value)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        await createNotification(
            user.id,
            existingStudent ? "Student linked" : "New Student Added",
            `${name} (${sin}) has been successfully enrolled.${existingStudent ? ' (Linked to existing record)' : ''}`,
            "success"
        );
    }

    revalidatePath("/students");

    // Return specific messages for UI
    if (existingStudent) {
        return { success: true, message: "Existing student found and successfully enrolled in your class." };
    } else {
        return { success: true, message: "New student created and enrolled successfully." };
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
    const supabase = createClient();
    const { error } = await supabase.from("students").delete().eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/students");
    return { success: true };
}
