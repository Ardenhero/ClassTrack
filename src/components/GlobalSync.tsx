"use client";

import { useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
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
    const supabase = createClient();

    // Throttled SWR Invalidation — replaces router.refresh()
    const triggerSync = useCallback(() => {
        console.log("🔄 Global Sync: Change detected, invalidating SWR keys...");

        // Invalidate all known SWR keys (targeted, not full page reload)
        SYNC_SWR_KEYS.forEach(key => mutate(key));

        // Broadcast to other tabs for cross-tab sync
        postMultiSyncEvent(SYNC_SWR_KEYS);
    }, []);

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

    // The background logic stays active to keep data fresh, but we hide the redundant button
    return null;
}
