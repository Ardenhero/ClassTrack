import { createClient } from "@/utils/supabase/server";
import { ShieldAlert, User, Activity, Calendar, Filter } from "lucide-react";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage({
    searchParams,
}: {
    searchParams?: {
        actor?: string;
        action?: string;
    };
}) {
    const supabase = createClient();

    let query = supabase
        .from("audit_logs")
        .select(`
            *,
            actor:instructors(name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

    if (searchParams?.actor) {
        query = query.eq("actor_id", searchParams.actor);
    }
    if (searchParams?.action) {
        query = query.ilike("action", `%${searchParams.action}%`);
    }

    const { data: logs } = await query;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                        <ShieldAlert className="mr-2 h-6 w-6 text-nwu-red" />
                        Master Audit Trail
                    </h2>
                    <p className="text-sm text-gray-500">Forensic log of all administrative actions</p>
                </div>
            </div>

            {/* Forensic Filters (Simplified for now) */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-center">
                <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest mr-2">
                    <Filter className="h-3 w-3 mr-1" /> Filters
                </div>
                <form className="flex gap-4">
                    <input
                        name="action"
                        placeholder="Search action (e.g. DELETE)..."
                        defaultValue={searchParams?.action}
                        className="px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-nwu-red/20 outline-none"
                    />
                    <button type="submit" className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-all">
                        Apply Filters
                    </button>
                </form>
            </div>

            {/* Audit Table */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-[10px] uppercase tracking-widest font-bold">
                            <tr>
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">Actor</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">Target</th>
                                <th className="px-6 py-4">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {logs?.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center text-xs font-medium text-gray-900 dark:text-white">
                                            <Calendar className="h-3 w-3 mr-2 text-gray-400" />
                                            {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="h-7 w-7 bg-gray-100 rounded-full flex items-center justify-center mr-2">
                                                <User className="h-4 w-4 text-gray-500" />
                                            </div>
                                            <div className="text-xs">
                                                <p className="font-bold text-gray-900 dark:text-white">{(log.actor as any)?.name || "System"}</p>
                                                <p className="text-gray-400">{(log.actor as any)?.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${log.action.includes('DELETE') ? 'bg-red-50 text-red-600' :
                                                log.action.includes('ADD') || log.action.includes('CREATE') ? 'bg-green-50 text-green-600' :
                                                    'bg-blue-50 text-blue-600'
                                            }`}>
                                            {log.action.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs">
                                            <p className="font-medium text-gray-500 uppercase text-[10px] tracking-wide">{log.target_type}</p>
                                            <p className="font-mono text-gray-400 text-[10px]">{log.target_id?.slice(0, 8)}...</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-gray-500 max-w-xs truncate font-mono">
                                            {JSON.stringify(log.details)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {(!logs || logs.length === 0) && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">No audit logs found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
