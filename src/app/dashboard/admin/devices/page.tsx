import { createClient } from "@/utils/supabase/server";
import { checkIsSuperAdmin } from "@/lib/auth-utils";
import { cookies } from "next/headers";
import { Cpu, Plus, Loader2 } from "lucide-react";
import { createDevice } from "./actions";
import { Suspense } from "react";
import DeviceListContent from "./DeviceListContent";

export const dynamic = 'force-dynamic';

function DevicesSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-nwu-red" />
            <p className="text-gray-500 text-sm animate-pulse">Loading IoT infrastructure details...</p>
        </div>
    );
}

export default async function DevicesPage() {
    const supabase = createClient();

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return <div>Please log in.</div>;
    }

    // 2. Get Instructor Profile to check Role & Department
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    let instructorQuery = supabase
        .from('instructors')
        .select('id, department_id, is_super_admin')
        .eq('auth_user_id', user.id);

    if (profileId && profileId !== 'admin-profile') {
        instructorQuery = instructorQuery.eq('id', profileId);
    } else if (profileId === 'admin-profile') {
        instructorQuery = instructorQuery.eq('role', 'admin');
    }

    const { data: instructor } = await instructorQuery.maybeSingle();

    const isGlobalSuperAdmin = await checkIsSuperAdmin();
    const isSuperAdmin = isGlobalSuperAdmin || instructor?.is_super_admin;

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
                                <option value="DOOR_LOCK">Door Lock</option>
                                <option value="FINGERPRINT_DOOR_LOCK">Fingerprint Door Lock</option>
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
                    Manage IoT Devices
                </h2>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                    Assign devices to departments to enable proper isolation. You can also restrict access to specific instructors.
                </p>

                <Suspense fallback={<DevicesSkeleton />}>
                    <DeviceListContent instructor={instructor} />
                </Suspense>
            </div>
        </div>
    );
}
