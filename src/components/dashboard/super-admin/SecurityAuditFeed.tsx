"use client";

import { format } from "date-fns";
import { ShieldAlert, UserPlus, UserMinus } from "lucide-react";

interface AuditLog {
    id: string;
    action: string;
    target_type: string;
    details: Record<string, any>;
    created_at: string;
    instructor?: {
        name: string;
    };
}

export function SecurityAuditFeed({ logs }: { logs: AuditLog[] }) {
    const getIcon = (action: string) => {
        if (action.includes("APPROVED")) return UserPlus;
        if (action.includes("REJECTED")) return UserMinus;
        if (action.includes("ADD")) return UserPlus;
        if (action.includes("REMOVE") || action.includes("DELETE")) return UserMinus;
        return ShieldAlert;
    };

    const formatAction = (log: AuditLog) => {
        const actor = log.instructor?.name || "System";
        const action = log.action.replace(/_/g, " ").toLowerCase();
        return (
            <span className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-bold text-nwu-red">{actor}</span> {action} {log.target_type}
                {log.details?.instructor_name && <span className="font-medium"> [{log.details.instructor_name}]</span>}
                {log.details?.name && <span className="font-medium"> [{log.details.name}]</span>}
            </span>
        );
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 flex items-center">
                    <ShieldAlert className="h-5 w-5 mr-2 text-nwu-red" />
                    Security Audit Feed
                </h3>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] scrollbar-hide">
                {logs.length > 0 ? (
                    logs.map((log) => {
                        const Icon = getIcon(log.action);
                        return (
                            <div key={log.id} className="flex items-start p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                                <div className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm mr-3">
                                    <Icon className="h-4 w-4 text-gray-500" />
                                </div>
                                <div className="flex-1">
                                    {formatAction(log)}
                                    <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-tighter">
                                        {format(new Date(log.created_at), "h:mm:ss a · MMM dd")}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <ShieldAlert className="h-10 w-10 mb-2 opacity-20" />
                        <p className="text-sm">No recent admin actions detected.</p>
                    </div>
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold">
                    Real-time infrastructure monitoring
                </p>
            </div>
        </div>
    );
}
