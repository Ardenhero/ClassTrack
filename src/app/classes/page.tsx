import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/utils/supabase/server";
import { AddClassDialog } from "./AddClassDialog";
import { DeleteClassButton } from "./DeleteClassButton";
import Link from "next/link";
import { BookOpen, Users } from "lucide-react";
import { YearGroup } from "@/components/YearGroup";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Suspense } from "react";

interface ClassItem {
    id: string;
    name: string;
    description: string;
    year_level?: string;
    enrollments: { count: number }[];
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

    if (!isActiveAdmin && profileId) {
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {items.map((c) => (
                                    <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="h-10 w-10 bg-nwu-red/10 rounded-lg flex items-center justify-center">
                                                <BookOpen className="h-5 w-5 text-nwu-red" />
                                            </div>
                                            {!isSuperAdmin && <DeleteClassButton id={c.id} />}
                                        </div>

                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{c.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 min-h-[40px]">{c.description || "No description provided."}</p>

                                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                                <Users className="h-4 w-4 mr-1" />
                                                {c.enrollments?.[0]?.count || 0} Students
                                            </div>
                                            <Link
                                                href={`/classes/${c.id}`}
                                                className="text-sm font-medium text-nwu-red hover:underline"
                                            >
                                                {isSuperAdmin ? "View" : "Manage"} &rarr;
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </YearGroup>
                    )
                ))}
            </div>

            {classes?.length === 0 && (
                <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No {query ? "matching " : ""}classes found</h3>
                    <p className="text-gray-500 max-w-xs mx-auto mt-2">
                        {query ? "Try adjusting your search terms." : "Get started by creating your first class using the button above."}
                    </p>
                </div>
            )}
        </DashboardLayout>
    );
}
