"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
// DashboardLayout is provided by parent admin/layout.tsx — do NOT wrap again
import { Mail, Loader2, CheckCircle, XCircle, Clock, Eye, Calendar } from "lucide-react";

interface EvidenceItem {
    id: string;
    file_name: string;
    file_url: string;
    file_type: string;
    description: string | null;
    status: string;
    created_at: string;
    students: { name: string; sin: string; year_level: string } | null;
    evidence_date_links: { absence_date: string }[];
}

export default function EvidenceQueuePage() {
    const supabase = createClient();
    const [items, setItems] = useState<EvidenceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"pending" | "all">("pending");
    const [processing, setProcessing] = useState<string | null>(null);

    const loadItems = async () => {
        setLoading(true);
        let query = supabase
            .from("evidence_documents")
            .select("id, file_name, file_url, file_type, description, status, created_at, students(name, sin, year_level), evidence_date_links(absence_date)")
            .order("created_at", { ascending: false });

        if (filter === "pending") {
            query = query.eq("status", "pending");
        }

        const { data } = await query;
        if (data) setItems(data as unknown as EvidenceItem[]);
        setLoading(false);
    };

    useEffect(() => {
        loadItems();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    const handleReview = async (evidenceId: string, action: "approve" | "reject") => {
        setProcessing(evidenceId);
        try {
            const res = await fetch("/api/evidence/review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ evidence_id: evidenceId, action }),
            });
            if (res.ok) {
                loadItems();
            }
        } catch (err) {
            console.error("Review error:", err);
        } finally {
            setProcessing(null);
        }
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case "approved":
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3" />Approved</span>;
            case "rejected":
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><XCircle className="h-3 w-3" />Rejected</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"><Clock className="h-3 w-3" />Pending</span>;
        }
    };

    return (
        <>
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Mail className="h-7 w-7 text-nwu-red" />
                        Mail Inbox
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Review and approve submitted medical certificates and excuse letters</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter("pending")}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filter === "pending" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200"}`}
                    >
                        Pending Mails
                    </button>
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filter === "all" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200"}`}
                    >
                        All Mails
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
            ) : items.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-400">
                    {filter === "pending" ? "No pending mails to review 🎉" : "No mail submissions found"}
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Document</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Linked Dates</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {items.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-nwu-red/10 flex items-center justify-center text-nwu-red font-bold text-xs ring-1 ring-nwu-red/20">
                                                {item.students?.name?.[0] || "?"}
                                            </div>
                                            <div className="ml-3">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{item.students?.name || "Unknown"}</div>
                                                <div className="text-xs text-gray-500">{item.students?.sin} • {item.students?.year_level}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                            <Eye className="h-3.5 w-3.5" />
                                            {item.file_name}
                                        </a>
                                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {item.evidence_date_links?.map((l) => (
                                                <span key={l.absence_date} className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                                                    <Calendar className="h-2.5 w-2.5" />
                                                    {l.absence_date}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{statusBadge(item.status)}</td>
                                    <td className="px-6 py-4">
                                        {item.status === "pending" && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleReview(item.id, "approve")}
                                                    disabled={processing === item.id}
                                                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                                                >
                                                    {processing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleReview(item.id, "reject")}
                                                    disabled={processing === item.id}
                                                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                                                >
                                                    <XCircle className="h-3 w-3" />
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
