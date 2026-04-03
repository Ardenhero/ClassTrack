import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import DeletionRequestsContent from "@/components/super-admin/DeletionRequestsContent";
import { checkIsSuperAdmin } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export default async function DeletionRequestsPage() {
    const isSuperAdmin = await checkIsSuperAdmin();
    if (!isSuperAdmin) {
        redirect("/dashboard");
    }

    const supabase = createClient();
    
    // Fetch pending deletion requests with instructor names
    const { data: requests } = await supabase
        .from('deletion_requests')
        .select(`
            *,
            instructors!deletion_requests_requested_by_fkey (
                name,
                departments (
                    name,
                    code
                )
            )
        `)
        .order('created_at', { ascending: false });

    return (
        <DashboardLayout>
            <div className="p-6 max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                        Deletion Requests
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Review and manage pending deletion requests from department admins.
                    </p>
                </div>
                
                <DeletionRequestsContent initialRequests={requests || []} />
            </div>
        </DashboardLayout>
    );
}
