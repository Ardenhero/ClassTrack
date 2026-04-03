"use client";

import { format } from "date-fns";
import { User, Calendar, Trash2, Loader2, CheckSquare, Square } from "lucide-react";
import { useState, useTransition } from "react";
import { bulkDeleteAuditLogs } from "./actions";
import { deleteAuditLog } from "../provisioning/actions";

interface AuditLogRecord {
    id: string;
    created_at: string;
    action: string;
    target_type: string;
    target_id: string | null;
    details: Record<string, unknown>;
    actor: { name: string } | null;
}

export function AuditLogsTable({ 
    logs, 
    isSuperAdmin,
    idToNameMap = {} 
}: { 
    logs: AuditLogRecord[] | null;
    isSuperAdmin: boolean;
    idToNameMap?: Record<string, string>;
}) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isPending, startTransition] = useTransition();
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const toggleSelectAll = () => {
        if (selectedIds.size === logs?.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(logs?.map(l => l.id) || []));
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const handleBulkDelete = () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} audit logs? This action is permanent.`)) return;
        
        startTransition(async () => {
            const res = await bulkDeleteAuditLogs(Array.from(selectedIds));
            if (res.error) {
                alert(res.error);
            } else {
                setSelectedIds(new Set());
            }
        });
    };

    const handleDeleteSingle = async (id: string) => {
        if (!confirm("Are you sure you want to delete this audit log entry?")) return;
        setDeletingId(id);
        try {
            await deleteAuditLog(id);
        } catch (err) {
            alert("Failed to delete log");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            {isSuperAdmin && selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/20 animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">
                        {selectedIds.size} logs selected
                    </p>
                    <button
                        onClick={handleBulkDelete}
                        disabled={isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-all disabled:opacity-50"
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Bulk Delete Permanently
                    </button>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all duration-300">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-widest font-bold border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                {isSuperAdmin && (
                                    <th className="px-6 py-4 w-10">
                                        <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600 transition-colors">
                                            {selectedIds.size === logs?.length && logs.length > 0 ? (
                                                <CheckSquare className="h-4 w-4 text-nwu-red" />
                                            ) : (
                                                <Square className="h-4 w-4" />
                                            )}
                                        </button>
                                    </th>
                                )}
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">Actor</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">Target</th>
                                <th className="px-6 py-4">Details</th>
                                {isSuperAdmin && <th className="px-6 py-4 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {logs?.map((log) => {
                                // Enhanced logic to resolve IDs in nested details
                                const detailPreview = Object.entries(log.details || {})
                                    .slice(0, 4)
                                    .map(([k, v]) => {
                                        // If the key is an ID-related field, try to resolve it
                                        const keyIsId = k.toLowerCase().includes('id') || k === 'deleted_by';
                                        if (keyIsId && typeof v === 'string' && idToNameMap[v]) {
                                            return `${k.replace(/_id$/g, '')}: ${idToNameMap[v]}`;
                                        }
                                        
                                        // Standard display
                                        const cleanVal = typeof v === 'object' ? '...' : String(v);
                                        return `${k}: ${cleanVal}`;
                                    })
                                    .join(", ");

                                const isSelected = selectedIds.has(log.id);

                                return (
                                    <tr 
                                        key={log.id} 
                                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group ${isSelected ? 'bg-nwu-red/5 dark:bg-nwu-red/5' : ''}`}
                                    >
                                        {isSuperAdmin && (
                                            <td className="px-6 py-4">
                                                <button onClick={() => toggleSelect(log.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                                                    {isSelected ? (
                                                        <CheckSquare className="h-4 w-4 text-nwu-red" />
                                                    ) : (
                                                        <Square className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </td>
                                        )}
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
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                                log.action.includes('delete') || log.action.includes('DELETE') ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                                                log.action.includes('add') || log.action.includes('CREATE') ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
                                                'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                            }`}>
                                                {log.action.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs">
                                                <p className="font-medium text-gray-500 dark:text-gray-400 uppercase text-[10px] tracking-wide">{log.target_type}</p>
                                                <p className="font-mono text-gray-400 text-[10px]">
                                                    {log.target_id && idToNameMap[log.target_id] 
                                                        ? idToNameMap[log.target_id] 
                                                        : log.target_id?.slice(0, 8) + "..."}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate font-mono opacity-60 group-hover:opacity-100 transition-opacity">
                                                {detailPreview || "No details"}
                                            </div>
                                        </td>
                                        {isSuperAdmin && (
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteSingle(log.id)}
                                                    disabled={deletingId === log.id}
                                                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50 disabled:opacity-50"
                                                >
                                                    {deletingId === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {(!logs || logs.length === 0) && (
                                <tr>
                                    <td colSpan={isSuperAdmin ? 7 : 5} className="px-6 py-12 text-center text-gray-500 italic">No audit logs found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
