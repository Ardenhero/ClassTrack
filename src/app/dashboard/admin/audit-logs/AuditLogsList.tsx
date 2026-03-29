import { createClient } from "@/utils/supabase/server";
import { format } from "date-fns";
import { User, Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";

interface AuditLogRecord {
    id: string;
    created_at: string;
    action: string;
    target_type: string;
    target_id: string | null;
    details: Record<string, unknown>;
    actor: { name: string } | null;
}

export default async function AuditLogsList({
    searchParams,
}: {
    searchParams?: {
        actor?: string;
        action?: string;
        offset?: string;
    };
}) {
    const supabase = createClient();
    const limit = 20;
    const offset = parseInt(searchParams?.offset || "0");

    let query = supabase
        .from("audit_logs")
        .select(`
            *,
            actor:instructors(name)
        `)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (searchParams?.actor) {
        query = query.eq("actor_id", searchParams.actor);
    }
    if (searchParams?.action) {
        query = query.ilike("action", `%${searchParams.action}%`);
    }

    const { data: logs } = await query;

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all duration-300">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-widest font-bold border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">Actor</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">Target</th>
                                <th className="px-6 py-4">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {logs?.map((log: AuditLogRecord) => {
                                // Efficiently summarize details to avoid heavy DOM/Main thread blocking
                                const detailPreview = Object.entries(log.details || {})
                                    .slice(0, 3)
                                    .map(([k, v]) => `${k}: ${typeof v === 'object' ? '...' : v}`)
                                    .join(", ");

                                return (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center text-xs font-medium text-gray-900 dark:text-white">
                                                <Calendar className="h-3 w-3 mr-2 text-gray-400" aria-hidden="true" />
                                                {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="h-7 w-7 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mr-2">
                                                    <User className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                                                </div>
                                                <div className="text-xs">
                                                    <p className="font-bold text-gray-900 dark:text-white">{log.actor?.name || "System"}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${log.action.includes('DELETE') ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                                                log.action.includes('ADD') || log.action.includes('CREATE') ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
                                                    'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                                }`}>
                                                {log.action.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs">
                                                <p className="font-medium text-gray-500 dark:text-gray-400 uppercase text-[10px] tracking-wide">{log.target_type}</p>
                                                <p className="font-mono text-gray-400 text-[10px]">{log.target_id?.slice(0, 8)}...</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate font-mono opacity-60 group-hover:opacity-100 transition-opacity">
                                                {detailPreview || "No details"}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {(!logs || logs.length === 0) && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">No audit logs found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Link-based Pagination (Performance Optimized) */}
            {logs && logs.length === limit && (
                <div className="flex justify-center pt-4">
                    <Link
                        href={`/dashboard/admin/audit-logs?offset=${offset + limit}${searchParams?.action ? `&action=${searchParams.action}` : ""}`}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-gray-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-black dark:hover:bg-gray-600 transition-all shadow-lg active:scale-95"
                    >
                        Load More Entries
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>
            )}
        </div>
    );
}
