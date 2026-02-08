"use server";

import { createClient } from '@/utils/supabase/server';
import { PerformanceMonitor } from './metrics';

import { cookies } from 'next/headers';
import { getProfileRole } from './auth-utils';

export const getCachedStudents = async (query?: string) => {
    return PerformanceMonitor.track('getStudents', async () => {
        const supabase = createClient();
        const cookieStore = cookies();
        const profileId = cookieStore.get("sc_profile_id")?.value;

        // Admin Query: Explicit Select
        let queryBuilder = supabase
            .from('students')
            .select('id, name, sin, year_level, created_at') // Explicit columns only
            .order('name');

        if (profileId) {
            // STRICT ISOLATION: Check Active Profile Role
            const role = await getProfileRole();
            const isActiveAdmin = role === 'admin';

            if (!isActiveAdmin) {
                // Instructor Query: RPC
                const { data, error } = await supabase.rpc('get_my_students', {
                    p_instructor_id: profileId,
                    p_search_query: query || ''
                });
                if (error) throw error;
                return data;
            }
        }

        if (query) {
            queryBuilder = queryBuilder.ilike('name', `%${query}%`);
        }

        const { data, error } = await queryBuilder;
        if (error) throw error;
        return data;
    });
};
