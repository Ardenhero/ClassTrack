import { createClient } from "@/utils/supabase/server";
import { Cpu, Save } from "lucide-react";
import { updateDeviceDepartment } from "./actions";

export default async function DevicesPage() {
    const supabase = createClient();

    // Fetch all IoT devices with their department info
    const { data: devices } = await supabase
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

    // Fetch departments for the dropdown
    const { data: departments } = await supabase
        .from("departments")
        .select("id, name, code")
        .order("name");

    return (
        <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-md border p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-nwu-red" />
                    Manage IoT Devices ({devices?.length || 0})
                </h2>

                <p className="text-sm text-gray-500 mb-6 font-medium bg-blue-50 p-3 rounded-lg border border-blue-100">
                    Assign devices to departments to enable proper isolation. Only instructors in the assigned department will be able to see and control these devices.
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b text-sm font-bold text-gray-600">
                                <th className="py-3 px-4">NAME</th>
                                <th className="py-3 px-4">TUYA ID</th>
                                <th className="py-3 px-4">TYPE</th>
                                <th className="py-3 px-4">ASSIGNED DEPARTMENT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {devices?.map((device) => (
                                <tr key={device.id} className="group hover:bg-gray-50 transition-colors">
                                    <td className="py-4 px-4">
                                        <div className="font-medium text-gray-900">{device.name}</div>
                                        <div className="text-xs text-gray-400 font-medium">Room: {device.room || 'N/A'}</div>
                                    </td>
                                    <td className="py-4 px-4 text-xs font-mono text-gray-500">
                                        {device.id}
                                    </td>
                                    <td className="py-4 px-4 uppercase text-xs font-bold text-nwu-red">
                                        {device.type}
                                    </td>
                                    <td className="py-4 px-4 text-sm">
                                        <form className="flex items-center gap-2" action={async (formData: FormData) => {
                                            "use server";
                                            const deptId = formData.get("department_id") as string;
                                            await updateDeviceDepartment(device.id, deptId === "" ? null : deptId);
                                        }}>
                                            <select
                                                name="department_id"
                                                defaultValue={device.department_id || ""}
                                                className="px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nwu-red focus:border-transparent transition-all text-xs font-medium w-48"
                                            >
                                                <option value="">(Global/Unassigned)</option>
                                                {departments?.map((d) => (
                                                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                                                ))}
                                            </select>
                                            <button
                                                type="submit"
                                                className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-nwu-red hover:text-white transition-all shadow-sm"
                                                title="Save Department"
                                            >
                                                <Save className="h-4 w-4" />
                                            </button>
                                        </form>
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
