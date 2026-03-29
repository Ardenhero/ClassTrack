import { createClient } from "@/utils/supabase/server";
import { CommandCenter } from "./CommandCenter";
import { KioskHealthCard } from "@/components/KioskHealthCard";
import { IoTStatusMonitor } from "@/components/admin/IoTStatusMonitor";
import { AdminRoomControl } from "@/components/admin/AdminRoomControl";

export default async function SuperAdminDashboardContent() {
    const supabase = createClient();

    // ⚡ PARALLEL: Fire essential independent queries simultaneously
    const [
        { data: studentsData },
        { count: instructorCount },
        { count: totalKiosks },
        { count: totalDevices },
    ] = await Promise.all([
        supabase.from('students').select('department'),
        supabase.from('instructors').select('*', { count: 'exact', head: true }),
        supabase.from('kiosk_devices').select('*', { count: 'exact', head: true }),
        supabase.from('iot_devices').select('*', { count: 'exact', head: true }),
    ]);

    const totalStudents = studentsData?.length || 0;
    
    const stats = {
        totalKiosks: totalKiosks || 0,
        totalPopulation: (instructorCount || 0) + totalStudents,
        totalDevices: totalDevices || 0,
        isOperational: true
    };


    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">University Overview</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time infrastructure health and departmental pulse</p>
            </div>

            <CommandCenter stats={stats} />

            <div className="space-y-6 mt-6">
                {/* 1. Room Controls (Priority #1) */}
                <AdminRoomControl />

                {/* 2. Infrastructure Health (Priority #2) */}
                <IoTStatusMonitor />

                {/* 3. Kiosk Health (Priority #3) */}
                <KioskHealthCard />
            </div>
        </>
    );
}
