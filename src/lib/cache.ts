"use server";

import { createClient } from '@/utils/supabase/server';
import { PerformanceMonitor } from './metrics';
import { cookies } from 'next/headers';
import { getProfileRole, checkIsSuperAdmin, getProfile } from './auth-utils';

// PURIFIED RETURN TYPE: Explicitly define what we expect from the database
interface StudentData {
    id: string;
    name: string | null;
    sin: string | null;
    year_level: string | null;
    department: string | null;
    created_at?: string;
    instructor_id?: string;
    is_archived?: boolean | null;
    archived_by?: string | null;
    instructors?: {
        id: string;
        name: string;
        image_url: string | null;
    };
    fingerprint_slot_id?: number | null;
    image_url?: string | null;
    enrollments?: Array<{
        classes: {
            department: string | null;
            instructors: {
                id: string;
                name: string;
                image_url: string | null;
            }
        }
    }>;
}

export const getCachedStudents = async (query?: string, deptFilter?: string, yearFilter?: string): Promise<StudentData[]> => {
    return PerformanceMonitor.track('getStudents', async () => {
        const supabase = createClient();
        const cookieStore = cookies();
        const profileId = cookieStore.get("sc_profile_id")?.value;

        if (!profileId) {
            console.warn("[getCachedStudents] No profile ID found");
            return [];
        }

        // ⚡ PARALLEL: Check role + super admin status simultaneously
        const [role, isSuperAdmin, profile] = await Promise.all([
            getProfileRole(),
            checkIsSuperAdmin(),
            getProfile()
        ]);
        const isActiveAdmin = role === 'admin' || isSuperAdmin;
        const actualProfileId = profile?.id || profileId;

        // CRITICAL: Only select the columns we need
        const columns = `
            id, name, sin, year_level, department, created_at, instructor_id,
            is_archived, archived_by, fingerprint_slot_id, image_url,
            instructors:instructors!students_instructor_id_fkey(id, name, image_url)
            ${(isActiveAdmin) ? ', enrollments(classes(department, instructors:instructors!classes_instructor_id_fkey(id, name, image_url)))' : ''}
        `;

        if (isActiveAdmin) {
            if (isSuperAdmin) {
                // SUPER ADMIN: See ALL students
                let queryBuilder = supabase
                    .from('students')
                    .select(columns)
                    .order('name');
                if (query) queryBuilder = queryBuilder.or(`name.ilike."%${query}%",sin.ilike."%${query}%"`);
                if (deptFilter) queryBuilder = queryBuilder.eq('department', deptFilter);
                if (yearFilter) queryBuilder = queryBuilder.eq('year_level', yearFilter);
                const { data, error } = await queryBuilder;
                if (error) throw error;
                
                // Filter out students archived by this exact user
                const result = (data || []) as unknown as StudentData[];
                return result.filter((s: StudentData) => !(s.is_archived && s.archived_by === actualProfileId));
            } else {
                // SYSTEM ADMIN: See students from THEIR department + linked students
                const { data: adminProfile } = await supabase
                    .from('instructors')
                    .select('auth_user_id, department_id, departments(name)')
                    .eq('id', actualProfileId)
                    .single();

                // @ts-expect-error - Join type
                const adminDeptName = adminProfile?.departments?.name as string | undefined;

                let accountInstructorIds: string[] = [];
                if (adminProfile?.auth_user_id) {
                    const { data: accountInstructors } = await supabase
                        .from('instructors')
                        .select('id')
                        .or(`auth_user_id.eq."${adminProfile.auth_user_id}",owner_id.eq."${adminProfile.auth_user_id}"`);
                    accountInstructorIds = (accountInstructors as { id: string }[] | null)?.map(i => i.id) || [];
                }

                // FETCH LINKED IDs: (Students created by instructors under this account OR enrolled in their classes)
                let uniqueIds: string[] = [];
                if (accountInstructorIds.length > 0) {
                    const [{ data: createdIds }, { data: enrolledIds }] = await Promise.all([
                        supabase.from('students').select('id').in('instructor_id', accountInstructorIds),
                        supabase.from('enrollments').select('student_id, classes!inner(instructor_id)').in('classes.instructor_id', accountInstructorIds),
                    ]);

                    uniqueIds = Array.from(new Set([
                        ...(createdIds as { id: string }[] | null)?.map(s => s.id) || [],
                        ...(enrolledIds as { student_id: string }[] | null)?.map(e => e.student_id) || []
                    ]));
                }

                let queryBuilder = supabase
                    .from('students')
                    .select(columns)
                    .order('name');

                // BASE SCOPING: (My Dept) OR (Explicitly Linked IDs)
                if (adminDeptName && uniqueIds.length > 0) {
                    queryBuilder = queryBuilder.or(`department.eq."${adminDeptName}",id.in.(${uniqueIds.join(',')})`);
                } else if (adminDeptName) {
                    queryBuilder = queryBuilder.eq('department', adminDeptName);
                } else if (uniqueIds.length > 0) {
                    queryBuilder = queryBuilder.in('id', uniqueIds);
                } else {
                    return []; // No access
                }

                // Add search/filters
                if (query) queryBuilder = queryBuilder.or(`name.ilike."%${query}%",sin.ilike."%${query}%"`);
                if (deptFilter) queryBuilder = queryBuilder.eq('department', deptFilter);
                if (yearFilter) queryBuilder = queryBuilder.eq('year_level', yearFilter);

                const { data, error } = await queryBuilder;
                if (error) throw error;
                
                // Filter out students archived by this exact user
                const result = (data || []) as unknown as StudentData[];
                return result.filter((s: StudentData) => !(s.is_archived && s.archived_by === actualProfileId));
            }
        } else {
            // INSTRUCTOR: Use complex query with enrollment-based visibility
            // This replaces the RPC with a direct query approach

            try {
                // Query for students the instructor created
                let createdQuery = supabase
                    .from('students')
                    .select(columns)
                    .eq('instructor_id', actualProfileId);

                if (query) {
                    createdQuery = createdQuery.or(`name.ilike."%${query}%",sin.ilike."%${query}%"`);
                }
                if (deptFilter) createdQuery = createdQuery.eq('department', deptFilter);
                if (yearFilter) createdQuery = createdQuery.eq('year_level', yearFilter);

                const { data: createdStudents, error: createdError } = await createdQuery;

                if (createdError) {
                    console.error("[getCachedStudents] Created students query error:", createdError);
                    throw createdError;
                }

                // Query for students enrolled in instructor's classes
                let enrolledQuery = supabase
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
                    .eq('enrollments.classes.instructor_id', actualProfileId);

                if (query) {
                    enrolledQuery = enrolledQuery.or(`name.ilike."%${query}%",sin.ilike."%${query}%"`);
                }
                if (deptFilter) enrolledQuery = enrolledQuery.eq('department', deptFilter);
                if (yearFilter) enrolledQuery = enrolledQuery.eq('year_level', yearFilter);

                const { data: enrolledStudents, error: enrolledError } = await enrolledQuery;

                if (enrolledError) {
                    console.error("[getCachedStudents] Enrolled students query error:", enrolledError);
                    // Don't throw - we can still return created students
                }

                // Combine and deduplicate
                const allStudents = new Map<string, StudentData>();

                // Add created students
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (createdStudents as any[] || []).forEach(student => {
                    // Filter: Only hide if archived BY THIS instructor
                    if (student.is_archived && student.archived_by === actualProfileId) return;

                    allStudents.set(student.id, {
                        ...student,
                    } as StudentData);
                });

                // Add enrolled students
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (enrolledStudents as any[] || []).forEach((item: any) => {
                    if (!allStudents.has(item.id)) {
                        // Filter: Only hide if archived BY THIS instructor
                        if (item.is_archived && item.archived_by === actualProfileId) return;

                        allStudents.set(item.id, {
                            ...item,
                        } as StudentData);
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
                        (s.name || '').toLowerCase().includes(lowerQuery) ||
                        (s.sin || '').toLowerCase().includes(lowerQuery)
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
