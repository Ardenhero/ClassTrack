import DashboardLayout from "@/components/DashboardLayout";
export const dynamic = "force-dynamic";
import { createClient } from "@/utils/supabase/server";
import { AddClassDialog } from "./AddClassDialog";
import { ClassesDirectory } from "./ClassesDirectory";
import { Breadcrumb } from "@/components/Breadcrumb";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Suspense } from "react";
import { History as HistoryIcon } from "lucide-react";

interface ClassItem {
    id: string;
    name: string;
    description: string;
    year_level?: string;
    department?: string;
    schedule_days?: string;
    start_time?: string;
    end_time?: string;
    instructor_id: string;
    instructors?: { id: string; name: string; image_url: string | null };
    enrollments: { count: number }[];
}

import { cookies } from "next/headers";
import { getProfileRole, checkIsSuperAdmin } from "@/lib/auth-utils";
import { getActiveDepartments } from "@/lib/departments";
import { TermSelector } from "./TermSelector";

export default async function ClassesPage({
    searchParams,
}: {
    searchParams?: {
        query?: string;
        instructor?: string;
        termId?: string;
    };
}) {
    const query = searchParams?.query || "";
    const instructorFilter = searchParams?.instructor || null;
    const termIdFilter = searchParams?.termId || null;

    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    const role = await getProfileRole();
    const isSuperAdmin = await checkIsSuperAdmin();
    const isActiveAdmin = role === 'admin';

    // 1. Fetch all terms for the selector
    const { data: allTerms } = await supabase
        .from('academic_terms')
        .select('id, name, is_active, academic_years(name)')
        .order('start_date', { ascending: false });

    // 2. Determine target term
    const activeTerm = allTerms?.find(t => t.is_active);
    const selectedTermId = termIdFilter || activeTerm?.id;
    const selectedTerm = allTerms?.find(t => t.id === selectedTermId);
    const isReadOnly = selectedTerm ? !selectedTerm.is_active : false;

    const activeDepartments = await getActiveDepartments(profileId);

    let queryBuilder = supabase
        .from("classes")
        .select(isActiveAdmin || isSuperAdmin
            ? "*, enrollments(count), instructors!classes_instructor_id_fkey(id, name, image_url, departments(name, code))"
            : "*, enrollments(count)"
        )
        .not('is_archived', 'eq', true);

    // 3. Filter by Selected Term
    if (selectedTermId) {
        queryBuilder = queryBuilder.eq('term_id', selectedTermId);
    }

    queryBuilder = queryBuilder.order("created_at", { ascending: false });

    // STRICT DATA SCOPING for System Admin (NOT Super Admin)
    if (isActiveAdmin && !isSuperAdmin && profileId) {
        const { data: adminRecord } = await supabase
            .from('instructors')
            .select('department_id')
            .eq('id', profileId)
            .single();

        if (adminRecord?.department_id) {
            const { data: deptInstructors } = await supabase
                .from('instructors')
                .select('id')
                .eq('department_id', adminRecord.department_id);

            const deptInstructorIds = deptInstructors?.map(i => i.id) || [];

            if (deptInstructorIds.length > 0) {
                // If a specific instructor is requested, ensure they are in this department
                if (instructorFilter && deptInstructorIds.includes(instructorFilter)) {
                    queryBuilder = queryBuilder.eq("instructor_id", instructorFilter);
                } else {
                    queryBuilder = queryBuilder.in("instructor_id", deptInstructorIds);
                }
            } else {
                queryBuilder = queryBuilder.eq("instructor_id", profileId);
            }
        }
    } else if (isSuperAdmin && instructorFilter) {
        // Super admins can view any specific instructor
        queryBuilder = queryBuilder.eq("instructor_id", instructorFilter);
    } else if (!isSuperAdmin && profileId) {
        queryBuilder = queryBuilder.eq("instructor_id", profileId);
    }

    // Only apply text search at DB level — dept/year filtering is now instant on the client
    if (query) {
        queryBuilder = queryBuilder.ilike("name", `%${query}%`);
    }

    const { data } = await queryBuilder;
    const classes = (data as unknown as ClassItem[]) || [];

    const breadcrumbItems: { label: string; href?: string }[] = [
        { label: "Classes", href: "/classes" },
    ];

    return (
        <DashboardLayout>
            <Breadcrumb items={breadcrumbItems} />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-3">
                        Manage Classes
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">View and organize your course offerings</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    {/* Term Selector for Backtracking */}
                    <Suspense fallback={<div className="h-10 w-48 bg-gray-100 rounded-xl animate-pulse" />}>
                        <TermSelector
                            terms={(allTerms || []).map(t => ({
                                ...t,
                                academic_years: Array.isArray(t.academic_years) ? t.academic_years[0] : t.academic_years as { name: string } | null
                            }))}
                            selectedTermId={selectedTermId || ""}
                        />
                    </Suspense>

                    <div className="h-8 w-px bg-gray-200 dark:bg-gray-800 hidden sm:block mx-1" />

                    <div className="flex-1 w-full md:w-64">
                        <Suspense fallback={<div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />}>
                            <GlobalSearch type="classes" placeholder="Search classes..." />
                        </Suspense>
                    </div>

                    <div className="flex-shrink-0">
                        {(!isSuperAdmin && !isReadOnly) ? (
                            <AddClassDialog />
                        ) : (
                            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-black rounded-xl border border-amber-200 dark:border-amber-800/30 uppercase tracking-[0.1em] flex items-center gap-2">
                                <HistoryIcon className="h-3.5 w-3.5" />
                                Read-Only Records
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ClassesDirectory
                classes={classes}
                departments={activeDepartments}
                isSuperAdmin={isSuperAdmin}
                isActiveAdmin={isActiveAdmin}
                isReadOnly={isReadOnly}
                initialInstructorId={instructorFilter || undefined}
                profileId={profileId}
            />
        </DashboardLayout>
    );
}
