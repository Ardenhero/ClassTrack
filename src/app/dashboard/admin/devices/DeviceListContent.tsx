import { createAdminClient } from "@/utils/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/auth-utils";
import { Save } from "lucide-react";
import { updateDeviceDepartment, updateDeviceDetails } from "./actions";
import { DeviceInstructorSelector } from "./DeviceInstructorSelector";

export default async function DeviceListContent({
    instructor,
}: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instructor: any;
}) {
    const adminSupabase = createAdminClient();

    // 3. Define the query based on Role, using ADMIN client to bypass RLS
    // We will manually enforce scoping below.
    let query = adminSupabase
        .from("iot_devices")
        .select(`
            *,
            departments (
                id,
                name,
                code
            )
        `)
        .order("name");

    const isGlobalSuperAdmin = await checkIsSuperAdmin();
    const isSuperAdmin = isGlobalSuperAdmin || instructor?.is_super_admin;
    const departmentId = instructor?.department_id;

    // RULE: Only Super Admin sees ALL devices.
    // Department Admins only see devices assigned to their Department.
    if (!isSuperAdmin) {
        if (departmentId) {
            query = query.eq('department_id', departmentId);
        } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Force empty
        }
    }

    // Execute the query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: devices } = await query as { data: any[] | null, error: any };

    // Fetch departments for the dropdown (needed for Admin UI)
    const { data: departments } = await adminSupabase
        .from("departments")
        .select("id, name, code")
        .order("name");

    // 4. Fetch available instructors for the dropdown
    let instructorListQuery = adminSupabase.from('instructors').select('id, name, department_id').order('name');

    if (isSuperAdmin) {
        // User Request: For Super Admin, only show Admins in the list
        instructorListQuery = instructorListQuery.eq('role', 'admin');
    } else if (departmentId) {
        instructorListQuery = instructorListQuery.eq('department_id', departmentId);
    }
    const { data: availableInstructors } = await instructorListQuery;

    return (
        <div className="overflow-x-auto h-[600px] overflow-y-auto pb-20"> {/* constraints for dropdown visibility */}
            <table className="w-full text-left border-collapse pb-24">
                <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 text-sm font-bold text-gray-600 dark:text-gray-300">
                        <th className="py-3 px-4 w-1/4">DEVICE DETAILS</th>
                        <th className="py-3 px-4">TUYA ID</th>
                        <th className="py-3 px-4">TYPE</th>
                        <th className="py-3 px-4">ASSIGNED DEPARTMENT</th>
                        <th className="py-3 px-4">
                            {isSuperAdmin ? "ADMIN ACCESS" : "INSTRUCTOR ACCESS"}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {devices?.map((device) => (
                        <tr key={device.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="py-4 px-4">
                                <form className="flex flex-col gap-2" action={async (formData: FormData) => {
                                    "use server";
                                    const name = formData.get("name") as string;
                                    const room = formData.get("room") as string;
                                    await updateDeviceDetails(device.id, name, room);
                                }}>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            name="name"
                                            defaultValue={device.name}
                                            placeholder="Device Name"
                                            className="px-2 py-1 text-sm font-medium border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-nwu-red rounded transition-all w-full bg-transparent focus:bg-white dark:focus:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            name="room"
                                            defaultValue={device.room || ""}
                                            placeholder="Room Name (e.g., Room 301)"
                                            className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-nwu-red rounded transition-all w-full bg-transparent focus:bg-white dark:focus:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
                                        />
                                        <button
                                            type="submit"
                                            className="p-1 text-gray-400 hover:text-nwu-red transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            title="Save Details"
                                        >
                                            <Save className="h-4 w-4" />
                                        </button>
                                    </div>
                                </form>
                            </td>
                            <td className="py-4 px-4 text-xs font-mono text-gray-500 dark:text-gray-400">
                                {device.id}
                            </td>
                            <td className="py-4 px-4 uppercase text-xs font-bold text-nwu-red">
                                {device.type}
                            </td>
                            <td className="py-4 px-4 text-sm">
                                {isSuperAdmin ? (
                                    <form className="flex items-center gap-2" action={async (formData: FormData) => {
                                        "use server";
                                        const deptId = formData.get("department_id") as string;
                                        await updateDeviceDepartment(device.id, deptId === "" ? null : deptId);
                                    }}>
                                        <select
                                            name="department_id"
                                            defaultValue={device.department_id || ""}
                                            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-nwu-red focus:border-transparent transition-all text-xs font-medium w-48 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        >
                                            <option value="">(Global/Unassigned)</option>
                                            {departments?.map((d) => (
                                                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                                            ))}
                                        </select>
                                        <button
                                            type="submit"
                                            className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-nwu-red hover:text-white transition-all shadow-sm"
                                            title="Save Department"
                                        >
                                            <Save className="h-4 w-4" />
                                        </button>
                                    </form>
                                ) : (
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded">
                                        {device.departments?.name || "Unassigned"}
                                    </span>
                                )}
                            </td>
                            <td className="py-4 px-4">
                                <DeviceInstructorSelector
                                    deviceId={device.id}
                                    assignedIds={device.assigned_instructor_ids}
                                    instructors={availableInstructors || []}
                                    isSuperAdmin={Boolean(isSuperAdmin)}
                                />
                            </td>
                        </tr>
                    ))}
                    {(!devices || devices.length === 0) && (
                        <tr>
                            <td colSpan={5} className="py-8 text-center text-sm text-gray-400 italic">
                                No IoT devices found in database.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
