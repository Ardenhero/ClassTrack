import { createClient } from "@/utils/supabase/server";
import { Plus, Users, Key } from "lucide-react";
import { revalidatePath } from "next/cache";
import { DeleteInstructorButton } from "./DeleteInstructorButton";

export default async function InstructorsPage() {
    const supabase = createClient();

    // Fetch instructors with their departments
    const { data: instructors } = await supabase
        .from("instructors")
        .select(`
      id,
      name,
      role,
      pin_code,
      departments (
        name,
        code
      )
    `)
        .order("name");

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

        // Handle empty strings
        const pin = pin_code && pin_code.trim() !== "" ? pin_code : null;
        const dept = department_id && department_id !== "" ? department_id : null;
        const userRole = role === "admin" ? "admin" : "instructor";

        const { error } = await supabase.from("instructors").insert({
            name,
            pin_code: pin,
            department_id: dept,
            role: userRole
        });

        if (error) {
            console.error("Error adding instructor:", error);
        }
        revalidatePath("/dashboard/admin/instructors");
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                    <Users className="mr-2 h-6 w-6 text-nwu-red" />
                    Instructors
                </h2>
            </div>

            {/* Add Instructor Form */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-4">Add New Instructor</h3>
                <form action={addInstructor} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-1 w-full">
                        <label className="text-xs font-medium text-gray-500">Full Name</label>
                        <input
                            name="name"
                            placeholder="e.g. Engr. John Doe"
                            required
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-900 focus:outline-none focus:border-nwu-red transition-colors"
                        />
                    </div>

                    <div className="w-full md:w-48 space-y-1">
                        <label className="text-xs font-medium text-gray-500">Department</label>
                        <select
                            name="department_id"
                            required
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-900 focus:outline-none focus:border-nwu-red transition-colors appearance-none bg-white dark:bg-gray-900"
                        >
                            <option value="">Select Dept...</option>
                            {departments?.map(d => (
                                <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full md:w-32 space-y-1">
                        <label className="text-xs font-medium text-gray-500">Role</label>
                        <select
                            name="role"
                            defaultValue="instructor"
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-900 focus:outline-none focus:border-nwu-red transition-colors appearance-none bg-white dark:bg-gray-900"
                        >
                            <option value="instructor">Instructor</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    <div className="w-full md:w-32 space-y-1">
                        <label className="text-xs font-medium text-gray-500">PIN (Optional)</label>
                        <input
                            name="pin_code"
                            placeholder="1234"
                            maxLength={4}
                            pattern="[0-9]{4}"
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-900 focus:outline-none focus:border-nwu-red transition-colors font-mono"
                        />
                    </div>

                    <button type="submit" className="bg-nwu-red text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center w-full md:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                    </button>
                </form>
            </div>

            {/* Instructors List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 font-bold">Name</th>
                                <th className="px-6 py-4 font-bold">Department</th>
                                <th className="px-6 py-4 font-bold">Security</th>
                                <th className="px-6 py-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {instructors?.map((inst: any) => (
                                <tr key={inst.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white flex items-center">
                                        <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs mr-3">
                                            {inst.name.charAt(0)}
                                        </div>
                                        <div>
                                            {inst.name}
                                            {inst.role === 'admin' && (
                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                    Admin
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {inst.departments ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                {inst.departments.code}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 text-xs italic">Unassigned</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {inst.pin_code ? (
                                            <div className="flex items-center text-green-600 text-xs font-medium">
                                                <Key className="h-3 w-3 mr-1" />
                                                PIN Set
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-xs">No PIN</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <DeleteInstructorButton instructorId={inst.id} instructorName={inst.name} />
                                    </td>
                                </tr>
                            ))}
                            {instructors?.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">No instructors found. Add one above.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
