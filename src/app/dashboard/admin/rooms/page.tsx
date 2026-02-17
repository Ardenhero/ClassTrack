import { createClient } from "@/utils/supabase/server";
import { Trash2, Plus, Home, MonitorSmartphone } from "lucide-react";
import { revalidatePath } from "next/cache";
import { checkAuth } from "@/lib/auth-utils";

export default async function RoomsPage() {
    const auth = await checkAuth();
    if (!auth) return null; // Should be handled by layout/middleware

    const { profile } = auth;
    const isSuperAdmin = profile.is_super_admin;
    const myDeptId = profile.department_id;

    const supabase = createClient();

    // Fetch Rooms
    let query = supabase
        .from("rooms")
        .select(`
            id, 
            name, 
            department_id,
            departments ( name ),
            device_endpoints ( count )
        `)
        .order("name");

    // If not super admin, filter by my dept
    if (!isSuperAdmin && myDeptId) {
        query = query.eq("department_id", myDeptId);
    }

    const { data: rooms } = await query;

    // Fetch Departments for Dropdown (if Super Admin)
    // If regular admin, we just use their ID invisible
    let departments: { id: string, name: string }[] = [];
    if (isSuperAdmin) {
        const { data: depts } = await supabase.from("departments").select("id, name").order("name");
        departments = depts || [];
    }

    async function addRoom(formData: FormData) {
        "use server";
        const auth = await checkAuth();
        if (!auth) return; // or throw

        const name = formData.get("name") as string;
        let deptId = formData.get("department_id") as string;

        const { profile } = auth;
        const supabase = createClient();

        // Security check: Force deptId if not super admin
        if (!profile.is_super_admin) {
            deptId = profile.department_id;
        }

        if (!name || !deptId) return;

        await supabase.from("rooms").insert({ name, department_id: deptId });
        revalidatePath("/dashboard/admin/rooms");
    }

    async function deleteRoom(id: string) {
        "use server";
        const auth = await checkAuth();
        if (!auth) return;

        const { profile } = auth;
        const supabase = createClient();

        // Security check: Ensure room belongs to my dept if not super admin
        if (!profile.is_super_admin) {
            const { data: room } = await supabase.from("rooms").select("department_id").eq("id", id).single();
            if (!room || room.department_id !== profile.department_id) {
                return; // Silently fail or throw
            }
        }

        await supabase.from("rooms").delete().eq("id", id);
        revalidatePath("/dashboard/admin/rooms");
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                    <Home className="mr-2 h-6 w-6 text-nwu-red" />
                    Room Management
                </h2>
                <div className="text-xs text-gray-400 font-medium bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700">
                    {rooms?.length || 0} rooms total
                </div>
            </div>

            {/* Add Room Form */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-4">Register New Room</h3>
                <form action={addRoom} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-gray-500">Room Name</label>
                        <input
                            name="name"
                            placeholder="e.g. STC103"
                            required
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-900 focus:outline-none focus:border-nwu-red transition-colors"
                        />
                    </div>

                    {isSuperAdmin ? (
                        <div className="w-1/3 space-y-1">
                            <label className="text-xs font-medium text-gray-500">Department</label>
                            <select
                                name="department_id"
                                required
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-900 focus:outline-none focus:border-nwu-red transition-colors appearance-none"
                            >
                                <option value="" disabled selected>Select Department</option>
                                {departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <input type="hidden" name="department_id" value={myDeptId || ""} />
                    )}

                    <button type="submit" className="bg-nwu-red text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center shadow-lg shadow-nwu-red/10">
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                    </button>
                </form>
            </div>

            {/* Rooms List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#5e0d0e] text-white text-[10px] uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 font-bold">Room Name</th>
                                <th className="px-6 py-4 font-bold">Department</th>
                                <th className="px-6 py-4 font-bold">Devices</th>
                                <th className="px-6 py-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {rooms?.map((room) => (
                                <tr key={room.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white text-sm">{room.name}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                                            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                                            {/* @ts-ignore */}
                                            {room.departments?.name || "Unknown"}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 font-medium">
                                            <MonitorSmartphone className="h-3 w-3 mr-1.5 text-gray-400" />
                                            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                                            {/* @ts-ignore */}
                                            {room.device_endpoints?.[0]?.count || 0} endpoints
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                            <form action={deleteRoom.bind(null, room.id)}>
                                                <button className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {rooms?.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">No rooms found. Add one above.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
