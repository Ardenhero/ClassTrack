import { createClient } from "@/utils/supabase/server";
import { Plus, Users, Loader2 } from "lucide-react";
import { revalidatePath } from "next/cache";
import { checkIsSuperAdmin } from "@/lib/auth-utils";
import { Suspense } from "react";
import InstructorListContent from "./InstructorListContent";

import { cookies } from "next/headers";

function InstructorsSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-nwu-red" />
            <p className="text-gray-500 text-sm animate-pulse">Loading instructors...</p>
        </div>
    );
}

export default async function InstructorsPage() {
    const isSuperAdmin = await checkIsSuperAdmin();
    const supabase = createClient();

    // Get the current auth user and active profile
    const { data: { user } } = await supabase.auth.getUser();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    // Fetch current user's instructor profile to get their Department Name (for display)
    // and Department ID (for assignment). We prefer to match the active profileId.
    let currentUserProfile = null;

    if (profileId && profileId !== 'admin-profile') {
        const { data } = await supabase
            .from('instructors')
            .select('department_id, departments(name, code)')
            .eq('id', profileId)
            .maybeSingle();
        currentUserProfile = data;
    }

    if (!currentUserProfile && user) {
        // Fallback: Just grab any admin profile for this auth user
        const { data } = await supabase
            .from('instructors')
            .select('department_id, departments(name, code)')
            .eq('auth_user_id', user.id)
            .not('department_id', 'is', null)
            .limit(1)
            .maybeSingle();
        currentUserProfile = data;
    }

    // @ts-expect-error: Supabase inference
    const currentUserDeptName = currentUserProfile?.departments?.name;
    const currentUserDeptId = currentUserProfile?.department_id;

    // Fetch departments for the Add Instructor dropdown
    // Note: We only need this if isSuperAdmin is true, fetching it here doesn't block much.
    let departments = null;
    if (isSuperAdmin) {
        const { data } = await supabase
            .from("departments")
            .select("id, name, code")
            .order("name");
        departments = data;
    }

    async function addInstructor(formData: FormData) {
        "use server";
        const name = formData.get("name") as string;
        const pin_code = formData.get("pin_code") as string;
        const department_id = formData.get("department_id") as string;
        const role = formData.get("role") as string;
        const supabase = createClient();

        // Get current user to set as owner
        const { data: { user } } = await supabase.auth.getUser();

        // Handle empty strings
        const pin = pin_code && pin_code.trim() !== "" ? pin_code : null;
        const dept = department_id && department_id !== "" ? department_id : null;
        const userRole = role === "admin" ? "admin" : "instructor";

        // If Super Admin, use selected dept.
        // If Dept Admin, force use of their own dept.
        let finalDept = dept;
        if (!isSuperAdmin && dept) {
            // Already safely populated by the hidden input on the client
            finalDept = dept;
        } else if (!isSuperAdmin && !dept) {
            // Fallback: fetch department from the creator's profile robustly
            const cookieStore = cookies();
            const pId = cookieStore.get("sc_profile_id")?.value;
            let creatorDept = null;

            if (pId && pId !== 'admin-profile') {
                const { data: creator } = await supabase
                    .from('instructors')
                    .select('department_id')
                    .eq('id', pId)
                    .maybeSingle();
                creatorDept = creator?.department_id;
            }

            if (!creatorDept && user) {
                const { data: creator } = await supabase
                    .from('instructors')
                    .select('department_id')
                    .eq('auth_user_id', user.id)
                    .not('department_id', 'is', null)
                    .limit(1)
                    .maybeSingle();
                creatorDept = creator?.department_id;
            }
            finalDept = creatorDept || null;
        }

        const { error } = await supabase.from("instructors").insert({
            name,
            pin_code: pin,
            department_id: finalDept,
            role: userRole,
            owner_id: user?.id
        });

        if (error) {
            console.error("Error adding instructor:", error);
        } else {
            // Log System Notification
            await supabase.from("notifications").insert({
                user_id: user?.id ?? "",
                title: "System: Account Created",
                message: `Instructor account for ${name} was created.`,
                type: "success",
                read: false
            });
        }
        revalidatePath("/dashboard/admin/instructors");
    }

    return (
        <div className="space-y-8">
            {/* Add Instructor Form */}
            <div className="bg-white rounded-2xl shadow-md border p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Plus className="h-5 w-5 text-nwu-red" />
                    Add Instructor
                </h2>
                <form action={addInstructor} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                            name="name"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nwu-red focus:border-transparent transition-all text-sm"
                            placeholder="Instructor name"
                        />
                    </div>
                    {isSuperAdmin && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                            <select name="department_id" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nwu-red focus:border-transparent transition-all text-sm">
                                <option value="">No Department</option>
                                {departments?.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {!isSuperAdmin && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                            <input
                                type="text"
                                disabled
                                value={currentUserDeptName || "Your Department"}
                                className="w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg text-sm cursor-not-allowed"
                            />
                            {/* Hidden input to actually submit the ID */}
                            <input type="hidden" name="department_id" value={currentUserDeptId || ""} />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">PIN Code (optional)</label>
                        <input
                            name="pin_code"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nwu-red focus:border-transparent transition-all text-sm"
                            placeholder="Optional PIN"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select name="role" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nwu-red focus:border-transparent transition-all text-sm">
                            <option value="instructor">Instructor</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            className="w-full md:w-auto px-6 py-2 bg-nwu-red text-white text-sm font-bold rounded-lg hover:bg-[#5e0d0e] transition-colors shadow-md"
                        >
                            Add Instructor
                        </button>
                    </div>
                </form>
            </div>

            {/* Instructors List */}
            <div className="bg-white rounded-2xl shadow-md border p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-nwu-red" />
                    Instructors Directory
                </h2>
                <Suspense fallback={<InstructorsSkeleton />}>
                    <InstructorListContent isSuperAdmin={isSuperAdmin} userId={user?.id} />
                </Suspense>
            </div>
        </div>
    );
}
