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

    // Fetch current user's instructor profile to get their Department Name (for display)
    // and Department ID (for assignment)
    const { data: currentUserProfile } = await supabase
        .from('instructors')
        .select('department_id, departments(name, code)')
        .eq('auth_user_id', user?.id)
        .maybeSingle();

    // @ts-expect-error: Supabase inference
    const currentUserDeptName = currentUserProfile?.departments?.name;
    const currentUserDeptId = currentUserProfile?.department_id;

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
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Add Instructor Form */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white drop-shadow-md mb-6">
                    <Plus className="h-5 w-5 text-nu-400 drop-shadow-[0_0_8px_rgba(176,42,42,0.8)]" />
                    Add Instructor
                </h2>
                <form action={addInstructor} className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">Name</label>
                        <input
                            name="name"
                            required
                            className="glass-input"
                            placeholder="Instructor name"
                        />
                    </div>
                    {isSuperAdmin && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Department</label>
                            <select name="department_id" className="glass-input">
                                <option value="" className="bg-dark-surface text-gray-400">No Department</option>
                                {departments?.map((d) => (
                                    <option key={d.id} value={d.id} className="bg-dark-surface text-white">{d.name} ({d.code})</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {!isSuperAdmin && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Department</label>
                            <input
                                type="text"
                                disabled
                                value={currentUserDeptName || "Your Department"}
                                className="glass-input opacity-70 cursor-not-allowed"
                            />
                            {/* Hidden input to actually submit the ID */}
                            <input type="hidden" name="department_id" value={currentUserDeptId || ""} />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">PIN Code (optional)</label>
                        <input
                            name="pin_code"
                            className="glass-input"
                            placeholder="Optional PIN"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">Role</label>
                        <select name="role" className="glass-input">
                            <option value="instructor" className="bg-dark-surface text-white">Instructor</option>
                        </select>
                    </div>
                    <div className="md:col-span-2 pt-2 border-t border-white/5 mt-2">
                        <button
                            type="submit"
                            className="w-full md:w-auto px-6 py-2.5 bg-nu-500 hover:bg-nu-400 text-white text-sm font-bold rounded-xl transition-all duration-300 shadow-glow-red hover:scale-105"
                        >
                            Add Instructor
                        </button>
                    </div>
                </form>
            </div>

            {/* Instructors List */}
            <div className="glass-card p-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white drop-shadow-md mb-6 relative z-10">
                    <Users className="h-5 w-5 text-nu-400 drop-shadow-[0_0_8px_rgba(176,42,42,0.8)]" />
                    Instructors <span className="text-sm font-normal text-gray-400">({instructors?.length || 0})</span>
                </h2>
                <div className="divide-y divide-white/5 relative z-10">
                    {instructors?.map((inst) => (
                        <div key={inst.id} className="flex flex-col md:flex-row md:items-center justify-between py-4 group gap-4 md:gap-0 hover:bg-white/5 rounded-xl px-2 transition-colors -mx-2">
                            <div className="flex items-center space-x-4">
                                <div className="h-10 w-10 rounded-full bg-dark-bg/50 border border-white/10 flex items-center justify-center text-gray-300 font-bold text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
                                    {inst.name[0]}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium text-white truncate">{inst.name}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <form className="flex items-center" action={async (formData: FormData) => {
                                            "use server";
                                            const { updateInstructorDepartment } = await import("./instructorActions");
                                            const deptId = formData.get("department_id") as string;
                                            await updateInstructorDepartment(inst.id, deptId === "" ? null : deptId);
                                        }}>
                                            {isSuperAdmin ? (
                                                <div className="flex items-center gap-1">
                                                    <select
                                                        name="department_id"
                                                        defaultValue={inst.department_id || ""}
                                                        className="px-2 py-1 text-[10px] bg-dark-bg/50 border border-white/10 rounded-lg text-gray-400 outline-none hover:border-white/30 transition-colors w-32 focus:border-nu-500"
                                                    >
                                                        <option value="" className="bg-dark-surface text-gray-500">(No Dept)</option>
                                                        {departments?.map((d) => (
                                                            <option key={d.id} value={d.id} className="bg-dark-surface text-gray-300">{d.name} ({d.code})</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="submit"
                                                        className="p-1.5 bg-white/5 text-gray-400 rounded-lg hover:bg-nu-500 hover:text-white transition-colors border border-transparent hover:border-nu-500/50 shadow-sm"
                                                        title="Save Department"
                                                    >
                                                        <Key className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                // Read Only for Dept Admins
                                                <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full border border-white/10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]">
                                                    {/* @ts-expect-error: Supabase sometimes infers relations as arrays */}
                                                    {inst.departments?.code || "No Dept"}
                                                </span>
                                            )}
                                        </form>
                                        {inst.role === "admin" && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-bold shadow-[0_0_10px_rgba(234,179,8,0.2)]">Admin</span>
                                        )}
                                        {inst.pin_code && (
                                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-nu-500/30 bg-nu-500/10 text-nu-400 font-medium">
                                                <Key className="h-3 w-3" /> PIN
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="pl-14 md:pl-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <DeleteInstructorButton instructorId={inst.id} instructorName={inst.name} />
                            </div>
                        </div>
                    ))}
                    {(!instructors || instructors.length === 0) && (
                        <div className="py-12 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center mt-6 bg-white/5 backdrop-blur-sm">
                            <Users className="h-8 w-8 text-gray-600 mb-2" />
                            <p className="text-sm font-medium text-gray-400">No instructors found.</p>
                            <p className="text-xs text-gray-500 mt-1 max-w-xs text-center">Add a new instructor above to see them here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
