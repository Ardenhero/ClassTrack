"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";
import { Fingerprint, AlertTriangle, RefreshCw, Loader2, ArrowRightLeft } from "lucide-react";
import { PostgrestError, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface SlotData {
    slot_id: number;
    student_id?: string;
    student_name?: string;
    instructor_id?: string; // Added for isolation check
    status: "occupied" | "empty" | "orphan" | "restricted";
}

export function AdminBiometricMatrix() {
    const { profile } = useProfile();
    const [slots, setSlots] = useState<SlotData[]>([]);
    const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null);
    const [unlinking, setUnlinking] = useState(false);
    const [moveTargetRoom, setMoveTargetRoom] = useState<string>("");
    const [moving, setMoving] = useState(false);

    const loadMatrix = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();

        try {
            // 1. Resolve Account Scope if Admin
            let currentAccountScope = [profile?.id || ""];
            if (profile?.role === 'admin' && profile?.id) {
                const { data: adminRecord } = await supabase
                    .from('instructors')
                    .select('auth_user_id')
                    .eq('id', profile.id)
                    .single();

                if (adminRecord?.auth_user_id) {
                    const { data: accountInstructors } = await supabase
                        .from('instructors')
                        .select('id')
                        .eq('auth_user_id', adminRecord.auth_user_id);
                    currentAccountScope = accountInstructors?.map((inst: { id: string }) => inst.id) || [profile.id];
                }
            }

            // 2. Fetch rooms accessible to this profile
            const { data: roomsData, error: roomsError } = await supabase
                .from("rooms")
                .select("id, name")
                .order("name");

            if (!roomsError && roomsData) {
                setRooms(roomsData);
                // Auto-select first room if none selected
                if (!selectedRoomId && roomsData.length > 0) {
                    setSelectedRoomId(roomsData[0].id);
                }
            }

            const activeRoomId = selectedRoomId || (roomsData?.[0]?.id ?? null);

            // 3. Find the kiosk device for this room (from kiosk_devices table)
            let deviceId: string | null = null;
            if (activeRoomId) {
                const { data: kioskReq } = await supabase
                    .from("kiosk_devices")
                    .select("device_serial")
                    .eq("room_id", activeRoomId)
                    .eq("status", "approved")
                    .maybeSingle();
                if (kioskReq) {
                    deviceId = kioskReq.device_serial;
                }
            }

            // 4. Get students ONLY within my scope
            let studentsQuery = supabase
                .from("students")
                .select("id, name, fingerprint_slot_id, instructor_id")
                .not("fingerprint_slot_id", "is", null)
                .in("instructor_id", currentAccountScope);

            // Scope down to device if one is assigned
            if (deviceId) {
                studentsQuery = studentsQuery.eq("device_id", deviceId);
            }

            const { data: allOccupiedStudents, error } = await studentsQuery as { data: { id: string; name: string; fingerprint_slot_id: number; instructor_id: string }[] | null; error: PostgrestError | null };

            if (error) throw error;

            // 5. Get recent orphan scans from audit logs
            let orphanQuery = supabase
                .from("biometric_audit_logs")
                .select("fingerprint_slot_id")
                .eq("event_type", "ORPHAN_SCAN")
                .contains("metadata", { instructor_id: profile?.id });

            if (deviceId) {
                orphanQuery = orphanQuery.eq("device_id", deviceId);
            }

            const { data: orphans } = await orphanQuery
                .order("timestamp", { ascending: false })
                .limit(50);

            // 4. Build the 1-127 Matrix
            const matrix: SlotData[] = [];
            const orphanSet = new Set(orphans?.map((l: { fingerprint_slot_id: number }) => l.fingerprint_slot_id));

            for (let i = 1; i <= 127; i++) {
                const student = allOccupiedStudents?.find(s => s.fingerprint_slot_id === i);

                if (student) {
                    const isMine = currentAccountScope.includes(student.instructor_id);
                    matrix.push({
                        slot_id: i,
                        student_id: isMine ? student.id : undefined,
                        student_name: isMine ? student.name : "Restricted",
                        instructor_id: student.instructor_id,
                        status: isMine ? "occupied" : "restricted"
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
    }, [profile, selectedRoomId]);

    const unlinkSlot = async (slot: SlotData) => {
        if (!slot.student_id || !confirm(`Are you sure you want to unlink ${slot.student_name}? This will remove their fingerprint association from the database.`)) return;

        setUnlinking(true);
        const supabase = createClient();

        try {
            const { error } = await supabase
                .from("students")
                .update({ fingerprint_slot_id: null })
                .eq("id", slot.student_id);

            if (error) throw error;

            // Optimistic update will be handled by realtime subscription, but we can also reload
            // loadMatrix(); // Let realtime handle it? Or explicit reload to be safe.
            // Explicit reload is safer for now until realtime checks out
            await loadMatrix();
            setSelectedSlot(null); // Deselect after unlink

        } catch (err) {
            console.error("Failed to unlink slot:", err);
            alert("Failed to unlink fingerprint. Please try again.");
        } finally {
            setUnlinking(false);
        }
    };

    const moveSlotToRoom = async (slot: SlotData) => {
        if (!slot.student_id || !moveTargetRoom) return;
        if (!confirm(`Move ${slot.student_name}'s fingerprint to the selected room? The fingerprint template will be reassigned to that room's kiosk.`)) return;

        setMoving(true);
        const supabase = createClient();

        try {
            // Find the kiosk device_serial for the target room
            const { data: targetKiosk } = await supabase
                .from("kiosk_devices")
                .select("device_serial")
                .eq("room_id", moveTargetRoom)
                .eq("status", "approved")
                .maybeSingle();

            if (!targetKiosk) {
                alert("Target room has no approved kiosk bound. Please bind a kiosk first.");
                return;
            }

            const { error } = await supabase
                .from("students")
                .update({ device_id: targetKiosk.device_serial })
                .eq("id", slot.student_id);

            if (error) throw error;

            setMoveTargetRoom("");
            await loadMatrix();
            setSelectedSlot(null);
        } catch (err) {
            console.error("Failed to move fingerprint:", err);
            alert("Failed to move fingerprint template. Please try again.");
        } finally {
            setMoving(false);
        }
    };

    useEffect(() => {
        if (selectedSlot) {
            const updatedSlot = slots.find(s => s.slot_id === selectedSlot.slot_id);
            if (updatedSlot && (updatedSlot.status !== selectedSlot.status || updatedSlot.student_id !== selectedSlot.student_id)) {
                setSelectedSlot(updatedSlot);
            }
        }
    }, [slots, selectedSlot]);

    useEffect(() => {
        if (profile?.role === "admin" || profile?.is_super_admin) {
            loadMatrix();

            // Real-time Subscription
            const supabase = createClient();
            const channel = supabase
                .channel('biometric-matrix-updates')
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'students' },
                    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
                        console.log("Realtime: Student update/unlink detected", payload);
                        loadMatrix();
                    }
                )
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'biometric_audit_logs', filter: `event_type=eq.ORPHAN_SCAN` },
                    (payload: RealtimePostgresChangesPayload<{ metadata: { instructor_id?: string } }>) => {
                        console.log("Realtime: Orphan scan detected", payload);
                        // Only reload if the orphan scan belongs to THIS instructor
                        const newRecord = payload.new as { metadata?: { instructor_id?: string } };
                        if (newRecord?.metadata?.instructor_id === profile?.id) {
                            loadMatrix();
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [profile, loadMatrix]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 flex flex-col h-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Fingerprint className="h-5 w-5 text-nwu-red" />
                        Sensor Memory Map
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="text-green-600 font-bold">Linked</span> • <span className="text-red-500 font-bold">Orphan</span> • <span className="text-gray-400">Empty</span>
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <select
                        className="flex-1 md:w-48 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                        value={selectedRoomId}
                        onChange={(e) => setSelectedRoomId(e.target.value)}
                        disabled={loading || rooms.length === 0}
                    >
                        {rooms.length === 0 ? (
                            <option value="">No Rooms Available</option>
                        ) : (
                            rooms.map(room => (
                                <option key={room.id} value={room.id}>{room.name}</option>
                            ))
                        )}
                    </select>

                    <button
                        onClick={loadMatrix}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {loading && slots.length === 0 ? (
                <div className="flex-1 flex items-center justify-center min-h-[200px]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
                <>
                    <div className="grid grid-cols-8 gap-1.5 max-h-[300px] overflow-y-auto pr-1 mb-4">
                        {slots.map((slot) => (
                            <button
                                key={slot.slot_id}
                                onClick={() => setSelectedSlot(slot)}
                                className={`
                                    relative p-1 rounded border text-center transition-all hover:scale-110 focus:ring-2 focus:ring-offset-1 focus:outline-none
                                    ${selectedSlot?.slot_id === slot.slot_id ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : ''}
                                    ${slot.status === 'occupied'
                                        ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                                        : slot.status === 'orphan'
                                            ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 ring-1 ring-red-500/50'
                                            : slot.status === 'restricted'
                                                ? 'bg-gray-200 border-gray-300 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 cursor-not-allowed'
                                                : 'bg-gray-50 border-gray-100 text-gray-300 dark:bg-gray-800/30 dark:border-gray-700 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }
                                `}
                                title={slot.status === 'occupied' ? slot.student_name : `Slot ${slot.slot_id}: ${slot.status}`}
                            >
                                <span className="text-[9px] font-bold block">#{slot.slot_id}</span>
                                {slot.status === 'orphan' && (
                                    <div className="absolute -top-1 -right-1">
                                        <AlertTriangle className="h-2 w-2 text-red-600 fill-red-100" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Selected Slot Details */}
                    <div className="mt-auto border-t border-gray-100 dark:border-gray-700 pt-4">
                        {selectedSlot ? (
                            <div className="text-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        Slot #{selectedSlot.slot_id}
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider ${selectedSlot.status === 'occupied' ? 'bg-green-100 text-green-800' :
                                            selectedSlot.status === 'orphan' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {selectedSlot.status}
                                        </span>
                                    </span>

                                    {selectedSlot.status === 'occupied' && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => unlinkSlot(selectedSlot)}
                                                disabled={unlinking}
                                                className="text-xs text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
                                            >
                                                {unlinking ? 'Unlinking...' : 'Unlink'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {selectedSlot.status === 'occupied' ? (
                                    <div className="space-y-1">
                                        <p className="text-gray-600 dark:text-gray-300 truncate">
                                            <span className="font-medium text-gray-500 text-xs uppercase block">Student</span>
                                            {selectedSlot.student_name}
                                        </p>
                                        <p className="text-xs text-gray-400 font-mono truncate">{selectedSlot.student_id}</p>
                                    </div>
                                ) : selectedSlot.status === 'orphan' ? (
                                    <p className="text-red-600 text-xs">
                                        Fingerprint exists on device but no student is linked.
                                    </p>
                                ) : selectedSlot.status === 'restricted' ? (
                                    <p className="text-gray-500 text-xs italic">
                                        This slot is occupied by another instructor&apos;s student.
                                    </p>
                                ) : (
                                    <p className="text-gray-400 text-xs italic">Empty slot available for enrollment.</p>
                                )}

                                {/* Move to Room — fingerprint template reassignment */}
                                {selectedSlot.status === 'occupied' && rooms.length > 1 && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 flex items-center gap-1">
                                            <ArrowRightLeft className="h-3 w-3" /> Move to Another Room
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={moveTargetRoom}
                                                onChange={(e) => setMoveTargetRoom(e.target.value)}
                                                className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent focus:border-nwu-red outline-none text-gray-900 dark:text-white"
                                            >
                                                <option value="">Select room...</option>
                                                {rooms.filter(r => r.id !== selectedRoomId).map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => moveSlotToRoom(selectedSlot)}
                                                disabled={!moveTargetRoom || moving}
                                                className="px-3 py-1.5 text-xs font-bold bg-blue-500/10 text-blue-600 rounded-lg hover:bg-blue-500/20 transition border border-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {moving ? 'Moving...' : 'Move'}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1">Reassigns the fingerprint template to the target room&apos;s kiosk without re-enrolling.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-xs text-center py-2 italic">
                                Select a slot to view details
                            </p>
                        )}
                    </div>
                </>
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
