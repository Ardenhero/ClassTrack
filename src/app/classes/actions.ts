"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

import { z } from 'zod';

const ClassSchema = z.object({
    name: z.string().min(1, "Class name is required").max(200, "Class name must be less than 200 characters"),
    description: z.string().max(500, "Description must be less than 500 characters").optional(),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be in HH:MM format"),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, "End time must be in HH:MM format"),
    year_level: z.string().min(1, "Year level is required")
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

    const parseResult = ClassSchema.safeParse({
        name,
        description,
        start_time,
        end_time,
        year_level,
    });

    if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return { error: `${firstError.path.join(".")}: ${firstError.message}` };
    }

    const supabase = createClient();
    const { error } = await supabase.from("classes").insert({
        name,
        description: description || '',
        start_time,
        end_time,
        year_level,
        instructor_id: profileId,
    });

    if (error) return { error: error.message };
    revalidatePath("/classes");
    return { success: true };
}

export async function deleteClass(classId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("classes").delete().eq("id", classId);

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/classes");
    return { success: true };
}

// ─── Bulk Import ────────────────────────────────────────────────────────────

interface ClassRow {
    name: string;
    start_time: string;
    end_time: string;
    year_level: string;
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

        // Normalize time formats: accept "8:00" → "08:00"
        const normalizeTime = (t: string) => {
            if (!t) return t;
            const parts = t.trim().split(':');
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
            description: row.description?.trim() || ''
        };

        const parseResult = ClassSchema.safeParse(normalized);

        if (!parseResult.success) {
            const firstError = parseResult.error.issues[0];
            result.failed.push({ row: i + 1, reason: `${firstError.path.join('.')}: ${firstError.message}` });
            continue;
        }

        const { name, description, start_time, end_time, year_level } = parseResult.data;

        const { error } = await supabase
            .from("classes")
            .insert({
                name,
                description: description || '',
                start_time,
                end_time,
                year_level,
                instructor_id: profileId,
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
