import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PoolContent from "./PoolContent";
import { getDepartmentStudentPool } from "./actions";
import DashboardLayout from "@/components/DashboardLayout";
import { checkIsSuperAdmin } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export default async function DepartmentStudentPoolPage() {
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) redirect("/");

    // Verify the user is an admin
    const { data: profile } = await supabase
        .from("instructors")
        .select("role")
        .eq("id", profileId)
        .single();

    if (!profile || profile.role !== "admin") {
        redirect("/");
    }

    const { students, departmentName } = await getDepartmentStudentPool();
    const isSuperAdmin = await checkIsSuperAdmin();

    return (
        <DashboardLayout>
            <PoolContent 
                students={students} 
                departmentName={departmentName} 
                isSuperAdmin={isSuperAdmin}
            />
        </DashboardLayout>
    );
}
