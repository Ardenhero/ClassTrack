import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/auth-utils";
import { cookies } from "next/headers";
import { Cpu, Save, Plus } from "lucide-react";
import { updateDeviceDepartment, updateDeviceDetails, createDevice } from "./actions";

export const dynamic = 'force-dynamic';

export default async function DevicesPage() {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return <div>Please log in.</div>;
    }

    // 2. Get Instructor Profile to check Role & Department
    // PRIORITIZE the profile from the cookie if available (handles multiple profiles)
    // ... (rest of profile fetching logic remains same)
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    let instructorQuery = supabase
        .from('instructors')
        .select('id, department_id, is_super_admin')
        .eq('auth_user_id', user.id);

    if (profileId && profileId !== 'admin-profile') {
        instructorQuery = instructorQuery.eq('id', profileId);
    } else if (profileId === 'admin-profile') {
        // Special case: If admin-profile, we want the admin record
        instructorQuery = instructorQuery.eq('role', 'admin');
    }

    // We use maybeSingle() because even with the cookie, we might not find it, 
    // or if no cookie, we hope for a single result.
    // If multiple exist and no cookie, maybeSingle might fail or return one. 
    // Ideally we want the 'admin' one if available.

    const { data: instructor } = await instructorQuery.maybeSingle();

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
            // No department assigned = No access to devices
            // but we might want to check if they are "admin" role without department? 
            // The prompt says "If the System Admin is already tied to a single department...". 
            // Implies they HAVE a department.
            // If they don't, showing nothing is correct.
            query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Force empty
        }
    }

    // Execute the query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: devices } = await query as { data: any[] | null, error: any };

    // Fetch departments for the dropdown (needed for Admin UI)
    const { data: departments } = await supabase
        .from("departments")
        .select("id, name, code")
        .order("name");

    // 4. Fetch available instructors for the dropdown
    let instructorListQuery = supabase.from('instructors').select('id, name, department_id').order('name');

    if (isSuperAdmin) {
        // User Request: For Super Admin, only show Admins in the list
        instructorListQuery = instructorListQuery.eq('role', 'admin');
    } else if (departmentId) {
        instructorListQuery = instructorListQuery.eq('department_id', departmentId);
    }
    const { data: availableInstructors } = await instructorListQuery;

    // Import client component
    const { DeviceInstructorSelector } = await import("./DeviceInstructorSelector");

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {isSuperAdmin && (
                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
                    <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-5 relative z-10 flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Register New Device
                    </h3>
                    <form action={async (formData: FormData) => {
                        "use server";
                        await createDevice(formData);
                    }} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end relative z-10">
                        <div className="md:col-span-1">
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Tuya Device ID</label>
                            <input name="id" required placeholder="bf41..." className="glass-input" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Name</label>
                            <input name="name" required placeholder="e.g. Lobby AC" className="glass-input" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Type</label>
                            <select name="type" className="glass-input">
                                <option value="SWITCH" className="bg-dark-surface text-white">Smart Switch</option>
                                <option value="FAN" className="bg-dark-surface text-white">Smart Fan</option>
                                <option value="LIGHT" className="bg-dark-surface text-white">Smart Light</option>
                                <option value="AC" className="bg-dark-surface text-white">Air Conditioner</option>
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">DP Code</label>
                            <input name="dp_code" placeholder="switch_1" defaultValue="switch_1" className="glass-input" />
                        </div>
                        <div className="md:col-span-1 pt-2 md:pt-0">
                            <button type="submit" className="w-full bg-nu-500 hover:bg-nu-400 text-white py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center shadow-glow-red hover:scale-105">
                                Register
                            </button>
                        </div>
                    </form>
                </div>
            )}
            <div className="glass-card p-6 overflow-hidden">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white drop-shadow-md mb-4 relative z-10">
                    <Cpu className="h-5 w-5 text-nu-400 drop-shadow-[0_0_8px_rgba(176,42,42,0.8)]" />
                    Manage IoT Devices <span className="text-sm font-normal text-gray-400">({devices?.length || 0})</span>
                </h2>

                <p className="text-sm text-gray-400 mb-6 font-medium bg-white/5 p-4 rounded-xl border border-white/10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] relative z-10">
                    Assign devices to departments to enable proper isolation. You can also restrict access to specific instructors.
                </p>

                <div className="overflow-x-auto h-[600px] overflow-y-auto pb-20 relative z-10 -mx-6 px-6"> {/* constraints for dropdown visibility */}
                    <table className="w-full text-left border-collapse pb-24">
                        <thead className="sticky top-0 bg-dark-bg/90 backdrop-blur-md z-20">
                            <tr className="border-b border-white/10 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                <th className="py-4 px-4 w-1/4">DEVICE DETAILS</th>
                                <th className="py-4 px-4">TUYA ID</th>
                                <th className="py-4 px-4">TYPE</th>
                                <th className="py-4 px-4">ASSIGNED DEPARTMENT</th>
                                <th className="py-4 px-4 text-right">
                                    {isSuperAdmin ? "ADMIN ACCESS" : "INSTRUCTOR ACCESS"}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {devices?.map((device) => (
                                <tr key={device.id} className="group hover:bg-white/5 transition-colors">
                                    <td className="py-5 px-4">
                                        <form className="flex flex-col gap-3" action={async (formData: FormData) => {
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
                                                    className="w-full px-3 py-1.5 text-sm font-bold border border-transparent hover:border-white/10 focus:border-nu-500 rounded-lg transition-all bg-transparent focus:bg-dark-bg text-white placeholder-gray-500"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    name="room"
                                                    defaultValue={device.room || ""}
                                                    placeholder="Room Name (e.g., Room 301)"
                                                    className="w-full px-3 py-1.5 text-xs font-medium border border-transparent hover:border-white/10 focus:border-nu-500 rounded-lg transition-all bg-transparent focus:bg-dark-bg text-gray-400 placeholder-gray-600"
                                                />
                                                <button
                                                    type="submit"
                                                    className="p-1.5 text-gray-500 hover:text-nu-400 hover:bg-white/5 rounded-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    title="Save Details"
                                                >
                                                    <Save className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </form>
                                    </td>
                                    <td className="py-5 px-4 text-xs font-mono text-gray-500 tracking-wider">
                                        {device.id}
                                    </td>
                                    <td className="py-5 px-4 text-[10px] uppercase font-black text-nu-400 tracking-widest drop-shadow-[0_0_5px_rgba(176,42,42,0.5)]">
                                        {device.type}
                                    </td>
                                    <td className="py-5 px-4 text-sm">
                                        {isSuperAdmin ? (
                                            <form className="flex items-center gap-2" action={async (formData: FormData) => {
                                                "use server";
                                                const deptId = formData.get("department_id") as string;
                                                await updateDeviceDepartment(device.id, deptId === "" ? null : deptId);
                                            }}>
                                                <select
                                                    name="department_id"
                                                    defaultValue={device.department_id || ""}
                                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-transparent hover:border-white/10 focus:border-nu-500 bg-transparent focus:bg-dark-bg text-gray-300 w-48 transition-all outline-none"
                                                >
                                                    <option value="" className="bg-dark-surface text-gray-500">(Global/Unassigned)</option>
                                                    {departments?.map((d) => (
                                                        <option key={d.id} value={d.id} className="bg-dark-surface text-white">{d.name} ({d.code})</option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="submit"
                                                    className="p-1.5 bg-white/5 text-gray-400 rounded-lg hover:bg-nu-500 hover:text-white transition-colors border border-transparent hover:border-nu-500/30 opacity-0 group-hover:opacity-100 focus:opacity-100 focus:border-nu-500"
                                                    title="Save Department"
                                                >
                                                    <Save className="h-4 w-4" />
                                                </button>
                                            </form>
                                        ) : (
                                            <span className="text-xs font-medium text-gray-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]">
                                                {device.departments?.name || "Unassigned"}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-5 px-4 text-right">
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
                                    <td colSpan={5} className="py-12 text-center text-sm text-gray-500 italic bg-white/5 border-2 border-dashed border-white/10 rounded-2xl">
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
