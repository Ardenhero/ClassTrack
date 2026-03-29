"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseSmartPollingOptions {
    /** Whether polling is enabled (default: true) */
    enabled?: boolean;
}

/**
 * useSmartPolling — Visibility API–aware polling hook.
 *
 * Replaces raw `setInterval` with a hook that:
 * 1. Stops 100% when the tab is hidden (Visibility API).
 * 2. Resumes immediately when the tab becomes visible again.
 * 3. Cleans up on unmount.
 *
 * @param callback  The async/sync function to call on each tick.
 * @param intervalMs  Polling interval in milliseconds.
 * @param options  Optional config: { enabled }.
 */
export function useSmartPolling(
    callback: () => void | Promise<void>,
    intervalMs: number,
    options: UseSmartPollingOptions = {}
) {
    const { enabled = true } = options;
    const [isPolling, setIsPolling] = useState(false);
    const [lastPollAt, setLastPollAt] = useState<Date | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const callbackRef = useRef(callback);

    // Always keep the latest callback ref up to date
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const startPolling = useCallback(() => {
        if (intervalRef.current) return; // Already running
        setIsPolling(true);

        // Run immediately on resume
        const run = async () => {
            try {
                await callbackRef.current();
            } catch (e) {
                console.error("[useSmartPolling] Poll error:", e);
            }
            setLastPollAt(new Date());
        };

        run(); // Immediate first tick on start/resume
        intervalRef.current = setInterval(run, intervalMs);
    }, [intervalMs]);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsPolling(false);
    }, []);

    useEffect(() => {
        if (!enabled) {
            stopPolling();
            return;
        }

        // Only start if tab is currently visible
        if (document.visibilityState === "visible") {
            startPolling();
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                startPolling();
            } else {
                stopPolling();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            stopPolling();
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [enabled, startPolling, stopPolling]);

    return { isPolling, lastPollAt };
}
