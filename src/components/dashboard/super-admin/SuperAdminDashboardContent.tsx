import { createClient } from "@/utils/supabase/server";
import { format, startOfHour, endOfHour, eachHourOfInterval, subHours } from "date-fns";
import { CommandCenter } from "./CommandCenter";
import { GatewayHealth } from "./GatewayHealth";

export default async function SuperAdminDashboardContent() {
    const supabase = createClient();

    // 1. Infrastructure Status
    const { count: activeDepartments } = await supabase
        .from('departments')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

    const { count: instructorCount } = await supabase
        .from('instructors')
        .select('*', { count: 'exact', head: true });

    const { count: totalStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

    // Active Sessions (Distinct classes with activity in last 2 hours)
    const twoHoursAgo = subHours(new Date(), 2).toISOString();
    const { data: activeSessionsData } = await supabase
        .from('attendance_logs')
        .select('class_id', { count: 'exact' })
        .gte('timestamp', twoHoursAgo);
    const activeSessions = new Set(activeSessionsData?.map(s => s.class_id)).size;

    const stats = {
        activeDepartments: activeDepartments || 0,
        totalPopulation: (instructorCount || 0) + (totalStudents || 0),
        activeSessions: activeSessions || 0,
        isOperational: true // If we are here, DB is up
    };

    // 2. Traffic Analytics (Check-ins per hour for last 24h)
    const dayAgo = subHours(new Date(), 24).toISOString();
    const { data: trafficLogs } = await supabase
        .from('attendance_logs')
        .select('timestamp')
        .gte('timestamp', dayAgo);

    const hours = eachHourOfInterval({
        start: subHours(new Date(), 23),
        end: new Date()
    });

    const trafficData = hours.map(hour => {
        const hStart = startOfHour(hour);
        const hEnd = endOfHour(hour);
        const count = trafficLogs?.filter(l => {
            const d = new Date(l.timestamp);
            return d >= hStart && d <= hEnd;
        }).length || 0;
        return {
            hour: format(hour, 'ha'),
            count
        };
    });

    // 3. Security Audit Feed
    const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*, instructor:actor_id(name)')
        .order('created_at', { ascending: false })
        .limit(10);

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">University Pulse</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time infrastructure health and security audit</p>
            </div>

            <CommandCenter stats={stats} logs={auditLogs || []} trafficData={trafficData} />

            {/* IoT Infrastructure Health */}
            <div className="mt-6">
                <GatewayHealth />
            </div>
        </>
    );
}
