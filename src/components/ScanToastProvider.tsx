"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Fingerprint, X } from "lucide-react";

interface ScanToast {
    id: string;
    studentName: string;
    className: string;
    status: string;
    time: string;
}

function getStatusColor(status: string): string {
    switch (status) {
        case "Present": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
        case "Late": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
        case "Absent": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
        default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
    }
}

/**
 * Global scan notification provider.
 * Uses polling (every 5s) to detect new attendance_logs inserts.
 * Also listens for CustomEvent from LiveAttendanceTable for instant feedback.
 * Shows floating toast notifications at the top-right of any page.
 */
export default function ScanToastProvider() {
    const [toasts, setToasts] = useState<ScanToast[]>([]);
    const lastSeenIdRef = useRef<string | null>(null);
    const seenIdsRef = useRef<Set<string>>(new Set());

    const addToast = useCallback((detail: Omit<ScanToast, 'id'>) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts(prev => [{ ...detail, id }, ...prev].slice(0, 5));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    // Listen for CustomEvent from LiveAttendanceTable (instant on attendance page)
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail) {
                // Mark this as seen so polling doesn't duplicate
                if (detail.recordId) seenIdsRef.current.add(detail.recordId);
                addToast(detail);
            }
        };
        window.addEventListener('classtrack:scan', handler);
        return () => window.removeEventListener('classtrack:scan', handler);
    }, [addToast]);

    // Polling-based notification (works without Supabase Realtime enabled)
    useEffect(() => {
        const supabase = createClient();
        let mounted = true;

        // Get the latest attendance log ID to establish baseline
        const initialize = async () => {
            const { data } = await supabase
                .from("attendance_logs")
                .select("id")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) lastSeenIdRef.current = data.id;
        };

        const poll = async () => {
            if (!mounted || !lastSeenIdRef.current) return;

            const { data: newLogs } = await supabase
                .from("attendance_logs")
                .select(`
                    id, status, timestamp, created_at,
                    classes ( name ),
                    students ( name )
                `)
                .gt("id", lastSeenIdRef.current)
                .order("created_at", { ascending: true })
                .limit(5);

            if (!newLogs || newLogs.length === 0) return;

            for (const log of newLogs) {
                // Skip if already seen via CustomEvent
                if (seenIdsRef.current.has(log.id)) continue;
                seenIdsRef.current.add(log.id);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const f = log as any;
                const studentName = f.students?.name || "Unknown";
                const className = f.classes?.name || "Unknown";
                const status = f.status || "Present";
                const time = new Date(f.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila'
                });

                addToast({ studentName, className, status, time });
            }

            // Update last seen to the newest
            lastSeenIdRef.current = newLogs[newLogs.length - 1].id;
        };

        initialize().then(() => {
            // Start polling every 5 seconds
            const interval = setInterval(poll, 5000);
            return () => clearInterval(interval);
        });

        return () => { mounted = false; };
    }, [addToast]);

    // Keep seenIds from growing too large
    useEffect(() => {
        const cleanup = setInterval(() => {
            if (seenIdsRef.current.size > 100) {
                seenIdsRef.current = new Set(Array.from(seenIdsRef.current).slice(-50));
            }
        }, 60000);
        return () => clearInterval(cleanup);
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '360px' }}>
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="pointer-events-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-3 flex items-start gap-3 animate-in slide-in-from-right-5 duration-300"
                >
                    <div className="flex-shrink-0 h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Fingerprint className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{toast.studentName}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getStatusColor(toast.status)}`}>{toast.status}</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {toast.className} · {toast.time}
                        </div>
                    </div>
                    <button
                        onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                        className="flex-shrink-0 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            ))}
        </div>
    );
}
