import { createClient } from "@/utils/supabase/server";
import { Plus, Users, Key } from "lucide-react";
import { revalidatePath } from "next/cache";
import { checkIsSuperAdmin } from "@/lib/auth-utils";
import { DeleteInstructorButton } from "./DeleteInstructorButton";

export default async function InstructorsPage() {
    const isSuperAdmin = await checkIsSuperAdmin();
    const supabase = createClient();

    // Get the current auth user
    const { data: { user } } = await supabase.auth.getUser();

    // Determine filter based on role
    let query = supabase
        .from("instructors")
        .select(`
      id,
      name,
      role,
      pin_code,
      department_id,
      departments (
        name,
        code
      )
    `)
        .order("name");

    // If NOT Super Admin, filter by their owned instructors (or department)
    // Note: The original code used 'owner_id', which implies Admins create Instructor accounts.
    // We should keep that logic but expand it for Super Admins to see ALL.
    if (!isSuperAdmin) {
        query = query.eq("owner_id", user?.id ?? "");
    }

    const { data: instructors } = await query;

    // Fetch departments for the dropdown
    const { data: departments } = await supabase
        .from("departments")
        .select("id, name, code")
        .order("name");

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
        if (!isSuperAdmin) {
            const { data: creator } = await supabase
                .from('instructors')
                .select('department_id')
                .eq('auth_user_id', user?.id)
                .single();
            finalDept = creator?.department_id || null;
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
                    Instructors ({instructors?.length || 0})
                </h2>
                <div className="divide-y">
                    {instructors?.map((inst) => (
                        <div key={inst.id} className="flex items-center justify-between py-4 group">
                            <div className="flex items-center space-x-4">
                                <div className="h-10 w-10 rounded-full bg-nwu-red/10 flex items-center justify-center text-nwu-red font-bold text-sm">
                                    {inst.name[0]}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{inst.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <form action={async (formData: FormData) => {
                                            "use server";
                                            const { updateInstructorDepartment } = await import("./instructorActions");
                                            const deptId = formData.get("department_id") as string;
                                            await updateInstructorDepartment(inst.id, deptId === "" ? null : deptId);
                                        }}>
                                            {isSuperAdmin ? (
                                                <>
                                                    <select
                                                        name="department_id"
                                                        defaultValue={inst.department_id || ""}
                                                        className="px-1 py-0.5 border border-gray-200 rounded bg-transparent focus:ring-1 focus:ring-nwu-red outline-none transition-all text-[10px] font-medium w-32"
                                                    >
                                                        <option value="">(No Dept)</option>
                                                        {departments?.map((d) => (
                                                            <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="submit"
                                                        className="ml-1 p-1 bg-gray-100 text-gray-400 rounded hover:bg-nwu-red hover:text-white transition-all"
                                                        title="Save Department"
                                                    >
                                                        <Key className="h-3 w-3" />
                                                    </button>
                                                </>
                                            ) : (
                                                // Read Only for Dept Admins
                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">
                                                    {inst.departments?.code || "No Dept"}
                                                </span>
                                            )}
                                        </form>
                                        {inst.role === "admin" && (
                                            <span className="px-2 py-0.5 bg-nwu-gold/20 text-nwu-red rounded-full font-bold">Admin</span>
                                        )}
                                        {inst.pin_code && (
                                            <span className="flex items-center gap-1 text-amber-600">
                                                <Key className="h-3 w-3" /> PIN
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <DeleteInstructorButton instructorId={inst.id} instructorName={inst.name} />
                        </div>
                    ))}
                    {(!instructors || instructors.length === 0) && (
                        <p className="text-sm text-gray-400 py-4 text-center">No instructors yet. Add one above.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
