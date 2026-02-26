"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";
import { Fingerprint, RefreshCw, Loader2, Copy, Lock, Unlock } from "lucide-react";
import { PostgrestError, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type SlotData = {
    slot_id: number;
    student_id?: string;
    student_name?: string;
    instructor_id?: string; // Added for isolation check
    fingerprint_locked?: boolean;
    is_activator?: boolean;
    status: "occupied" | "empty" | "restricted";
};

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
    const [togglingLock, setTogglingLock] = useState(false);

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
                for (let i = 1; i <= 250; i++) {
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
                .select("id, name, fingerprint_slot_id, instructor_id, fingerprint_locked")
                .not("fingerprint_slot_id", "is", null)
                .in("instructor_id", currentAccountScope)
                .eq("device_id", deviceId) as { data: { id: string; name: string; fingerprint_slot_id: number; instructor_id: string; fingerprint_locked: boolean }[] | null; error: PostgrestError | null };

            if (error) throw error;

            // Also fetch students linked via fingerprint_device_links (copies)
            const { data: linkedStudents } = await supabase
                .from("fingerprint_device_links")
                .select("student_id, fingerprint_slot_id, students!inner(id, name, instructor_id, fingerprint_locked)")
                .eq("device_serial", deviceId);

            // Merge: build a combined list, deduplicating by student id
            const studentMap = new Map<string, { id: string; name: string; fingerprint_slot_id: number; instructor_id: string; fingerprint_locked: boolean }>();
            primaryStudents?.forEach(s => studentMap.set(s.id, s));
            linkedStudents?.forEach((link: { student_id: number; fingerprint_slot_id: number; students: { id: string; name: string; instructor_id: string; fingerprint_locked: boolean } }) => {
                const s = link.students;
                if (s && currentAccountScope.includes(s.instructor_id) && !studentMap.has(s.id)) {
                    studentMap.set(s.id, { id: s.id, name: s.name, fingerprint_slot_id: link.fingerprint_slot_id, instructor_id: s.instructor_id, fingerprint_locked: s.fingerprint_locked });
                }
            });

            const allOccupiedStudents = Array.from(studentMap.values());

            // 5. Get Activators (instructors) on this device
            const { data: activatorInstructors, error: activatorError } = await supabase
                .from("instructors")
                .select("id, name, activator_fingerprint_slot")
                .eq("activator_device_serial", deviceId)
                .not("activator_fingerprint_slot", "is", null);

            if (activatorError) throw activatorError;

            // 6. Build the 1-250 Matrix
            const matrix: SlotData[] = [];

            for (let i = 1; i <= 250; i++) {
                const student = allOccupiedStudents?.find(s => s.fingerprint_slot_id === i);
                const activator = activatorInstructors?.find((a: { activator_fingerprint_slot: number }) => a.activator_fingerprint_slot === i);

                if (student) {
                    const isMine = currentAccountScope.includes(student.instructor_id);
                    matrix.push({
                        slot_id: i,
                        student_id: isMine ? student.id : undefined,
                        student_name: isMine ? student.name : "Restricted",
                        instructor_id: student.instructor_id,
                        fingerprint_locked: student.fingerprint_locked,
                        is_activator: false,
                        status: isMine ? "occupied" : "restricted"
                    });
                } else if (activator) {
                    const isMine = currentAccountScope.includes(activator.id);
                    matrix.push({
                        slot_id: i,
                        student_id: isMine ? activator.id : undefined, // Using student_id field conceptually for the entity ID
                        student_name: isMine ? `${activator.name} (Activator)` : "Restricted",
                        instructor_id: activator.id,
                        is_activator: true,
                        status: isMine ? "occupied" : "restricted"
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

    const toggleLockSlot = async (slot: SlotData) => {
        if (!slot.student_id) return;
        const willLock = !slot.fingerprint_locked;

        if (!confirm(`Are you sure you want to ${willLock ? "lock" : "unlock"} ${slot.student_name}'s fingerprint? ${willLock ? "This will prevent them from logging attendance using this fingerprint." : "They will be able to log attendance again."}`)) return;

        setTogglingLock(true);
        const supabase = createClient();

        try {
            const { error } = await supabase
                .from("students")
                .update({ fingerprint_locked: willLock })
                .eq("id", slot.student_id);

            if (error) throw error;

            await loadMatrix();
            // Optimistically update selected slot locally so UI doesn't jump
            setSelectedSlot({ ...slot, fingerprint_locked: willLock });
        } catch (err) {
            console.error("Failed to toggle lock:", err);
            alert("Failed to change lock status. Please try again.");
        } finally {
            setTogglingLock(false);
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
                        <span className="text-green-600 font-bold">Students</span> • <span className="text-blue-600 font-bold">Activators</span> • <span className="text-gray-400">Empty</span>
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
                                        ? slot.is_activator
                                            ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300'
                                            : slot.fingerprint_locked
                                                ? 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/40 dark:border-orange-700 dark:text-orange-300'
                                                : 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                                        : slot.status === 'restricted'
                                            ? 'bg-gray-200 border-gray-300 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 cursor-not-allowed'
                                            : 'bg-gray-50 border-gray-100 text-gray-300 dark:bg-gray-800/30 dark:border-gray-700 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }
                                `}
                                title={slot.status === 'occupied' ? `${slot.student_name}${slot.fingerprint_locked ? ' (Locked)' : ''}` : `Slot ${slot.slot_id}: ${slot.status}`}
                            >
                                <span className="text-[9px] font-bold block">#{slot.slot_id}</span>
                                {slot.status === 'occupied' && slot.fingerprint_locked && (
                                    <div className="absolute -bottom-1 -right-1">
                                        <Lock className="h-2 w-2 text-orange-600 fill-orange-100" />
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
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider ${selectedSlot.status === 'occupied' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {selectedSlot.status}
                                        </span>
                                    </span>

                                    {selectedSlot.status === 'occupied' && (
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleLockSlot(selectedSlot)}
                                                disabled={togglingLock}
                                                className={`text-xs flex items-center gap-1 hover:underline disabled:opacity-50 ${selectedSlot.fingerprint_locked ? "text-green-600 hover:text-green-700" : "text-orange-600 hover:text-orange-700"}`}
                                            >
                                                {togglingLock ? 'Updating...' : selectedSlot.fingerprint_locked ? <><Unlock className="w-3 h-3" /> Unlock</> : <><Lock className="w-3 h-3" /> Lock</>}
                                            </button>
                                            <div className="w-px h-3 bg-gray-300 dark:bg-gray-600"></div>
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
                                ) : selectedSlot.status === 'restricted' ? (
                                    <p className="text-gray-500 text-xs italic">
                                        This slot is occupied by another instructor&apos;s student.
                                    </p>
                                ) : (
                                    <p className="text-gray-400 text-xs italic">Empty slot available for enrollment.</p>
                                )}

                                {/* Copy to Room — fingerprint template duplication */}
                                {selectedSlot.status === 'occupied' && rooms.length > 1 && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 flex items-center gap-1">
                                            <Copy className="h-3 w-3" /> Copy to Another Room
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
                                                onClick={() => copySlotToRoom(selectedSlot)}
                                                disabled={!moveTargetRoom || moving}
                                                className="px-3 py-1.5 text-xs font-bold bg-blue-500/10 text-blue-600 rounded-lg hover:bg-blue-500/20 transition border border-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {moving ? 'Copying...' : 'Copy'}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1">Copies the fingerprint link to the target room&apos;s kiosk. Original stays intact.</p>
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

        </div>
    );
}
