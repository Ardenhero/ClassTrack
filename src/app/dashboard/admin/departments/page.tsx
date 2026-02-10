import { createClient } from "@/utils/supabase/server";
import { Trash2, Plus, Building2 } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkIsSuperAdmin } from "@/lib/auth-utils";

export default async function DepartmentsPage() {
    const isSuperAdmin = await checkIsSuperAdmin();
    // Super Admin sees ALL departments, Regular Admin sees owned/linked
    const supabase = createClient();
    const { data: departments } = await supabase
        .from("departments")
        .select("*")
        .order("name");

    async function addDepartment(formData: FormData) {
        "use server";
        const name = formData.get("name") as string;
        const code = formData.get("code") as string;
        const supabase = createClient();

        // Get current user to set as owner
        const { data: { user } } = await supabase.auth.getUser();

        await supabase.from("departments").insert({ name, code, owner_id: user?.id });
        revalidatePath("/dashboard/admin/departments");
    }
    async function toggleDepartmentStatus(id: string, currentStatus: boolean) {
        "use server";
        const supabase = createClient();
        await supabase.from("departments").update({ is_active: !currentStatus }).eq("id", id);

        // Log action
        const { data: dept } = await supabase.from("departments").select("name").eq("id", id).single();
        await supabase.rpc('log_action', {
            p_action: currentStatus ? 'FREEZE_DEPARTMENT' : 'ACTIVATE_DEPARTMENT',
            p_target_type: 'departments',
            p_target_id: id,
            p_details: { name: dept?.name }
        });

        revalidatePath("/dashboard/admin/departments");
    }

    async function deleteDepartment(id: string) {
        "use server";
        const supabase = createClient();
        await supabase.from("departments").delete().eq("id", id);
        revalidatePath("/dashboard/admin/departments");
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                    <Building2 className="mr-2 h-6 w-6 text-nwu-red" />
                    Departments
                </h2>
            </div>

            {/* Add Department Form */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-4">Add New Department</h3>
                <form action={addDepartment} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-gray-500">Department Name</label>
                        <input
                            name="name"
                            placeholder="e.g. Computer Engineering"
                            required
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-900 focus:outline-none focus:border-nwu-red transition-colors"
                        />
                    </div>
                    <div className="w-32 space-y-1">
                        <label className="text-xs font-medium text-gray-500">Code</label>
                        <input
                            name="code"
                            placeholder="e.g. CpE"
                            required
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-900 focus:outline-none focus:border-nwu-red transition-colors"
                        />
                    </div>
                    <button type="submit" className="bg-nwu-red text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center">
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                    </button>
                </form>
            </div>

            {/* Departments List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 font-bold">Code</th>
                                <th className="px-6 py-4 font-bold">Department Name</th>
                                <th className="px-6 py-4 font-bold">Status</th>
                                <th className="px-6 py-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {departments?.map((dept) => (
                                <tr key={dept.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-sm font-bold text-nwu-red">{dept.code}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{dept.name}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2">
                                            <span className={`h-2 w-2 rounded-full ${dept.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                {dept.is_active ? 'Active' : 'Frozen'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                            {isSuperAdmin && (
                                                <form action={toggleDepartmentStatus.bind(null, dept.id, dept.is_active)}>
                                                    <button className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all uppercase tracking-wider ${dept.is_active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}>
                                                        {dept.is_active ? 'Freeze' : 'Activate'}
                                                    </button>
                                                </form>
                                            )}
                                            <form action={deleteDepartment.bind(null, dept.id)}>
                                                <button className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {departments?.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500 italic">No departments found. Add one above.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
