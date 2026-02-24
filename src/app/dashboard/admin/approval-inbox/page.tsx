"use client";

import { useState, useEffect } from "react";
import { Inbox, CheckCircle2, XCircle, Clock, Loader2, ArrowRightLeft, ShieldCheck } from "lucide-react";
import { getSINChangeRequests, reviewSINRequest } from "./actions";

interface SINRequest {
    id: string;
    current_sin: string;
    new_sin: string;
    reason: string;
    status: string;
    created_at: string;
    reviewed_at: string | null;
    students: { name: string; sin: string } | null;
    requester: { name: string } | null;
    reviewer: { name: string } | null;
}

export default function ApprovalInboxPage() {
    const [requests, setRequests] = useState<SINRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [filter, setFilter] = useState<"pending" | "all">("pending");

    const loadRequests = async () => {
        setLoading(true);
        const result = await getSINChangeRequests();
        if (result.data) {
            setRequests(result.data as unknown as SINRequest[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const handleReview = async (requestId: string, action: "approved" | "rejected") => {
        setProcessing(requestId);
        const result = await reviewSINRequest(requestId, action);
        if (result.success) {
            loadRequests();
        }
        setProcessing(null);
    };

    const filtered = filter === "pending"
        ? requests.filter(r => r.status === "pending")
        : requests;

    const statusBadge = (status: string) => {
        switch (status) {
            case "approved":
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3" />Approved</span>;
            case "rejected":
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700"><XCircle className="h-3 w-3" />Rejected</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 animate-pulse"><Clock className="h-3 w-3" />Pending</span>;
        }
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Inbox className="h-7 w-7 text-nwu-red" />
                        Approval Inbox
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Review SIN change requests from Department Admins</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter("pending")}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filter === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >
                        Pending ({requests.filter(r => r.status === "pending").length})
                    </button>
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filter === "all" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >
                        All Requests
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
            ) : filtered.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                    <ShieldCheck className="h-12 w-12 text-green-500 mx-auto mb-3 opacity-50" />
                    <p className="text-gray-500 font-medium">
                        {filter === "pending" ? "No pending approvals 🎉" : "No SIN change requests found"}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map((req) => (
                        <div key={req.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="h-10 w-10 rounded-full bg-nwu-red/10 flex items-center justify-center text-nwu-red font-bold text-sm">
                                            {req.students?.name?.[0] || "?"}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{req.students?.name || "Unknown Student"}</p>
                                            <p className="text-xs text-gray-500">Requested by {req.requester?.name || "Unknown"} • {new Date(req.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl px-4 py-3">
                                        <code className="text-sm font-mono text-red-600 bg-red-50 px-2 py-0.5 rounded">{req.current_sin}</code>
                                        <ArrowRightLeft className="h-4 w-4 text-gray-400" />
                                        <code className="text-sm font-mono text-green-600 bg-green-50 px-2 py-0.5 rounded">{req.new_sin}</code>
                                    </div>

                                    {req.reason && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">&ldquo;{req.reason}&rdquo;</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    {statusBadge(req.status)}

                                    {req.status === "pending" && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleReview(req.id, "approved")}
                                                disabled={processing === req.id}
                                                className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                                            >
                                                {processing === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleReview(req.id, "rejected")}
                                                disabled={processing === req.id}
                                                className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                                            >
                                                <XCircle className="h-3 w-3" />
                                                Reject
                                            </button>
                                        </div>
                                    )}

                                    {req.reviewer && req.reviewed_at && (
                                        <p className="text-xs text-gray-400">
                                            by {req.reviewer.name} on {new Date(req.reviewed_at).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
