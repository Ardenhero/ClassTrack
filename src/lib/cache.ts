"use server";

import { createClient } from '@/utils/supabase/server';
import { PerformanceMonitor } from './metrics';
import { cookies } from 'next/headers';
import { getProfileRole } from './auth-utils';

// PURIFIED RETURN TYPE: Explicitly define what we expect from the database
interface StudentData {
    id: string;
    name: string | null;
    sin: string | null;
    year_level: string | null;
    created_at?: string;
    // NO fingerprint_id - completely removed
}

export const getCachedStudents = async (query?: string): Promise<StudentData[]> => {
    return PerformanceMonitor.track('getStudents', async () => {
        const supabase = createClient();
        const cookieStore = cookies();
        const profileId = cookieStore.get("sc_profile_id")?.value;

        if (profileId) {
            // STRICT ISOLATION: Check Active Profile Role
            const role = await getProfileRole();
            const isActiveAdmin = role === 'admin';

            if (!isActiveAdmin) {
                // INSTRUCTOR QUERY: Use RPC (enrollment-based visibility)
                const { data, error } = await supabase.rpc('get_my_students', {
                    p_instructor_id: profileId,
                    p_search_query: query || ''
                });

                if (error) {
                    console.error("RPC Error:", error);
                    throw error;
                }

                // RPC returns already-typed data - just ensure it's an array
                return (data || []) as StudentData[];
            }
        }

        // ADMIN QUERY: Explicit Column Selection
        // CRITICAL: Only select the columns we actually need - NO fingerprint_id
        let queryBuilder = supabase
            .from('students')
            .select('id, name, sin, year_level, created_at') // Explicit columns only
            .order('name');

        if (query) {
            queryBuilder = queryBuilder.ilike('name', `%${query}%`);
        }

        const { data, error } = await queryBuilder;

        if (error) {
            console.error("Query Error:", error);
            throw error;
        }

        return (data || []) as StudentData[];
    });
};
