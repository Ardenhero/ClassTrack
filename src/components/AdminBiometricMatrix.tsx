"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";
import { Fingerprint, AlertTriangle, RefreshCw, Loader2, Copy } from "lucide-react";
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

            // If no kiosk is bound to this room, show empty matrix
            if (!deviceId) {
                const emptyMatrix: SlotData[] = [];
                for (let i = 1; i <= 127; i++) {
                    emptyMatrix.push({ slot_id: i, status: "empty" });
                }
                setSlots(emptyMatrix);
                setLoading(false);
                return;
            }

            // 4. Get students ONLY within my scope AND on this specific device
            // Check both students.device_id (primary) and fingerprint_device_links (copies)
            const { data: primaryStudents, error } = await supabase
                .from("students")
                .select("id, name, fingerprint_slot_id, instructor_id")
                .not("fingerprint_slot_id", "is", null)
                .in("instructor_id", currentAccountScope)
                .eq("device_id", deviceId) as { data: { id: string; name: string; fingerprint_slot_id: number; instructor_id: string }[] | null; error: PostgrestError | null };

            if (error) throw error;

            // Also fetch students linked via fingerprint_device_links (copies)
            const { data: linkedStudents } = await supabase
                .from("fingerprint_device_links")
                .select("student_id, fingerprint_slot_id, students!inner(id, name, instructor_id)")
                .eq("device_serial", deviceId);

            // Merge: build a combined list, deduplicating by student id
            const studentMap = new Map<string, { id: string; name: string; fingerprint_slot_id: number; instructor_id: string }>();
            primaryStudents?.forEach(s => studentMap.set(s.id, s));
            linkedStudents?.forEach((link: { student_id: number; fingerprint_slot_id: number; students: { id: string; name: string; instructor_id: string } }) => {
                const s = link.students;
                if (s && currentAccountScope.includes(s.instructor_id) && !studentMap.has(s.id)) {
                    studentMap.set(s.id, { id: s.id, name: s.name, fingerprint_slot_id: link.fingerprint_slot_id, instructor_id: s.instructor_id });
                }
            });
            const allOccupiedStudents = Array.from(studentMap.values());

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

    const copySlotToRoom = async (slot: SlotData) => {
        if (!slot.student_id || !moveTargetRoom) return;
        if (!confirm(`Copy ${slot.student_name}'s fingerprint template to the selected room? The original assignment will be kept.`)) return;

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

            // Insert a copy link (not move — keeps original device_id intact)
            const { error } = await supabase
                .from("fingerprint_device_links")
                .upsert({
                    student_id: slot.student_id,
                    device_serial: targetKiosk.device_serial,
                    fingerprint_slot_id: slot.slot_id,
                }, { onConflict: 'student_id,device_serial' });

            if (error) throw error;

            setMoveTargetRoom("");
            alert(`✓ Fingerprint template copied to the selected room's kiosk.`);
        } catch (err) {
            console.error("Failed to copy fingerprint:", err);
            alert("Failed to copy fingerprint template. Please try again.");
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
        <div className="glass-card rounded-3xl p-8 flex flex-col h-full shadow-[0_0_40px_rgba(0,0,0,0.5)] border-t border-t-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-nu-500/5 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none group-hover:bg-nu-500/10 transition-colors duration-700"></div>
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Fingerprint className="h-5 w-5 text-nu-400" />
                            Sensor Memory Map
                        </h2>
                        <p className="text-xs text-gray-400 mt-1">
                            <span className="text-nu-400 font-bold drop-shadow-[0_0_5px_rgba(176,42,42,0.8)]">Linked</span> • <span className="text-red-400 font-bold drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]">Orphan</span> • <span className="text-gray-500">Empty</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <select
                            className="flex-1 md:w-48 px-4 py-2 bg-dark-bg border border-white/10 rounded-xl text-white text-sm focus:ring-1 focus:ring-nu-500/50 focus:border-nu-400 shadow-inner appearance-none transition-colors"
                            value={selectedRoomId}
                            onChange={(e) => setSelectedRoomId(e.target.value)}
                            disabled={loading || rooms.length === 0}
                        >
                            {rooms.length === 0 ? (
                                <option value="" className="bg-dark-surface text-gray-300">No Rooms Available</option>
                            ) : (
                                rooms.map(room => (
                                    <option key={room.id} value={room.id} className="bg-dark-surface text-gray-300">{room.name}</option>
                                ))
                            )}
                        </select>

                        <button
                            onClick={loadMatrix}
                            className="flex items-center gap-2 px-3 py-2 text-sm glass-card border-white/10 text-gray-300 hover:text-white"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>

                {loading && slots.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center min-h-[200px]">
                        <Loader2 className="h-8 w-8 text-nu-400 animate-spin shadow-[0_0_15px_rgba(176,42,42,0.6)] rounded-full" />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-8 gap-1.5 max-h-[300px] overflow-y-auto pr-1 mb-4 scrollbar-thin scrollbar-thumb-white/10">
                            {slots.map((slot) => (
                                <button
                                    key={slot.slot_id}
                                    onClick={() => setSelectedSlot(slot)}
                                    className={`
                                    relative p-1 rounded-lg border text-center transition-all duration-300 focus:outline-none
                                    ${selectedSlot?.slot_id === slot.slot_id ? 'ring-2 ring-nu-500 ring-offset-2 ring-offset-dark-bg z-10 scale-110' : 'hover:scale-105 hover:-translate-y-0.5'}
                                    ${slot.status === 'occupied'
                                            ? 'bg-nu-500/20 border-nu-500/50 text-nu-400 shadow-[inset_0_0_15px_rgba(176,42,42,0.3)] hover:shadow-[0_0_20px_rgba(176,42,42,0.6)] hover:border-nu-400 backdrop-blur-sm'
                                            : slot.status === 'orphan'
                                                ? 'bg-red-900/40 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-[pulse_2s_ease-in-out_infinite] hover:shadow-[0_0_25px_rgba(239,68,68,0.7)] backdrop-blur-sm'
                                                : slot.status === 'restricted'
                                                    ? 'bg-dark-surface/50 border-white/5 text-gray-600 cursor-not-allowed opacity-50'
                                                    : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10 hover:border-white/20 hover:text-gray-300 backdrop-blur-sm'
                                        }
                                `}
                                    title={slot.status === 'occupied' ? slot.student_name : `Slot ${slot.slot_id}: ${slot.status}`}
                                >
                                    <span className="text-[9px] font-bold block">#{slot.slot_id}</span>
                                    {slot.status === 'orphan' && (
                                        <div className="absolute -top-1 -right-1">
                                            <AlertTriangle className="h-2 w-2 text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,1)]" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Selected Slot Details */}
                        <div className="mt-auto border-t border-white/10 pt-4">
                            {selectedSlot ? (
                                <div className="text-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-white flex items-center gap-2">
                                            Slot #{selectedSlot.slot_id}
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border ${selectedSlot.status === 'occupied' ? 'bg-nu-500/20 text-nu-400 border-nu-500/30' :
                                                selectedSlot.status === 'orphan' ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse' : 'bg-white/10 text-gray-400 border-white/10'
                                                }`}>
                                                {selectedSlot.status}
                                            </span>
                                        </span>

                                        {selectedSlot.status === 'occupied' && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => unlinkSlot(selectedSlot)}
                                                    disabled={unlinking}
                                                    className="text-xs text-red-400 hover:text-red-300 hover:underline disabled:opacity-50 transition-colors"
                                                >
                                                    {unlinking ? 'Unlinking...' : 'Unlink'}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {selectedSlot.status === 'occupied' ? (
                                        <div className="space-y-1">
                                            <p className="text-gray-300 truncate">
                                                <span className="font-medium text-nu-400/80 text-[10px] uppercase tracking-wider block mb-0.5">Student</span>
                                                {selectedSlot.student_name}
                                            </p>
                                            <p className="text-xs text-gray-500 font-mono truncate">{selectedSlot.student_id}</p>
                                        </div>
                                    ) : selectedSlot.status === 'orphan' ? (
                                        <p className="text-red-400 text-xs">
                                            Fingerprint exists on device but no student is linked.
                                        </p>
                                    ) : selectedSlot.status === 'restricted' ? (
                                        <p className="text-gray-500 text-xs italic">
                                            This slot is occupied by another instructor&apos;s student.
                                        </p>
                                    ) : (
                                        <p className="text-gray-500 text-xs italic">Empty slot available for enrollment.</p>
                                    )}

                                    {/* Copy to Room — fingerprint template duplication */}
                                    {selectedSlot.status === 'occupied' && rooms.length > 1 && (
                                        <div className="mt-4 pt-4 border-t border-white/10">
                                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-2 flex items-center gap-1 tracking-widest">
                                                <Copy className="h-3 w-3" /> Copy to Another Room
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={moveTargetRoom}
                                                    onChange={(e) => setMoveTargetRoom(e.target.value)}
                                                    className="flex-1 px-3 py-2 bg-dark-bg border border-white/10 rounded-lg text-white text-xs focus:ring-1 focus:ring-nu-500/50 focus:border-nu-400 shadow-inner appearance-none transition-colors"
                                                >
                                                    <option value="" className="bg-dark-surface text-gray-400">Select room...</option>
                                                    {rooms.filter(r => r.id !== selectedRoomId).map(r => (
                                                        <option key={r.id} value={r.id} className="bg-dark-surface text-white">{r.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => copySlotToRoom(selectedSlot)}
                                                    disabled={!moveTargetRoom || moving}
                                                    className="px-4 py-2 text-[10px] font-bold tracking-widest uppercase rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                                >
                                                    {moving ? 'Copying...' : 'Copy'}
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-2 font-medium">Copies the fingerprint link to the target room&apos;s kiosk. Original stays intact.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-xs text-center py-4 italic flex items-center justify-center gap-2 font-medium tracking-wide">
                                    <Fingerprint className="h-4 w-4 opacity-50" /> Select a slot to view details
                                </p>
                            )}
                        </div>
                    </>
                )}

                <div className="mt-5 p-4 glass-panel border-blue-500/20 text-xs text-blue-300 flex gap-3 items-start relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] -mr-10 -mt-10 pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-700"></div>
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] relative z-10" />
                    <p className="leading-relaxed relative z-10 text-gray-300">
                        <strong className="text-white drop-shadow-sm font-bold tracking-wide">Orphan slots</strong> (Red) are IDs stored on the sensor but missing from the database.
                        This happens if a student is deleted from the app but not the device.
                    </p>
                </div>
            </div>
        </div>
    );
}
