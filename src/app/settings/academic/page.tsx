import DashboardLayout from "@/components/DashboardLayout";
import { checkIsAdmin, checkIsSuperAdmin } from "@/lib/auth-utils";
import { createClient } from "@/utils/supabase/server";
import { AcademicManagement } from "../AcademicManagement";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Calendar } from "lucide-react";

export default async function AcademicManagementPage() {
    const isSuperAdmin = await checkIsSuperAdmin();
    const isAdmin = await checkIsAdmin();

    if (!isAdmin && !isSuperAdmin) {
        return (
            <DashboardLayout>
                <div className="p-8 text-center bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/30">
                    <p className="text-red-700 dark:text-red-400 font-bold">Unauthorized Access</p>
                    <p className="text-sm text-red-600 dark:text-red-400/80">Only administrators can manage academic terms.</p>
                </div>
            </DashboardLayout>
        );
    }

    const supabase = createClient();
    const { data: years } = await supabase.from("academic_years").select("*").order("name", { ascending: false });
    const { data: terms } = await supabase.from("academic_terms").select("*, academic_years(name)").order("start_date", { ascending: false });
    const { count: legacyCount } = await supabase.from("classes").select("*", { count: 'exact', head: true }).is("term_id", null);

    const breadcrumbItems = [
        { label: "Settings", href: "/settings" },
        { label: "Academic Management" },
    ];

    return (
        <DashboardLayout>
            <Breadcrumb items={breadcrumbItems} />

            <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                    <Calendar className="h-8 w-8 text-blue-500" />
                    Academic Management
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                    Configure academic years, semesters, and manage historical enrollment records.
                </p>
            </div>

            <AcademicManagement
                years={years || []}
                terms={terms || []}
                legacyCount={legacyCount || 0}
                isSuperAdmin={isSuperAdmin}
            />
        </DashboardLayout>
    );
}

export const dynamic = 'force-dynamic';
