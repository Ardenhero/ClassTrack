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

        let queryBuilder = supabase
            .from('students')
            .select('*')
            .order('name');

        if (profileId) {
            // STRICT ISOLATION: Check Active Profile Role
            const role = await getProfileRole();
            const isActiveAdmin = role === 'admin';

            if (!isActiveAdmin) {
                queryBuilder = queryBuilder.eq('instructor_id', profileId);
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
