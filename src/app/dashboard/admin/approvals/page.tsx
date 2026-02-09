import { createClient } from "@/utils/supabase/server";
import { UserCheck, Clock, CheckCircle, XCircle } from "lucide-react";
import { ApprovalButton } from "./ApprovalButton";

export default async function ApprovalsPage() {
    const supabase = createClient();

    // Fetch all account requests
    const { data: requests } = await supabase
        .from("account_requests")
        .select(`
            id,
            email,
            name,
            status,
            created_at,
            reviewed_at,
            departments (
                name,
                code
            )
        `)
        .order("created_at", { ascending: false });

    const pendingRequests = requests?.filter(r => r.status === "pending") || [];
    const reviewedRequests = requests?.filter(r => r.status !== "pending") || [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                    <UserCheck className="mr-2 h-6 w-6 text-nwu-red" />
                    Account Approvals
                </h2>
            </div>

            {/* Pending Requests */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-amber-500" />
                        Pending Requests ({pendingRequests.length})
                    </h3>
                </div>
                
                {pendingRequests.length === 0 ? (
                    <div className="px-6 py-8 text-center text-gray-500 italic">
                        No pending requests
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {pendingRequests.map((req) => (
                            <div key={req.id} className="px-6 py-4 flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{req.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{req.email}</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Requested: {new Date(req.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <ApprovalButton requestId={req.id} action="approve" />
                                    <ApprovalButton requestId={req.id} action="reject" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Reviewed Requests */}
            {reviewedRequests.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-900 dark:text-white">
                            Recently Reviewed
                        </h3>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {reviewedRequests.slice(0, 10).map((req) => (
                            <div key={req.id} className="px-6 py-3 flex items-center justify-between">
                                <div className="flex items-center">
                                    {req.status === "approved" ? (
                                        <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-red-500 mr-3" />
                                    )}
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{req.name}</p>
                                        <p className="text-xs text-gray-400">{req.email}</p>
                                    </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                    req.status === "approved" 
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }`}>
                                    {req.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
