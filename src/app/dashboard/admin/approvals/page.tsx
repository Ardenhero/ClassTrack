import { createClient } from "@/utils/supabase/server";
import { UserCheck, Clock, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { revalidatePath } from "next/cache";

export default async function ApprovalsPage() {
    const supabase = createClient();

    // Fetch all account requests
    const { data: requests } = await supabase
        .from("account_requests")
        .select("*")
        .order("created_at", { ascending: false });

    const pendingRequests = requests?.filter(r => r.status === "pending") || [];
    const reviewedRequests = requests?.filter(r => r.status !== "pending") || [];

    async function approveRequest(formData: FormData) {
        "use server";
        const requestId = formData.get("request_id") as string;
        const supabase = createClient();

        const { error } = await supabase.rpc("approve_account_request", {
            p_request_id: requestId,
        });

        if (error) {
            console.error("Error approving request:", error);
        }
        revalidatePath("/dashboard/admin/approvals");
    }

    async function rejectRequest(formData: FormData) {
        "use server";
        const requestId = formData.get("request_id") as string;
        const supabase = createClient();

        const { error } = await supabase.rpc("reject_account_request", {
            p_request_id: requestId,
        });

        if (error) {
            console.error("Error rejecting request:", error);
        }
        revalidatePath("/dashboard/admin/approvals");
    }

    async function deleteRequest(formData: FormData) {
        "use server";
        const requestId = formData.get("request_id") as string;
        const supabase = createClient();

        const { error } = await supabase.rpc("delete_account_request", {
            p_request_id: requestId,
        });

        if (error) {
            console.error("Error deleting request:", error);
        }
        revalidatePath("/dashboard/admin/approvals");
    }

    return (
        <div className="space-y-8">
            {/* Pending Requests */}
            <div className="bg-white rounded-2xl shadow-md border p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    Pending Requests ({pendingRequests.length})
                </h2>

                {pendingRequests.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No pending requests.</p>
                ) : (
                    <div className="divide-y">
                        {pendingRequests.map((req) => (
                            <div key={req.id} className="flex items-center justify-between py-4">
                                <div className="flex items-center space-x-4">
                                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm">
                                        {req.name?.[0] || req.email?.[0] || "?"}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{req.name || "No name"}</p>
                                        <p className="text-sm text-gray-500">{req.email}</p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(req.created_at).toLocaleDateString("en-US", {
                                                month: "short", day: "numeric", year: "numeric",
                                                hour: "2-digit", minute: "2-digit"
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <form action={approveRequest}>
                                        <input type="hidden" name="request_id" value={req.id} />
                                        <button
                                            type="submit"
                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                                        >
                                            <CheckCircle className="h-4 w-4" />
                                            Approve
                                        </button>
                                    </form>
                                    <form action={rejectRequest}>
                                        <input type="hidden" name="request_id" value={req.id} />
                                        <button
                                            type="submit"
                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                                        >
                                            <XCircle className="h-4 w-4" />
                                            Reject
                                        </button>
                                    </form>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Recently Reviewed */}
            <div className="bg-white rounded-2xl shadow-md border p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-nwu-red" />
                    Recently Reviewed ({reviewedRequests.length})
                </h2>

                {reviewedRequests.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No reviewed requests yet.</p>
                ) : (
                    <div className="divide-y">
                        {reviewedRequests.map((req) => (
                            <div key={req.id} className="flex items-center justify-between py-4">
                                <div className="flex items-center space-x-4">
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                        req.status === "approved"
                                            ? "bg-green-100 text-green-600"
                                            : "bg-red-100 text-red-600"
                                    }`}>
                                        {req.name?.[0] || req.email?.[0] || "?"}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{req.name || "No name"}</p>
                                        <p className="text-sm text-gray-500">{req.email}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                                                req.status === "approved"
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-red-100 text-red-700"
                                            }`}>
                                                {req.status === "approved" ? (
                                                    <><CheckCircle className="h-3 w-3" /> Approved</>
                                                ) : (
                                                    <><XCircle className="h-3 w-3" /> Rejected</>
                                                )}
                                            </span>
                                            {req.reviewed_at && (
                                                <span className="text-xs text-gray-400">
                                                    {new Date(req.reviewed_at).toLocaleDateString("en-US", {
                                                        month: "short", day: "numeric", year: "numeric"
                                                    })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <form action={deleteRequest}>
                                    <input type="hidden" name="request_id" value={req.id} />
                                    <button
                                        type="submit"
                                        className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg"
                                        title="Delete request"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </form>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
