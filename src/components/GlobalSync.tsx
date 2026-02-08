"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { RefreshCw } from "lucide-react";
import { cn } from "@/utils/cn";

export function GlobalSync() {
    const router = useRouter();
    const [isSyncing, setIsSyncing] = useState(false);
    const supabase = createClient();

    // Debounced Refresh Logic
    const triggerRefresh = useCallback(() => {
        setIsSyncing(true);
        console.log("🔄 Global Sync: Change detected, refreshing...");

        // Wait 1s before actual refresh (Debounce + Visual Feedback)
        setTimeout(() => {
            router.refresh();
            // Keep spinning a bit longer for "feel"
            setTimeout(() => setIsSyncing(false), 1000);
        }, 1000);
    }, [router]);

    // Manual Refresh Handler
    const handleManualRefresh = () => {
        if (isSyncing) return;
        triggerRefresh();
    };

    // Real-time Listener
    useEffect(() => {
        const channel = supabase
            .channel('global-db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public', // Listen to EVERYTHING in public schema
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (payload: any) => {
                    console.log("Change received!", payload);
                    triggerRefresh();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, triggerRefresh]);

    return (
        <button
            onClick={handleManualRefresh}
            className={cn(
                "fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition-all duration-300",
                "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
                "hover:scale-110 active:scale-95",
                isSyncing ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
            )}
            title="Global Sync Status (Click to Refresh)"
        >
            <RefreshCw className={cn("h-6 w-6", isSyncing && "animate-spin")} />
        </button>
    );
}
