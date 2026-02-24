"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Loader2, AlertCircle, CheckCircle, XCircle, Users, BookOpen } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { permanentlyDeleteStudent } from "@/app/students/actions";
import { permanentlyDeleteClass } from "@/app/classes/actions";

interface DeletionRequest {
    id: string;
    entity_type: "student" | "class";
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

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from("deletion_requests")
            .select("*")
            .order("created_at", { ascending: false });

        if (data) {
            // Fetch requester names
            const enriched = await Promise.all(
                data.map(async (req: DeletionRequest) => {
                    const { data: instructor } = await supabase
                        .from("instructors")
                        .select("name")
                        .eq("id", req.requested_by)
                        .single();
                    return { ...req, requester_name: instructor?.name || "Unknown" };
                })
            );
            setRequests(enriched);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const handleApprove = async (req: DeletionRequest) => {
        if (!confirm(`Permanently delete ${req.entity_type} "${req.entity_name}"? This CANNOT be undone.`)) return;
        setActionLoading(`approve-${req.id}`);

        // Execute permanent deletion
        if (req.entity_type === "student") {
            await permanentlyDeleteStudent(req.entity_id);
        } else {
            await permanentlyDeleteClass(req.entity_id);
        }

        // Update request status
        await supabase.from("deletion_requests").update({
            status: "approved",
            reviewed_at: new Date().toISOString(),
        }).eq("id", req.id);

        setActionLoading(null);
        fetchRequests();
    };

    const handleReject = async (req: DeletionRequest) => {
        setActionLoading(`reject-${req.id}`);

        await supabase.from("deletion_requests").update({
            status: "rejected",
            reviewed_at: new Date().toISOString(),
        }).eq("id", req.id);

        // Audit log
        await supabase.from("audit_logs").insert({
            action: "deletion_request_rejected",
            entity_type: req.entity_type,
            entity_id: req.entity_id,
            details: `Rejected deletion request for ${req.entity_type} "${req.entity_name}" by ${req.requester_name}`,
            performed_by: null,
        });

        setActionLoading(null);
        fetchRequests();
    };

    const pendingRequests = requests.filter(r => r.status === "pending");
    const resolvedRequests = requests.filter(r => r.status !== "pending");

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 1) return "Just now";
        if (hours < 24) return `${hours}h ago`;
        if (days === 1) return "Yesterday";
        return `${days} days ago`;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-red-500" />
                    Deletion Requests
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Review and approve or reject permanent deletion requests from instructors.
                </p>
            </div>

            {loading ? (
                <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
            ) : pendingRequests.length === 0 && resolvedRequests.length === 0 ? (
                <div className="p-12 text-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No deletion requests yet.
                </div>
            ) : (
                <>
                    {/* Pending Requests */}
                    {pendingRequests.length > 0 && (
                        <div>
                            <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Pending ({pendingRequests.length})
                            </div>
                            <div className="space-y-3">
                                {pendingRequests.map(req => (
                                    <div key={req.id} className="bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${req.entity_type === "student" ? "bg-blue-50 text-blue-500 dark:bg-blue-900/20" : "bg-purple-50 text-purple-500 dark:bg-purple-900/20"}`}>
                                                {req.entity_type === "student" ? <Users className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900 dark:text-white">{req.entity_name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{req.entity_type}</span>
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
                                                {actionLoading === `approve-${req.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} Approve & Delete
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
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                                History ({resolvedRequests.length})
                            </div>
                            <div className="space-y-2">
                                {resolvedRequests.slice(0, 10).map(req => (
                                    <div key={req.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 flex items-center justify-between opacity-70">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                                {req.entity_type === "student" ? <Users className="h-4 w-4 text-gray-400" /> : <BookOpen className="h-4 w-4 text-gray-400" />}
                                            </div>
                                            <div>
                                                <p className="font-medium text-xs text-gray-600 dark:text-gray-300">{req.entity_name}</p>
                                                <span className="text-[10px] text-gray-400">By {req.requester_name} • {timeAgo(req.created_at)}</span>
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
        </div>
    );
}
