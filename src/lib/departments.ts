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
        const { checkIsSuperAdmin, getProfile } = await import("@/lib/auth-utils");
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
                .eq('instructor_id', profileId);

            const crossTaughtDeptNames = Array.from(new Set(
                (assignedClasses || []).map(c => c.department).filter(Boolean)
            ));

            // Execute the scoped request
            if (homeCollege && crossTaughtDeptNames.length > 0) {
                // Return departments that either match Home College OR their names match cross-taught classes
                const inClause = crossTaughtDeptNames.map(d => `"${d}"`).join(',');
                query = query.or(`college.eq."${homeCollege}",name.in.(${inClause})`);
            } else if (homeCollege) {
                // Only matches home college
                query = query.eq('college', homeCollege);
            } else if (crossTaughtDeptNames.length > 0) {
                // Instructors without a home department somehow but teaching classes
                query = query.in('name', crossTaughtDeptNames);
            } else {
                // Failsafe: return nothing if they don't have a department & teach no classes
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
