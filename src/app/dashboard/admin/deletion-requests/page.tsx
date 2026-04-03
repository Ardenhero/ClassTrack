"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Loader2, AlertCircle, CheckCircle, XCircle, Users, BookOpen, ShieldAlert } from "lucide-react";
import { createClient } from "../../../../utils/supabase/client";
import { permanentlyDeleteStudent, bulkPermanentlyDeleteStudents } from "../../../../app/students/actions";
import { permanentlyDeleteClass, bulkPermanentlyDeleteClasses } from "../../../../app/classes/actions";
import { deleteAdmin } from "../../../../app/dashboard/admin/provisioning/actions";
import { ConfirmationModal } from "../../../../components/ConfirmationModal";

interface DeletionRequest {
    id: string;
    entity_type: "student" | "class" | "account_deletion";
    entity_id: string;
    entity_name: string;
    reason: string | null;
    status: string;
    created_at: string;
    requested_by: string;
    requester_name?: string;
}

export default function DeletionRequestsPage() {
    const supabase = createClient();
    const [requests, setRequests] = useState<DeletionRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant: "danger" | "warning";
    }>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
        variant: "danger"
    });

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from("deletion_requests")
            .select("id, entity_type, entity_id, entity_name, reason, status, created_at, requested_by")
            .in("entity_type", ["student", "class", "account_deletion"])
            .order("created_at", { ascending: false });

        if (data && data.length > 0) {
            // ⚡ BATCH: Fetch all requester names in ONE query instead of N queries
            const requesterIds = Array.from(new Set(data.map((r: DeletionRequest) => r.requested_by)));
            const { data: instructors } = await supabase
                .from("instructors")
                .select("id, name")
                .in("id", requesterIds);

            const nameMap = new Map(instructors?.map((i: { id: string; name: string }) => [i.id, i.name]) || []);
            const enriched = data.map((req: DeletionRequest) => ({
                ...req,
                requester_name: nameMap.get(req.requested_by) || "Unknown",
            }));
            setRequests(enriched);
        } else {
            setRequests([]);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const handleApprove = async (req: DeletionRequest) => {
        let title = "Approve Deletion";
        let message = `Permanently delete ${req.entity_type} "${req.entity_name}"? This CANNOT be undone.`;
        const variant: "danger" | "warning" = "danger";

        if (req.entity_type === "account_deletion") {
            title = "PERMANENT Account Deletion";
            message = `⚠️ PERMANENTLY DELETE the account for "${req.entity_name}"?\n\nThis will:\n• Remove their auth account\n• Delete all instructors, classes, students\n• Delete kiosk assignments\n\nThis CANNOT be undone.`;
        }

        setConfirmConfig({
            isOpen: true,
            title,
            message,
            variant,
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                setActionLoading(`approve-${req.id}`);
                try {
                    if (req.entity_type === "account_deletion") {
                        await deleteAdmin(req.entity_id);
                    } else {
                        if (req.entity_type === "student") {
                            await permanentlyDeleteStudent(req.entity_id);
                        } else {
                            await permanentlyDeleteClass(req.entity_id);
                        }
                    }

                    // Update request status
                    await supabase.from("deletion_requests").update({
                        status: "approved",
                        reviewed_at: new Date().toISOString(),
                    }).eq("id", req.id);

                    fetchRequests();
                } catch (err) {
                    alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
                } finally {
                    setActionLoading(null);
                }
            }
        });
    };

    const handleReject = async (req: DeletionRequest) => {
        setActionLoading(`reject-${req.id}`);

        await supabase.from("deletion_requests").update({
            status: "rejected",
            reviewed_at: new Date().toISOString(),
        }).eq("id", req.id);

        setActionLoading(null);
        fetchRequests();
    };

    const pendingRequests = requests.filter(r => r.status === "pending");
    const resolvedRequests = requests.filter(r => r.status !== "pending");

    // Multi-selection handlers
    const togglePendingSelection = (id: string) => {
        setSelectedPendingIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleAllPending = () => {
        if (selectedPendingIds.length === pendingRequests.length) {
            setSelectedPendingIds([]);
        } else {
            setSelectedPendingIds(pendingRequests.map(r => r.id));
        }
    };

    const handleBulkApprove = async () => {
        if (selectedPendingIds.length === 0) return;

        const selectedRequests = pendingRequests.filter(r => selectedPendingIds.includes(r.id));
        const hasAccountDeletion = selectedRequests.some(r => r.entity_type === "account_deletion");

        const title = "Bulk Approve Deletions";
        let message = `Are you sure you want to approve and PERMANENTLY DELETE ${selectedPendingIds.length} items? This CANNOT be undone.`;
        if (hasAccountDeletion) {
            message = `⚠️ WARNING: Your selection includes Account Deletions.\n\nAre you ABSOLUTELY SURE you want to approve and PERMANENTLY DELETE ${selectedPendingIds.length} items, including entire instructor accounts? This CANNOT be undone.`;
        }

        setConfirmConfig({
            isOpen: true,
            title,
            message,
            variant: "danger",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                setActionLoading("bulk-approve");
                try {
                    // ⚡ GROUP by entity type and batch-delete each type in ONE call
                    const studentIds = selectedRequests.filter(r => r.entity_type === "student").map(r => r.entity_id);
                    const classIds = selectedRequests.filter(r => r.entity_type === "class").map(r => r.entity_id);
                    const accountRequests = selectedRequests.filter(r => r.entity_type === "account_deletion");

                    // Fire student + class batch deletes in parallel (1 call each)
                    const batchPromises: Promise<unknown>[] = [];
                    if (studentIds.length > 0) batchPromises.push(bulkPermanentlyDeleteStudents(studentIds));
                    if (classIds.length > 0) batchPromises.push(bulkPermanentlyDeleteClasses(classIds));
                    await Promise.all(batchPromises);

                    // Account deletions still need individual calls (they do complex cleanup)
                    for (const req of accountRequests) {
                        try { await deleteAdmin(req.entity_id); } catch (err) {
                            console.error(`Failed to delete account ${req.entity_name}:`, err);
                        }
                    }

                    // Bulk update status in ONE query
                    await supabase.from("deletion_requests").update({
                        status: "approved",
                        reviewed_at: new Date().toISOString(),
                    }).in("id", selectedPendingIds);

                    setSelectedPendingIds([]);
                    fetchRequests();
                } catch (err) {
                    alert(`Error during bulk approval: ${err instanceof Error ? err.message : String(err)}`);
                } finally {
                    setActionLoading(null);
                }
            }
        });
    };

    const handleBulkReject = async () => {
        if (selectedPendingIds.length === 0) return;
        setConfirmConfig({
            isOpen: true,
            title: "Bulk Reject Requests",
            message: `Reject ${selectedPendingIds.length} deletion requests?`,
            variant: "warning",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                setActionLoading("bulk-reject");
                try {
                    await supabase.from("deletion_requests").update({
                        status: "rejected",
                        reviewed_at: new Date().toISOString(),
                    }).in("id", selectedPendingIds);

                    setSelectedPendingIds([]);
                    fetchRequests();
                } catch (err) {
                    alert(`Error during bulk rejection: ${err instanceof Error ? err.message : String(err)}`);
                } finally {
                    setActionLoading(null);
                }
            }
        });
    };

    const handleClearHistory = async () => {
        if (resolvedRequests.length === 0) return;
        setConfirmConfig({
            isOpen: true,
            title: "Clear History",
            message: `Are you sure you want to clear all ${resolvedRequests.length} resolved history records? They will be removed from your view permanently.`,
            variant: "danger",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                setActionLoading("clear-history");
                try {
                    const resolvedIds = resolvedRequests.map(r => r.id);
                    await supabase.from("deletion_requests").delete().in("id", resolvedIds);
                    fetchRequests();
                } catch (err) {
                    alert(`Error clearing history: ${err instanceof Error ? err.message : String(err)}`);
                } finally {
                    setActionLoading(null);
                }
            }
        });
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 1) return "Just now";
        if (hours < 24) return `${hours}h ago`;
        if (days === 1) return "Yesterday";
        return `${days} days ago`;
    };

    const getRequestIcon = (type: string) => {
        switch (type) {
            case "account_deletion": return <ShieldAlert className="h-5 w-5" />;
            case "student": return <Users className="h-5 w-5" />;
            case "class": return <BookOpen className="h-5 w-5" />;
            default: return <Trash2 className="h-5 w-5" />;
        }
    };

    const getRequestColor = (type: string) => {
        switch (type) {
            case "account_deletion": return "bg-red-50 text-red-500 dark:bg-red-900/20";
            case "student": return "bg-blue-50 text-blue-500 dark:bg-blue-900/20";
            case "class": return "bg-purple-50 text-purple-500 dark:bg-purple-900/20";
            default: return "bg-gray-50 text-gray-500 dark:bg-gray-900/20";
        }
    };

    const getRequestLabel = (type: string) => {
        switch (type) {
            case "account_deletion": return "Account Deletion";
            default: return type;
        }
    };

    const getApproveLabel = (type: string) => {
        switch (type) {
            case "account_deletion": return "Approve & Delete";
            default: return "Approve & Delete";
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-red-500" />
                    Deletion Requests
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Review and approve or reject deletion and deactivation requests.
                </p>
            </div>

            {loading ? (
                <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
            ) : pendingRequests.length === 0 && resolvedRequests.length === 0 ? (
                <div className="p-12 text-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No requests yet.
                </div>
            ) : (
                <>
                    {/* Pending Requests */}
                    {pendingRequests.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    Pending ({pendingRequests.length})
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={pendingRequests.length > 0 && selectedPendingIds.length === pendingRequests.length}
                                        onChange={toggleAllPending}
                                        className="w-4 h-4 rounded border-gray-300 text-nwu-red focus:ring-nwu-red dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                                    />
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                        Select All
                                    </span>
                                </label>
                            </div>

                            {/* Bulk Actions Menu */}
                            {selectedPendingIds.length > 0 && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-center justify-between mb-4 animate-in slide-in-from-top-2 duration-200">
                                    <span className="text-sm font-bold text-amber-800 dark:text-amber-400">
                                        {selectedPendingIds.length} request{selectedPendingIds.length !== 1 && 's'} selected
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleBulkReject}
                                            disabled={!!actionLoading}
                                            className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            {actionLoading === "bulk-reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Reject Selected
                                        </button>
                                        <button
                                            onClick={handleBulkApprove}
                                            disabled={!!actionLoading}
                                            className="px-3 py-1.5 text-xs font-bold text-red-700 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            {actionLoading === "bulk-approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} Approve & Delete Selected
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                {pendingRequests.map(req => (
                                    <div key={req.id} className={`bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between transition-colors ${selectedPendingIds.includes(req.id) ? "ring-2 ring-amber-400 dark:ring-amber-500 bg-amber-50/30 dark:bg-amber-900/10" : ""} ${req.entity_type === "account_deletion"
                                        ? "border-2 border-red-200 dark:border-red-800/50"
                                        : "border border-amber-200 dark:border-amber-800/50"
                                        }`}>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedPendingIds.includes(req.id)}
                                                onChange={() => togglePendingSelection(req.id)}
                                                className="w-4 h-4 rounded border-gray-300 text-nwu-red focus:ring-nwu-red dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                                            />
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${getRequestColor(req.entity_type)}`}>
                                                {getRequestIcon(req.entity_type)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900 dark:text-white">{req.entity_name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${getRequestColor(req.entity_type)}`}>{getRequestLabel(req.entity_type)}</span>
                                                    <span className="text-[10px] text-gray-400">•</span>
                                                    <span className="text-[10px] text-gray-400">By {req.requester_name}</span>
                                                    <span className="text-[10px] text-gray-400">•</span>
                                                    <span className="text-[10px] text-gray-400">{timeAgo(req.created_at)}</span>
                                                </div>
                                                {req.reason && <p className="text-xs text-gray-500 mt-1 italic">&ldquo;{req.reason}&rdquo;</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleReject(req)}
                                                disabled={!!actionLoading}
                                                className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                                            >
                                                {actionLoading === `reject-${req.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />} Reject
                                            </button>
                                            <button
                                                onClick={() => handleApprove(req)}
                                                disabled={!!actionLoading}
                                                className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                                            >
                                                {actionLoading === `approve-${req.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} {getApproveLabel(req.entity_type)}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Resolved Requests */}
                    {resolvedRequests.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3 mt-8">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    History ({resolvedRequests.length})
                                </div>
                                <button
                                    onClick={handleClearHistory}
                                    disabled={!!actionLoading}
                                    className="px-3 py-1.5 text-xs font-bold text-gray-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {actionLoading === "clear-history" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Clear History
                                </button>
                            </div>
                            <div className="space-y-2">
                                {resolvedRequests.slice(0, 10).map(req => (
                                    <div key={req.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 flex items-center justify-between opacity-70">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                                                {getRequestIcon(req.entity_type)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-xs text-gray-600 dark:text-gray-300">{req.entity_name}</p>
                                                <span className="text-[10px] text-gray-400">{getRequestLabel(req.entity_type)} • By {req.requester_name} • {timeAgo(req.created_at)}</span>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${req.status === "approved" ? "text-green-600 bg-green-50 dark:bg-green-900/20" : "text-red-600 bg-red-50 dark:bg-red-900/20"}`}>
                                            {req.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
            <ConfirmationModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                variant={confirmConfig.variant}
            />
        </div>
    );
}
