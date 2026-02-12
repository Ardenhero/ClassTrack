"use server";

import { createClient } from '@/utils/supabase/server';
import { PerformanceMonitor } from './metrics';
import { cookies } from 'next/headers';
import { getProfileRole, checkIsSuperAdmin } from './auth-utils';

// PURIFIED RETURN TYPE: Explicitly define what we expect from the database
interface StudentData {
    id: string;
    name: string | null;
    sin: string | null;
    year_level: string | null;
    created_at?: string;
}

export const getCachedStudents = async (query?: string): Promise<StudentData[]> => {
    return PerformanceMonitor.track('getStudents', async () => {
        const supabase = createClient();
        const cookieStore = cookies();
        const profileId = cookieStore.get("sc_profile_id")?.value;

        if (!profileId) {
            console.warn("[getCachedStudents] No profile ID found");
            return [];
        }

        // Check role
        const role = await getProfileRole();
        const isSuperAdmin = await checkIsSuperAdmin();
        const isActiveAdmin = role === 'admin' || isSuperAdmin;

        // CRITICAL: Only select the columns we need - NO fingerprint_id
        const columns = 'id, name, sin, year_level, created_at';

        if (isActiveAdmin) {
            if (isSuperAdmin) {
                // SUPER ADMIN: See ALL students
                // No filter needed, just select all
                let queryBuilder = supabase
                    .from('students')
                    .select(columns)
                    .order('name');
                if (query) queryBuilder = queryBuilder.ilike('name', `%${query}%`);
                const { data, error } = await queryBuilder;
                if (error) throw error;
                return (data || []) as StudentData[];
            } else {
                // SYSTEM ADMIN: See students from THEIR account only
                const { data: adminRecord } = await supabase
                    .from('instructors')
                    .select('auth_user_id')
                    .eq('id', profileId)
                    .single();

                let accountInstructorIds: string[] = [];
                if (adminRecord?.auth_user_id) {
                    const { data: accountInstructors } = await supabase
                        .from('instructors')
                        .select('id')
                        .eq('auth_user_id', adminRecord.auth_user_id);
                    accountInstructorIds = accountInstructors?.map(i => i.id) || [];
                }

                if (accountInstructorIds.length === 0) return []; // Should not happen if admin exists

                // Fetch students created by OR enrolled in classes of these instructors
                // 1. Created by account instructors
                const { data: createdIds } = await supabase.from('students').select('id').in('instructor_id', accountInstructorIds);
                // 2. Enrolled in account instructors' classes
                const { data: enrolledIds } = await supabase.from('enrollments').select('student_id, classes!inner(instructor_id)').in('classes.instructor_id', accountInstructorIds);

                const uniqueIds = Array.from(new Set([
                    ...(createdIds?.map(s => s.id) || []),
                    ...(enrolledIds?.map(e => e.student_id) || [])
                ]));

                if (uniqueIds.length === 0) return [];

                let queryBuilder = supabase
                    .from('students')
                    .select(columns)
                    .in('id', uniqueIds)
                    .order('name');

                if (query) queryBuilder = queryBuilder.ilike('name', `%${query}%`);

                const { data, error } = await queryBuilder;
                if (error) throw error;
                return (data || []) as StudentData[];
            }
        } else {
            // INSTRUCTOR: Use complex query with enrollment-based visibility
            // This replaces the RPC with a direct query approach

            try {
                // Query for students the instructor created
                const createdQuery = supabase
                    .from('students')
                    .select(columns)
                    .eq('instructor_id', profileId);

                if (query) {
                    createdQuery.ilike('name', `%${query}%`);
                }

                const { data: createdStudents, error: createdError } = await createdQuery;

                if (createdError) {
                    console.error("[getCachedStudents] Created students query error:", createdError);
                    throw createdError;
                }

                // Query for students enrolled in instructor's classes
                const { data: enrolledStudents, error: enrolledError } = await supabase
                    .from('students')
                    .select(`
                        ${columns},
                        enrollments!inner (
                            class_id,
                            classes!inner (
                                instructor_id
                            )
                        )
                    `)
                    .eq('enrollments.classes.instructor_id', profileId);

                if (enrolledError) {
                    console.error("[getCachedStudents] Enrolled students query error:", enrolledError);
                    // Don't throw - we can still return created students
                }

                // Combine and deduplicate
                const allStudents = new Map<string, StudentData>();

                // Add created students
                (createdStudents || []).forEach(student => {
                    allStudents.set(student.id, {
                        id: student.id,
                        name: student.name,
                        sin: student.sin,
                        year_level: student.year_level,
                        created_at: student.created_at
                    });
                });

                // Add enrolled students
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (enrolledStudents || []).forEach((item: any) => {
                    if (!allStudents.has(item.id)) {
                        allStudents.set(item.id, {
                            id: item.id,
                            name: item.name,
                            sin: item.sin,
                            year_level: item.year_level,
                            created_at: item.created_at
                        });
                    }
                });

                // Convert to array and sort
                const result = Array.from(allStudents.values()).sort((a, b) =>
                    (a.name || '').localeCompare(b.name || '')
                );

                // Apply search filter if needed
                if (query) {
                    const lowerQuery = query.toLowerCase();
                    return result.filter(s =>
                        (s.name || '').toLowerCase().includes(lowerQuery)
                    );
                }

                return result;
            } catch (err) {
                console.error("[getCachedStudents] Instructor query exception:", err);
                throw err;
            }
        }
    });
};
