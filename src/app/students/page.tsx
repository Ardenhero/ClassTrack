import DashboardLayout from "@/components/DashboardLayout";
import { AddStudentDialog } from "./AddStudentDialog";
import { ClaimStudentDialog } from "./ClaimStudentDialog";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Suspense } from "react";
import StudentsListContent from "@/components/students/StudentsListContent";
import { Loader2 } from "lucide-react";

import { getProfileRole, checkIsSuperAdmin } from "@/lib/auth-utils";

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
    searchParams?: { query?: string; instructor?: string };
}) {
    const query = searchParams?.query || "";
    const instructorFilter = searchParams?.instructor || undefined;

    const role = await getProfileRole();
    const isSuperAdmin = await checkIsSuperAdmin();
    const isActiveAdmin = role === 'admin';
    
    const breadcrumbItems = [{ label: "Students", href: "/students" }];

    return (
        <DashboardLayout>
            <Breadcrumb items={breadcrumbItems} />
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Students Directory</h1>
                    <p className="text-gray-500 text-sm">Manage enrolled students</p>
                </div>
                
                <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:justify-end">
                    <div className="w-full sm:w-[220px]">
                        <GlobalSearch 
                            placeholder="Search students..." 
                            type="students"
                        />
                    </div>
                    <div className="flex gap-2 shrink-0">
                        {!isSuperAdmin && !isActiveAdmin && (
                            <>
                                <AddStudentDialog />
                                <ClaimStudentDialog />
                            </>
                        )}
                        {(isSuperAdmin || isActiveAdmin) && (
                            <div className="px-4 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100 uppercase tracking-wider">
                                Read-Only Mode
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Suspense fallback={<StudentsSkeleton />}>
                <StudentsListContent 
                    query={query}
                    instructorId={instructorFilter}
                />
            </Suspense>
        </DashboardLayout>
    );
}
