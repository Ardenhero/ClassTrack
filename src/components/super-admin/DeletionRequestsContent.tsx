"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Trash2, User, BookOpen, UserMinus, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { approveDeletionRequest, rejectDeletionRequest } from "@/app/dashboard/admin/provisioning/actions";
import { useRouter } from "next/navigation";

interface DeletionRequest {
    id: string;
    entity_type: "student" | "class" | "account_deletion";
    entity_id: string;
    entity_name: string;
    requested_by: string;
    reason: string | null;
    status: "pending" | "approved" | "rejected";
    created_at: string;
    instructors: {
        name: string;
        departments: {
            name: string;
            code: string;
        } | null;
    } | null;
}

interface Props {
    initialRequests: DeletionRequest[];
}

export default function DeletionRequestsContent({ initialRequests }: Props) {
    const [requests, setRequests] = useState(initialRequests);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const router = useRouter();

    const handleApprove = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to APPROVE the deletion of "${name}"? This action is permanent.`)) return;
        
        setProcessingId(id);
        try {
            await approveDeletionRequest(id);
            alert("Deletion request approved and executed.");
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
            router.refresh();
        } catch (error: any) {
            alert(error.message || "Failed to approve request");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string) => {
        setProcessingId(id);
        try {
            await rejectDeletionRequest(id);
            alert("Deletion request rejected.");
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
            router.refresh();
        } catch (error: any) {
            alert(error.message || "Failed to reject request");
        } finally {
            setProcessingId(null);
        }
    };

    const getEntityIcon = (type: string) => {
        switch (type) {
            case 'student': return <User className="h-4 w-4" />;
            case 'class': return <BookOpen className="h-4 w-4" />;
            case 'account_deletion': return <UserMinus className="h-4 w-4" />;
            default: return <Trash2 className="h-4 w-4" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"><Clock className="h-3 w-3 mr-1" /> Pending</span>;
            case 'approved':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" /> Approved</span>;
            case 'rejected':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"><XCircle className="h-3 w-3 mr-1" /> Rejected</span>;
            default:
                return null;
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entity</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Requested By</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reason</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {requests.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 italic">
                                    No deletion requests found.
                                </td>
                            </tr>
                        ) : (
                            requests.map((request) => (
                                <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className={`p-2 rounded-lg mr-3 ${
                                                request.entity_type === 'account_deletion' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                                                request.entity_type === 'student' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                                                'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                                            }`}>
                                                {getEntityIcon(request.entity_type)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">{request.entity_name}</div>
                                                <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black">{request.entity_type.replace('_', ' ')}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 dark:text-white font-medium">{request.instructors?.name || "Unknown"}</div>
                                        <div className="text-xs text-gray-500">{request.instructors?.departments?.code || "No Dept"}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title={request.reason || ""}>
                                            {request.reason || <span className="text-gray-400 italic">No reason provided</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {format(new Date(request.created_at), "MMM d, yyyy")}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(request.status)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {request.status === 'pending' ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleReject(request.id)}
                                                    disabled={processingId === request.id}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Reject Request"
                                                >
                                                    <XCircle className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(request.id, request.entity_name)}
                                                    disabled={processingId === request.id}
                                                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                    title="Approve & Delete"
                                                >
                                                    <CheckCircle className="h-5 w-5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">Processed</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    <AlertCircle className="h-3 w-3" />
                    Security Notice:
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Approving a request will PERMANENTLY remove the corresponding data from the production database. This action cannot be undone.
                </p>
            </div>
        </div>
    );
}
