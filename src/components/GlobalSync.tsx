"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { RefreshCw } from "lucide-react";
import { cn } from "@/utils/cn";
import { mutate } from "swr";
import { postMultiSyncEvent, onSyncEvent } from "@/lib/globalSyncChannel";

// SWR keys that GlobalSync should invalidate on realtime events
const SYNC_SWR_KEYS = [
    "/api/students",
    "/api/iot/control",
    "/api/iot/status",
    "/api/notifications/poll",
];

export function GlobalSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const supabase = createClient();

    // Throttled SWR Invalidation — replaces router.refresh()
    const triggerSync = useCallback(() => {
        setIsSyncing(true);
        console.log("🔄 Global Sync: Change detected, invalidating SWR keys...");

        // Invalidate all known SWR keys (targeted, not full page reload)
        SYNC_SWR_KEYS.forEach(key => mutate(key));

        // Broadcast to other tabs for cross-tab sync
        postMultiSyncEvent(SYNC_SWR_KEYS);

        // Keep spinning briefly for visual feedback
        setTimeout(() => setIsSyncing(false), 1000);
    }, []);

    // Manual Refresh Handler
    const handleManualRefresh = () => {
        if (isSyncing) return;
        triggerSync();
    };

    // Listen for cross-tab sync events from other tabs
    useEffect(() => {
        const cleanup = onSyncEvent((swrKey) => {
            mutate(swrKey);
        });
        return cleanup;
    }, []);

    // Real-time Listener — invalidates SWR instead of router.refresh()
    useEffect(() => {
        const channel = supabase
            .channel('global-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => triggerSync())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => triggerSync())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () => triggerSync())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => triggerSync())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => triggerSync())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, triggerSync]);

    return (
        <button
            onClick={handleManualRefresh}
            className={cn(
                "fixed bottom-[5.5rem] sm:bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition-all duration-300",
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
