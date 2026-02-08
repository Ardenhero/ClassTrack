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
    const supabase = createClient();

    const rawData = {
        name: formData.get("name") as string,
        description: formData.get("description") as string || "",
        start_time: formData.get("start_time") as string,
        end_time: formData.get("end_time") as string,
        year_level: formData.get("year_level") as string
    };

    const parseResult = ClassSchema.safeParse(rawData);

    if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return { error: `${firstError.path.join('.')}: ${firstError.message}` };
    }

    const { name, description, start_time, end_time, year_level } = parseResult.data;

    // Get Profile ID from cookie
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) {
        return { error: "Profile not found. Please select a profile." };
    }

    const { error } = await supabase
        .from("classes")
        .insert({
            name,
            description,
            start_time,
            end_time,
            year_level,
            instructor_id: profileId
        });

    if (error) {
        return { error: error.message };
    }

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
