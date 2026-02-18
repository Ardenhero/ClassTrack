import { createClient } from "@/utils/supabase/server";
import { Cpu, Save, Plus } from "lucide-react";
import { updateDeviceDepartment, updateDeviceDetails, createDevice } from "./actions";

export const dynamic = 'force-dynamic';

export default async function DevicesPage() {
    const supabase = createClient();

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return <div>Please log in.</div>;
    }

    // 2. Get Instructor Profile to check Role & Department
    const { data: instructor } = await supabase
        .from('instructors')
        .select('id, department_id, is_super_admin')
        .eq('auth_user_id', user.id)
        .single();

    // 3. Define the query based on Role
    let query = supabase
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

    const isSuperAdmin = instructor?.is_super_admin;
    const departmentId = instructor?.department_id;

    // RULE: Only Super Admin sees ALL devices.
    // Department Admins only see devices assigned to their Department.
    if (!isSuperAdmin) {
        if (departmentId) {
            query = query.eq('department_id', departmentId);
        } else {
            // No department assigned = No access to devices
            // (Or empty list if we want to be nice)
            query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Force empty
        }
    }

    const { data: devices } = await query;

    // Fetch departments for the dropdown
    const { data: departments } = await supabase
        .from("departments")
        .select("id, name, code")
        .order("name");

    return (
        <div className="space-y-8">
            {isSuperAdmin && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-4 flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Register New Device
                    </h3>
                    <form action={async (formData: FormData) => {
                        "use server";
                        await createDevice(formData);
                    }} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Tuya Device ID</label>
                            <input name="id" required placeholder="bf41..." className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-900 border-gray-200 dark:border-gray-600" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Name</label>
                            <input name="name" required placeholder="e.g. Lobby AC" className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-900 border-gray-200 dark:border-gray-600" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Type</label>
                            <select name="type" className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-900 border-gray-200 dark:border-gray-600">
                                <option value="SWITCH">Smart Switch</option>
                                <option value="FAN">Smart Fan</option>
                                <option value="LIGHT">Smart Light</option>
                                <option value="AC">Air Conditioner</option>
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">DP Code</label>
                            <input name="dp_code" placeholder="switch_1" defaultValue="switch_1" className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-900 border-gray-200 dark:border-gray-600" />
                        </div>
                        <div className="md:col-span-1">
                            <button type="submit" className="w-full bg-nwu-red text-white py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition">
                                Register
                            </button>
                        </div>
                    </form>
                </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-nwu-red" />
                    Manage IoT Devices ({devices?.length || 0})
                </h2>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                    Assign devices to departments to enable proper isolation. Only instructors in the assigned department will be able to see and control these devices.
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-700 text-sm font-bold text-gray-600 dark:text-gray-300">
                                <th className="py-3 px-4 w-1/3">DEVICE DETAILS</th>
                                <th className="py-3 px-4">TUYA ID</th>
                                <th className="py-3 px-4">TYPE</th>
                                <th className="py-3 px-4">ASSIGNED DEPARTMENT</th>
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
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {/* @ts-ignore */}
                                                {device.departments?.name || "Unassigned"}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {(!devices || devices.length === 0) && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-sm text-gray-400 italic">
                                        No IoT devices found in database.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
