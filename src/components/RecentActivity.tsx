import { createClient } from "@/utils/supabase/server";
import { formatDistanceToNow } from "date-fns";
import { cookies } from "next/headers";

interface AttendanceLog {
    id: string;
    status: string;
    timestamp: string;
    students: {
        name: string;
        year_level: string;
    } | null;
}

export async function RecentActivity() {
    const cookieStore = cookies(); // Opts into dynamic rendering
    const supabase = createClient();
    const { data } = await supabase
        .from('attendance_logs')
        .select(`
      id,
      status,
      timestamp,
      students (
        name,
        year_level
      )
    `)
        .order('timestamp', { ascending: false })
        .limit(5);

    const logs = data as unknown as AttendanceLog[];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Live Attendance Feed</h3>
            </div>
            <div className="divide-y divide-gray-100">
                {logs?.map((log: AttendanceLog) => (
                    <div key={log.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center space-x-4">
                            <div className="h-10 w-10 rounded-full bg-udemy-indigo/10 flex items-center justify-center text-udemy-indigo font-bold">
                                {log.students?.name?.[0] || '?'}
                            </div>
                            <div>
                                <p className="font-medium text-sm text-gray-900">{log.students?.name}</p>
                                <p className="text-xs text-gray-500">{log.students?.year_level}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {log.status}
                            </span>
                            <p className="text-xs text-gray-400 mt-1">
                                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                            </p>
                        </div>
                    </div>
                ))}
                {(!logs || logs.length === 0) && (
                    <div className="p-6 text-center text-gray-500 text-sm">
                        No recent activity
                    </div>
                )}
            </div>
        </div>
    );
}
