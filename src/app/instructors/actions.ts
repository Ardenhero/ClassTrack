"use server";

import { createClient } from "@/utils/supabase/server";
import { getProfile, checkIsSuperAdmin } from "@/lib/auth-utils";

interface InstructorOption {
    id: string;
    name: string;
    department_id: string | null;
}

export async function getInstructorList(): Promise<InstructorOption[]> {
    const supabase = createClient();
    const profile = await getProfile();
    const isSuperAdmin = await checkIsSuperAdmin();

    if (!profile) return [];

    let query = supabase
        .from("instructors")
        .select("id, name, department_id")
        .eq("is_super_admin", false);

    // If NOT Super Admin, scope to the user's own department
    if (!isSuperAdmin && profile.department_id) {
        query = query.eq("department_id", profile.department_id);
    }

    const { data, error } = await query.order("name");

    if (error) {
        console.error("Error fetching instructor list:", error);
        return [];
    }

    return data || [];
}
