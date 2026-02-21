import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/utils/supabase/server";
import { AddClassDialog } from "./AddClassDialog";
import { ClassGrid } from "./ClassGrid";
import { BookOpen } from "lucide-react";
import { YearGroup } from "@/components/YearGroup";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Suspense } from "react";

interface ClassItem {
    id: string;
    name: string;
    description: string;
    year_level?: string;
    enrollments: { count: number }[];
    count: number;
}

import { cookies } from "next/headers";
import { getProfileRole, checkIsSuperAdmin } from "@/lib/auth-utils";

export default async function ClassesPage({
    searchParams,
}: {
    searchParams?: {
        query?: string;
    };
}) {
    const query = searchParams?.query || "";
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    let queryBuilder = supabase
        .from("classes")
        .select("*, enrollments(count)")
        .order("created_at", { ascending: false });

    const role = await getProfileRole();
    const isSuperAdmin = await checkIsSuperAdmin();
    const isActiveAdmin = role === 'admin';

    // STRICT DATA SCOPING for System Admin
    if (isActiveAdmin && profileId) {
        // 1. Get auth_user_id of current admin
        const { data: adminRecord } = await supabase
            .from('instructors')
            .select('auth_user_id')
            .eq('id', profileId)
            .single();

        if (adminRecord?.auth_user_id) {
            // 2. Get all instructors in this account
            const { data: accountInstructors } = await supabase
                .from('instructors')
                .select('id')
                .eq('auth_user_id', adminRecord.auth_user_id);

            const accountInstructorIds = accountInstructors?.map(i => i.id) || [];

            // 3. Filter classes to only those owned by account instructors
            if (accountInstructorIds.length > 0) {
                queryBuilder = queryBuilder.in("instructor_id", accountInstructorIds);
            } else {
                // Fallback: If no instructors found (weird), show nothing or just own?
                // Let's show nothing to be safe or just own
                queryBuilder = queryBuilder.eq("instructor_id", profileId);
            }
        }
    } else if (!isSuperAdmin && profileId) {
        // Regular Instructor -> Own classes only
        queryBuilder = queryBuilder.eq("instructor_id", profileId);
    }

    if (query) {
        queryBuilder = queryBuilder.ilike("name", `%${query}%`);
    }

    const { data } = await queryBuilder;

    const classes = data as unknown as ClassItem[];

    const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
    const groupedClasses = YEAR_LEVELS.reduce((acc, level) => {
        acc[level] = classes?.filter(c => c.year_level === level) || [];
        return acc;
    }, {} as Record<string, ClassItem[]>);

    // Catch-all for undefined or other year levels
    const otherClasses = classes?.filter(c => !YEAR_LEVELS.includes(c.year_level || "")) || [];
    if (otherClasses.length > 0) groupedClasses["Other"] = otherClasses;

    return (
        <DashboardLayout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Manage Classes</h1>
                    <p className="text-gray-500 dark:text-gray-400">View and organize your course offerings</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex-1 w-full md:w-64">
                        <Suspense fallback={<div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />}>
                            <GlobalSearch type="classes" placeholder="Search classes..." />
                        </Suspense>
                    </div>
                    <div className="flex-shrink-0">
                        {!isSuperAdmin && <AddClassDialog />}
                        {isSuperAdmin && (
                            <div className="px-4 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100 uppercase tracking-wider">
                                Read-Only Mode
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {Object.entries(groupedClasses).map(([level, items]) => (
                    items.length > 0 && (
                        <YearGroup key={level} title={level} count={items.length} itemLabel="classes">
                            <ClassGrid classes={items} isSuperAdmin={isSuperAdmin} />
                        </YearGroup>
                    )
                ))}
            </div>

            {classes?.length === 0 && (
                <div className="col-span-full text-center py-12 glass-panel rounded-2xl border-dashed">
                    <BookOpen className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">No {query ? "matching " : ""}classes found</h3>
                    <p className="text-gray-500 max-w-xs mx-auto mt-2">
                        {query ? "Try adjusting your search terms." : "Get started by creating your first class using the button above."}
                    </p>
                </div>
            )}
        </DashboardLayout>
    );
}
