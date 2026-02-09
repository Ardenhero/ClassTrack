import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Clock, LogOut } from "lucide-react";
import Link from "next/link";

export default async function PendingApprovalPage() {
    const supabase = createClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        redirect("/login");
    }

    // Check if user has been approved (has instructor profile)
    const { data: instructor } = await supabase
        .from("instructors")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

    // If approved, redirect to home
    if (instructor) {
        redirect("/");
    }

    // Check request status
    const { data: request } = await supabase
        .from("account_requests")
        .select("status, created_at")
        .eq("user_id", user.id)
        .maybeSingle();

    const isRejected = request?.status === "rejected";

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                {isRejected ? (
                    <>
                        <div className="h-16 w-16 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                            <Clock className="h-8 w-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Account Request Rejected
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Unfortunately, your account request has been declined. Please contact the administrator for more information.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="h-16 w-16 mx-auto mb-6 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Pending Approval
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Your account is awaiting administrator approval. You&apos;ll be able to access the system once approved.
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                            Requested: {request?.created_at ? new Date(request.created_at).toLocaleDateString() : "Just now"}
                        </p>
                    </>
                )}

                <form action="/api/auth/signout" method="POST">
                    <button
                        type="submit"
                        className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                    </button>
                </form>

                <Link 
                    href="/" 
                    className="mt-4 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                    Check status again
                </Link>
            </div>
        </div>
    );
}
