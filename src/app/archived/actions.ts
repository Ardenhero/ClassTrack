"use server";

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Fetches archived students and classes using service role to bypass RLS.
 * This ensures instructors can see what they've archived even if they don't "own" the student.
 */
export async function getArchivedItems(profileId: string, role: string, isSuperAdmin: boolean) {
    const adminSupabase = createSupabaseClient(supabaseUrl, supabaseServiceKey);

    try {
        if (isSuperAdmin) {
            const [stuRes, clsRes] = await Promise.all([
                adminSupabase.from("students").select("id, name, sin, year_level, archived_at").eq("is_archived", true).order("archived_at", { ascending: false }),
                adminSupabase.from("classes").select("id, name, year_level, archived_at").eq("is_archived", true).order("archived_at", { ascending: false }),
            ]);
            return {
                students: stuRes.data || [],
                classes: clsRes.data || [],
            };
        }

        if (role === "admin") {
            // For Dept Admins, we look for anything in their department (since they are department-wide)
            // or anything they personally archived.
            const { data: adminRecord } = await adminSupabase
                .from("instructors")
                .select("department_id")
                .eq("id", profileId)
                .single();

            const deptId = adminRecord?.department_id;

            const [stuRes, clsRes] = await Promise.all([
                adminSupabase.from("students")
                    .select("id, name, sin, year_level, archived_at, department")
                    .eq("is_archived", true)
                    .or(`instructor_id.eq.${profileId},archived_by.eq.${profileId},department.eq.${deptId}`)
                    .order("archived_at", { ascending: false }),
                adminSupabase.from("classes")
                    .select("id, name, year_level, archived_at, department")
                    .eq("is_archived", true)
                    .or(`instructor_id.eq.${profileId},archived_by.eq.${profileId},department.eq.${deptId}`)
                    .order("archived_at", { ascending: false }),
            ]);

            return {
                students: stuRes.data || [],
                classes: clsRes.data || [],
            };
        }

        // Regular Instructor: See items they own OR items they personally archived
        const [stuRes, clsRes] = await Promise.all([
            adminSupabase.from("students")
                .select("id, name, sin, year_level, archived_at")
                .eq("is_archived", true)
                .or(`instructor_id.eq.${profileId},archived_by.eq.${profileId}`)
                .order("archived_at", { ascending: false }),
            adminSupabase.from("classes")
                .select("id, name, year_level, archived_at")
                .eq("is_archived", true)
                .or(`instructor_id.eq.${profileId},archived_by.eq.${profileId}`)
                .order("archived_at", { ascending: false }),
        ]);

        return {
            students: stuRes.data || [],
            classes: clsRes.data || [],
        };
    } catch (error) {
        console.error("Error fetching archived items:", error);
        return { students: [], classes: [], error: "Failed to fetch archived items" };
    }
}
