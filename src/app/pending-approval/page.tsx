"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Clock, LogOut } from "lucide-react";

export default function PendingApprovalPage() {
    const supabase = createClient();
    const router = useRouter();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        // Clear profile cookie
        document.cookie = "sc_profile_id=; path=/; max-age=0";
        router.push("/login");
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
            <div className="max-w-md w-full text-center space-y-8">
                <div className="flex justify-center">
                    <div className="h-20 w-20 rounded-full bg-nwu-gold/20 flex items-center justify-center">
                        <Clock className="h-10 w-10 text-nwu-gold" />
                    </div>
                </div>

                <div>
                    <h1 className="text-3xl font-bold mb-3">Account Pending Approval</h1>
                    <p className="text-gray-400 text-lg">
                        Your account has been created and is waiting for administrator approval.
                        You&apos;ll be able to access the system once approved.
                    </p>
                </div>

                <button
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-nwu-red text-white rounded-lg font-medium hover:bg-[#5e0d0e] transition-colors"
                >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
