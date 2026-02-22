import DashboardLayout from "@/components/DashboardLayout";
import { AddStudentDialog } from "./AddStudentDialog";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Suspense } from "react";
import { checkIsSuperAdmin } from "@/lib/auth-utils";
import StudentsListContent from "@/components/students/StudentsListContent";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

function StudentsSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-nwu-red" />
            <p className="text-gray-500 text-sm animate-pulse">Loading students directory...</p>
        </div>
    );
}

export default async function StudentsPage({
    searchParams,
}: {
    searchParams?: { query?: string };
}) {
    const query = searchParams?.query || "";
    const isSuperAdmin = await checkIsSuperAdmin();

    return (
        <DashboardLayout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        Students Directory
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">Manage enrolled students</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex-1 w-full md:w-64">
                        <Suspense fallback={<div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />}>
                            <GlobalSearch type="students" placeholder="Search students..." />
                        </Suspense>
                    </div>
                    <div className="flex-shrink-0">
                        {!isSuperAdmin && <AddStudentDialog />}
                        {isSuperAdmin && (
                            <div className="px-4 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100 uppercase tracking-wider">
                                Read-Only Mode
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Suspense fallback={<StudentsSkeleton />}>
                <StudentsListContent query={query} isSuperAdmin={isSuperAdmin} />
            </Suspense>

        </DashboardLayout>
    );
}
