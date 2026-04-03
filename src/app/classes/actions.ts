"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

import { z } from 'zod';

const ClassSchema = z.object({
    name: z.string().min(1, "Class name is required").max(200, "Class name must be less than 200 characters"),
    description: z.string().max(500, "Description must be less than 500 characters").optional(),
    start_time: z.string().regex(/^(\d{1,2}:\d{2}(\s?[AP]M)?)$/i, "Start time must be in HH:MM or HH:MM AM/PM format"),
    end_time: z.string().regex(/^(\d{1,2}:\d{2}(\s?[AP]M)?)$/i, "End time must be in HH:MM or HH:MM AM/PM format"),
    year_level: z.string().min(1, "Year level is required"),
    schedule_days: z.string().min(1, "At least one schedule day is required"),
    term_id: z.string().uuid().optional()
});

export async function addClass(formData: FormData) {
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

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const start_time = formData.get("start_time") as string;
    const end_time = formData.get("end_time") as string;
    const year_level = formData.get("year_level") as string;
    const schedule_days = formData.get("schedule_days") as string;

    const parseResult = ClassSchema.safeParse({
        name,
        description,
        start_time,
        end_time,
        year_level,
        schedule_days
    });

    if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return { error: `${firstError.path.join(".")}: ${firstError.message}` };
    }

    const supabase = createClient();

    // Fetch active term automatically
    const { data: activeTerm } = await supabase
        .from('academic_terms')
        .select('id')
        .eq('is_active', true)
        .single();

    const { error } = await supabase.from("classes").insert({
        name,
        description: description || '',
        start_time,
        end_time,
        year_level,
        schedule_days,
        day_of_week: schedule_days, // Keep day_of_week in sync for kiosk API compatibility
        instructor_id: profileId,
        term_id: activeTerm?.id || null
    });

    if (error) return { error: error.message };
    revalidatePath("/classes");
    return { success: true };
}

export async function deleteClass(classId: string) {
    // PRODUCTION HARDENING: Archive instead of delete
    return archiveClass(classId);
}

export async function archiveClass(classId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Use sc_profile_id cookie for the archiver ID
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    // Fetch class name for audit log
    const { data: classData } = await supabase
        .from("classes")
        .select("name")
        .eq("id", classId)
        .single();

    const { error } = await supabase
        .from("classes")
        .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            archived_by: profileId || null,
        })
        .eq("id", classId);

    if (error) return { error: error.message };

    if (user && classData) {
        await supabase.from("audit_logs").insert({
            action: "class_archived",
            entity_type: "class",
            entity_id: classId,
            details: `Class ${classData.name} moved to archive`,
            performed_by: user.id,
        });
    }

    revalidatePath("/classes");
    return { success: true };
}

export async function updateClass(classId: string, formData: FormData) {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const start_time = formData.get("start_time") as string;
    const end_time = formData.get("end_time") as string;
    const year_level = formData.get("year_level") as string;
    const schedule_days = formData.get("schedule_days") as string;

    const parseResult = ClassSchema.safeParse({
        name,
        description,
        start_time,
        end_time,
        year_level,
        schedule_days
    });

    if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return { error: `${firstError.path.join(".")}: ${firstError.message}` };
    }

    const supabase = createClient();
    const { error } = await supabase.from("classes").update({
        name,
        description: description || '',
        start_time,
        end_time,
        year_level,
        schedule_days,
        day_of_week: schedule_days, // Keep in sync for kiosk
    }).eq("id", classId);

    if (error) return { error: error.message };

    // Audit log
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        await supabase.from("audit_logs").insert({
            action: "class_updated",
            entity_type: "class",
            entity_id: classId,
            details: `Updated class details: ${name}`,
            performed_by: user.id,
        });
    }

    revalidatePath("/classes");
    revalidatePath(`/classes/${classId}`);
    return { success: true };
}

export async function restoreClass(classId: string) {
    const supabase = createClient();
    // Fetch class name for audit log
    const { data: classData } = await supabase
        .from("classes")
        .select("name")
        .eq("id", classId)
        .single();

    const { error } = await supabase
        .from("classes")
        .update({
            is_archived: false,
            archived_at: null,
            archived_by: null,
        })
        .eq("id", classId);

    if (error) return { error: error.message };

    const { data: { user } } = await supabase.auth.getUser();
    if (user && classData) {
        await supabase.from("audit_logs").insert({
            action: "class_restored",
            entity_type: "class",
            entity_id: classId,
            details: `Class ${classData.name} restored from archive`,
            performed_by: user.id,
        });
    }

    revalidatePath("/classes");
    return { success: true };
}

export async function permanentlyDeleteClass(classId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch class name for audit log
    const { data: classData } = await supabase
        .from("classes")
        .select("name")
        .eq("id", classId)
        .single();

    const { error } = await supabase
        .from("classes")
        .delete()
        .eq("id", classId)
        .eq("is_archived", true); // Safety: only permanently delete if already archived

    if (error) return { error: error.message };

    if (user && classData) {
        await supabase.from("audit_logs").insert({
            action: "class_permanently_deleted",
            entity_type: "class",
            entity_id: classId,
            details: `Class ${classData.name} permanently deleted from archive`,
            performed_by: user.id,
        });
    }

    revalidatePath("/classes");
    revalidatePath("/dashboard/admin/archived");
    return { success: true };
}

// ⚡ BATCH: Delete multiple classes in ONE query
export async function bulkPermanentlyDeleteClasses(ids: string[]) {
    if (ids.length === 0) return { success: true };
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from("classes")
        .delete()
        .in("id", ids);

    if (error) return { error: error.message };

    if (user) {
        await supabase.from("audit_logs").insert({
            action: "classes_bulk_deleted",
            entity_type: "class",
            entity_id: ids[0],
            details: `Bulk permanently deleted ${ids.length} classes`,
            performed_by: user.id,
        });
    }

    revalidatePath("/classes");
    revalidatePath("/dashboard/admin/archived");
    return { success: true };
}

// ─── Bulk Import ────────────────────────────────────────────────────────────

interface ClassRow {
    name: string;
    start_time: string;
    end_time: string;
    year_level: string;
    department?: string;
    schedule_days?: string;
    description?: string;
}

interface BulkClassResult {
    success: number;
    failed: { row: number; reason: string }[];
}

export async function bulkImportClasses(rows: ClassRow[], instructorIdOverride?: string): Promise<BulkClassResult> {
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    let profileId = cookieStore.get("sc_profile_id")?.value;

    // System Admin override
    if (instructorIdOverride) {
        profileId = instructorIdOverride;
    }

    if (!profileId) {
        return { success: 0, failed: [{ row: 0, reason: "Profile not found. Please select a profile." }] };
    }

    const supabase = createClient();
    const result: BulkClassResult = { success: 0, failed: [] };

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Normalize time formats: handle "8:00 AM" -> "08:00", "01:30 PM" -> "13:30", etc.
        const normalizeTime = (t: string) => {
            if (!t) return t;
            const timeStr = t.trim().toUpperCase();

            // Handle AM/PM
            const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s?([AP]M)$/);
            if (ampmMatch) {
                let hours = parseInt(ampmMatch[1], 10);
                const minutes = ampmMatch[2];
                const ampm = ampmMatch[3];

                if (ampm === 'PM' && hours < 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;

                return hours.toString().padStart(2, '0') + ':' + minutes;
            }

            // Handle standard HH:MM
            const parts = timeStr.split(':');
            if (parts.length === 2) {
                return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
            }
            return t.trim();
        };

        const normalized = {
            name: row.name?.trim() || '',
            start_time: normalizeTime(row.start_time || ''),
            end_time: normalizeTime(row.end_time || ''),
            year_level: row.year_level?.trim() || '',
            schedule_days: row.schedule_days?.trim() || '',
            description: row.description?.trim() || ''
        };

        const parseResult = ClassSchema.safeParse(normalized);

        if (!parseResult.success) {
            const firstError = parseResult.error.issues[0];
            result.failed.push({ row: i + 1, reason: `${firstError.path.join('.')}: ${firstError.message}` });
            continue;
        }

        const { name, description, start_time, end_time, year_level, schedule_days } = parseResult.data;

        // Fetch active term automatically
        const { data: activeTerm } = await supabase
            .from('academic_terms')
            .select('id')
            .eq('is_active', true)
            .single();

        const { error } = await supabase
            .from("classes")
            .insert({
                name,
                description: description || '',
                start_time,
                end_time,
                year_level,
                schedule_days,
                day_of_week: schedule_days, // Keep in sync for kiosk
                instructor_id: profileId,
                term_id: activeTerm?.id || null
            });

        if (error) {
            result.failed.push({ row: i + 1, reason: error.message });
        } else {
            result.success++;
        }
    }

    revalidatePath("/classes");
    return result;
}

