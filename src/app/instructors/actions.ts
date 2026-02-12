"use server";

import { createClient } from "@/utils/supabase/server";

interface InstructorOption {
    id: string;
    name: string;
    department_id: string | null;
}

export async function getInstructorList(): Promise<InstructorOption[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("instructors")
        .select("id, name, department_id")
        .eq("is_super_admin", false)
        .neq("role", "admin") // Filter out System Admins
        .order("name");

    if (error) {
        console.error("Error fetching instructor list:", error);
        return [];
    }

    return data || [];
}
