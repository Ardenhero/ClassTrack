"use server";

import { createClient } from '@/utils/supabase/server';

export interface Department {
    id: string;
    name: string;
    code: string;
    college: string;
}

/**
 * Fetch active departments from the database.
 * These are created by the Super Admin in the admin panel.
 */
export async function getActiveDepartments(profileId?: string): Promise<Department[]> {
    const supabase = createClient();

    // Base select query
    let query = supabase
        .from('departments')
        .select('id, name, code, college')
        .eq('is_active', true);

    if (profileId) {
        // 1. Check if super admin using our unified utility
        const { checkIsSuperAdmin, getProfile, getProfileRole } = await import("@/lib/auth-utils");
        const isSuperAdmin = await checkIsSuperAdmin();

        // 2. If not super admin, we must scope the departments
        if (!isSuperAdmin) {
            // Resolve profileId to actual UUID if it's the legacy 'admin-profile' string
            const profile = await getProfile();
            const actualProfileId = profile?.id || profileId;

            // Get Home Department & its College
            const { data: instructor } = await supabase
                .from('instructors')
                .select('department_id, departments(college)')
                .eq('id', actualProfileId)
                .single();

            // @ts-expect-error - Supabase joined type inference limitation
            const homeCollege = instructor?.departments?.college as string | undefined;

            // Get explicitly assigned "Cross-Teaching" departments by scanning classes
            const { data: assignedClasses } = await supabase
                .from('classes')
                .select('department')
                .eq('instructor_id', actualProfileId);

            const crossTaughtDeptNames = Array.from(new Set(
                (assignedClasses || []).map(c => c.department).filter(Boolean)
            ));

            // Execute the scoped request
            const role = await getProfileRole();
            const isAdmin = role === 'admin';

            if (isAdmin && instructor?.department_id) {
                // ADMINS: Strictly limited to their home department + cross-taught
                if (crossTaughtDeptNames.length > 0) {
                    const inClause = crossTaughtDeptNames.map(d => `"${d}"`).join(',');
                    query = query.or(`id.eq."${instructor.department_id}",name.in.(${inClause})`);
                } else {
                    query = query.eq('id', instructor.department_id);
                }
            } else if (homeCollege) {
                // INSTRUCTORS: Maintain college-wide view + cross-taught
                if (crossTaughtDeptNames.length > 0) {
                    const inClause = crossTaughtDeptNames.map(d => `"${d}"`).join(',');
                    query = query.or(`college.eq."${homeCollege}",name.in.(${inClause})`);
                } else {
                    query = query.eq('college', homeCollege);
                }
            } else if (crossTaughtDeptNames.length > 0) {
                // Failsafe for teaching-only profiles
                query = query.in('name', crossTaughtDeptNames);
            } else {
                return [];
            }
        }
    }

    const { data, error } = await query.order('name');

    if (error) {
        console.error("[getActiveDepartments] Error:", error);
        return [];
    }

    return (data || []) as Department[];
}
