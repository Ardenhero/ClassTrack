"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";
import { Fingerprint, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { PostgrestError } from "@supabase/supabase-js";

interface SlotData {
    slot_id: number;
    student_id?: string;
    student_name?: string;
    status: "occupied" | "empty" | "orphan";
}

export function AdminBiometricMatrix() {
    const { profile } = useProfile();
    const [slots, setSlots] = useState<SlotData[]>([]);
    const [loading, setLoading] = useState(true);

    const loadMatrix = async () => {
        setLoading(true);
        const supabase = createClient();

        try {
            // 1. Get all students with fingerprint_slot_id
            const { data: students, error } = await supabase
                .from("students")
                .select("id, name, fingerprint_slot_id")
                .not("fingerprint_slot_id", "is", null) as { data: { id: string; name: string; fingerprint_slot_id: number }[] | null; error: PostgrestError | null };

            if (error) throw error;

            // 2. Get recent orphan scans from audit logs
            const { data: orphans } = await supabase
                .from("biometric_audit_logs")
                .select("fingerprint_slot_id")
                .eq("event_type", "ORPHAN_SCAN")
                .order("timestamp", { ascending: false })
                .limit(50);

            // 3. Build the 1-127 Matrix
            const matrix: SlotData[] = [];
            const orphanSet = new Set(orphans?.map((l: { fingerprint_slot_id: number }) => l.fingerprint_slot_id));

            for (let i = 1; i <= 127; i++) {
                const student = students?.find(s => s.fingerprint_slot_id === i);

                if (student) {
                    matrix.push({
                        slot_id: i,
                        student_id: student.id,
                        student_name: student.name,
                        status: "occupied"
                    });
                } else if (orphanSet.has(i)) {
                    matrix.push({
                        slot_id: i,
                        status: "orphan"
                    });
                } else {
                    matrix.push({
                        slot_id: i,
                        status: "empty"
                    });
                }
            }
            setSlots(matrix);

        } catch (err) {
            console.error("Failed to load matrix:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (profile?.role === "admin" || profile?.is_super_admin) {
            loadMatrix();
        }
    }, [profile]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Fingerprint className="h-5 w-5 text-nwu-red" />
                        Sensor Memory Map (Slots 1-127)
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <span className="text-green-600 font-bold">Linked</span> • <span className="text-red-500 font-bold">Orphan</span> • <span className="text-gray-400">Empty</span>
                    </p>
                </div>
                <button
                    onClick={loadMatrix}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
            ) : (
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 max-h-[400px] overflow-y-auto pr-2">
                    {slots.map((slot) => (
                        <div
                            key={slot.slot_id}
                            className={`
                                relative p-1.5 rounded border text-center transition-all hover:scale-105 cursor-default
                                ${slot.status === 'occupied'
                                    ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                                    : slot.status === 'orphan'
                                        ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 ring-1 ring-red-500/50'
                                        : 'bg-gray-50 border-gray-100 text-gray-300 dark:bg-gray-800/30 dark:border-gray-700 dark:text-gray-600'
                                }
                            `}
                        >
                            <span className="text-[10px] font-bold block">#{slot.slot_id}</span>

                            {slot.status === 'occupied' && (
                                <div className="text-[9px] leading-tight font-medium truncate w-full" title={slot.student_name}>
                                    {slot.student_name?.split(' ')[0]}
                                </div>
                            )}

                            {slot.status === 'orphan' && (
                                <div className="absolute -top-1 -right-1">
                                    <AlertTriangle className="h-2 w-2 text-red-600 fill-red-100" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30 text-xs text-blue-800 dark:text-blue-300 flex gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p>
                    <strong>Orphan slots</strong> (Red) are IDs stored on the sensor but missing from the database.
                    This happens if a student is deleted from the app but not the device.
                </p>
            </div>
        </div>
    );
}
