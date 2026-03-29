"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../utils/supabase/client";
import { useProfile } from "../context/ProfileContext";
import { Fingerprint, RefreshCw, Loader2, Copy, Lock, Unlock } from "lucide-react";
import { PostgrestError, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { ConfirmationModal } from "./ConfirmationModal";

type SlotData = {
    slot_id: number;
    student_id?: string;
    student_name?: string;
    instructor_id?: string; // Added for isolation check
    fingerprint_locked?: boolean;
    is_activator?: boolean;
    is_primary?: boolean;
    device_id?: string;
    status: "occupied" | "empty" | "restricted";
};

export function AdminBiometricMatrix() {
    const { profile } = useProfile();
    const [slots, setSlots] = useState<SlotData[]>([]);
    const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [selectedSlots, setSelectedSlots] = useState<SlotData[]>([]);
    const [selectionMode, setSelectionMode] = useState<boolean>(false);
    const [deleting, setDeleting] = useState(false);
    const [moveTargetRoom, setMoveTargetRoom] = useState<string>("");
    const [moving, setMoving] = useState(false);
    const [togglingLock, setTogglingLock] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant: "danger" | "warning" | "info" | "success";
    }>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
        variant: "warning"
    });

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
            let roomsQuery = supabase
                .from("rooms")
                .select("id, name")
                .order("name");

            if (!profile?.is_super_admin && profile?.assigned_room_ids) {
                roomsQuery = roomsQuery.in("id", profile.assigned_room_ids as string[]);
            } else if (!profile?.is_super_admin && !profile?.assigned_room_ids) {
                // Not super admin and no rooms assigned
                setRooms([]);
                setLoading(false);
                return;
            }

            const { data: roomsData, error: roomsError } = await roomsQuery;

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

            // 4. Get all students on this specific device
            // Check both students.device_id (primary) and fingerprint_device_links (copies)
            const { data: primaryStudents, error } = await supabase
                .from("students")
                .select("id, name, fingerprint_slot_id, instructor_id, fingerprint_locked")
                .not("fingerprint_slot_id", "is", null)
                .eq("device_id", deviceId) as { data: { id: string; name: string; fingerprint_slot_id: number; instructor_id: string; fingerprint_locked: boolean }[] | null; error: PostgrestError | null };

            if (error) throw error;

            // Also fetch students linked via fingerprint_device_links (copies)
            const { data: linkedStudents } = await supabase
                .from("fingerprint_device_links")
                .select("student_id, fingerprint_slot_id, students!inner(id, name, instructor_id, fingerprint_locked)")
                .eq("device_serial", deviceId);

            // Merge: build a combined list, deduplicating by student id
            const studentMap = new Map<string, { id: string; name: string; fingerprint_slot_id: number; instructor_id: string; fingerprint_locked: boolean; is_primary?: boolean }>();
            primaryStudents?.forEach(s => studentMap.set(s.id, { ...s, is_primary: true }));
            linkedStudents?.forEach((link: { student_id: number; fingerprint_slot_id: number; students: { id: string; name: string; instructor_id: string; fingerprint_locked: boolean } }) => {
                const s = link.students;
                if (s && !studentMap.has(s.id)) {
                    studentMap.set(s.id, { id: s.id, name: s.name, fingerprint_slot_id: link.fingerprint_slot_id, instructor_id: s.instructor_id, fingerprint_locked: s.fingerprint_locked, is_primary: false });
                }
            });

            const allOccupiedStudents = Array.from(studentMap.values());

            // 5. Get Activators (instructors) on this device
            const { data: activatorInstructors, error: activatorError } = await supabase
                .from("instructors")
                .select("id, name, activator_fingerprint_slot, is_locked")
                .eq("activator_device_serial", deviceId)
                .not("activator_fingerprint_slot", "is", null);

            if (activatorError) throw activatorError;

            // 6. Build the 1-127 Matrix
            const matrix: SlotData[] = [];

            for (let i = 1; i <= 127; i++) {
                const student = allOccupiedStudents?.find(s => s.fingerprint_slot_id === i);
                const activator = activatorInstructors?.find((a: { activator_fingerprint_slot: number }) => a.activator_fingerprint_slot === i);

                const isAdmin = profile?.role === "admin";

                if (student) {
                    const isMine = isAdmin || currentAccountScope.includes(student.instructor_id);
                    matrix.push({
                        slot_id: i,
                        student_id: isMine ? student.id : student.id, // Keep ID for admins to unlink even if technically restricted
                        student_name: isMine ? student.name : "Restricted",
                        instructor_id: student.instructor_id,
                        fingerprint_locked: student.fingerprint_locked,
                        is_activator: false,
                        is_primary: student.is_primary,
                        device_id: deviceId || undefined,
                        status: isMine ? "occupied" : "restricted"
                    });
                } else if (activator) {
                    const isMine = isAdmin || currentAccountScope.includes(activator.id);
                    matrix.push({
                        slot_id: i,
                        student_id: isMine ? activator.id : activator.id, // Using student_id field conceptually for the entity ID
                        student_name: isMine ? `${activator.name} (Activator)` : "Restricted",
                        instructor_id: activator.id,
                        fingerprint_locked: activator.is_locked,
                        is_activator: true,
                        is_primary: true,
                        device_id: deviceId || undefined,
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
            // Clear selections on room change
            setSelectedSlots([]);
            setSelectionMode(false);

        } catch (err) {
            console.error("Failed to load matrix:", err);
        } finally {
            setLoading(false);
        }
    }, [profile, selectedRoomId]);

    const deleteSlots = async (slotsToDelete: SlotData[]) => {
        const isAdmin = profile?.role === "admin";

        // Filter slots the user actually has permission to delete
        const validSlots = slotsToDelete.filter(slot => {
            let isMine = isAdmin;
            if (!isAdmin && profile) {
                const currentAccountScope: string[] = [profile.id];
                isMine = slot.instructor_id ? currentAccountScope.includes(slot.instructor_id) : false;
            }
            return isMine && slot.student_id;
        });

        if (validSlots.length === 0) {
            alert("No valid slots selected or you lack permission to delete them.");
            return;
        }

        setConfirmConfig({
            isOpen: true,
            title: "DELETE FINGERPRINTS",
            message: `Are you sure you want to permanently delete ${validSlots.length} fingerprint(s)? This will wipe them from the hardware and database.`,
            variant: "danger",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                setDeleting(true);

                try {
                    // Send a single bulk delete command to the API
                    const slotIds = validSlots.map(s => s.slot_id);
                    const deviceId = validSlots[0].device_id;

                    const res = await fetch("/api/kiosk/delete-fingerprint", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            device_serial: deviceId,
                            slot_id: slotIds // Send as array for bulk processing
                        })
                    });

                    if (res.ok) {
                        alert(`✓ All ${validSlots.length} delete commands queued successfully.`);
                    } else {
                        const errorData = await res.json();
                        alert(`Failed to trigger delete: ${errorData.error || 'Server error'}`);
                    }

                    setSelectedSlots([]);
                    setSelectionMode(false);
                    await loadMatrix();

                } catch (err) {
                    console.error("Failed to delete slots:", err);
                    alert("Failed to delete some fingerprints. Please try again.");
                } finally {
                    setDeleting(false);
                }
            }
        });
    };

    const toggleLockSlots = async (slotsToToggle: SlotData[], willLock: boolean) => {
        const validSlots = slotsToToggle.filter(s => s.student_id && s.fingerprint_locked !== willLock);
        if (validSlots.length === 0) return;

        setConfirmConfig({
            isOpen: true,
            title: `${willLock ? "LOCK" : "UNLOCK"} FINGERPRINTS`,
            message: `Are you sure you want to ${willLock ? "lock" : "unlock"} ${validSlots.length} fingerprint(s)?`,
            variant: "warning",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                setTogglingLock(true);
                const supabase = createClient();

                try {
                    const studentSlots = validSlots.filter(s => !s.is_activator);
                    const activatorSlots = validSlots.filter(s => s.is_activator);

                    // 1. Update Students Table (BIGINT IDs)
                    if (studentSlots.length > 0) {
                        const studentIds = studentSlots.map(s => s.student_id);
                        const { error } = await supabase
                            .from("students")
                            .update({ fingerprint_locked: willLock })
                            .in("id", studentIds);

                        if (error) {
                            console.error("Student Locking error:", error);
                            throw new Error(`Students: ${error.message}`);
                        }
                    }

                    // 2. Update Instructors Table (UUID IDs)
                    if (activatorSlots.length > 0) {
                        const activatorIds = activatorSlots.map(s => s.student_id);
                        const { error } = await supabase
                            .from("instructors")
                            .update({ is_locked: willLock }) // Note: instructors uses is_locked
                            .in("id", activatorIds);

                        if (error) {
                            console.error("Activator Locking error:", error);
                            throw new Error(`Activators: ${error.message}`);
                        }
                    }

                    await loadMatrix();
                    alert(`✓ ${validSlots.length} slot(s) successfully ${willLock ? 'locked' : 'unlocked'}.`);
                } catch (err) {
                    console.error("Failed to toggle lock:", err);
                    alert(`Failed to change lock status: ${err instanceof Error ? err.message : 'Please try again'}`);
                } finally {
                    setTogglingLock(false);
                }
            }
        });
    };

    const copySlotToRoom = async (slot: SlotData) => {
        if (!slot.student_id || !moveTargetRoom) return;

        setConfirmConfig({
            isOpen: true,
            title: "COPY FINGERPRINT",
            message: `Copy ${slot.student_name}'s fingerprint template to the selected room? The original assignment will be kept.`,
            variant: "info",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
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

                    const targetDevice = targetKiosk.device_serial;

                    // Find all occupied slots on the target device
                    const occupiedSlots = new Set<number>();

                    // Students with device_id matching target
                    const { data: targetStudents } = await supabase
                        .from("students")
                        .select("fingerprint_slot_id")
                        .eq("device_id", targetDevice)
                        .not("fingerprint_slot_id", "is", null);
                    targetStudents?.forEach((s: { fingerprint_slot_id: number }) => occupiedSlots.add(s.fingerprint_slot_id));

                    // Device links on target
                    const { data: targetLinks } = await supabase
                        .from("fingerprint_device_links")
                        .select("fingerprint_slot_id")
                        .eq("device_serial", targetDevice);
                    targetLinks?.forEach((l: { fingerprint_slot_id: number }) => occupiedSlots.add(l.fingerprint_slot_id));

                    // Activator slots on target
                    const { data: targetActivators } = await supabase
                        .from("instructors")
                        .select("activator_fingerprint_slot")
                        .eq("activator_device_serial", targetDevice)
                        .not("activator_fingerprint_slot", "is", null);
                    targetActivators?.forEach((a: { activator_fingerprint_slot: number }) => occupiedSlots.add(a.activator_fingerprint_slot));

                    // Find first empty slot (1-127)
                    let emptySlot = -1;
                    for (let i = 1; i <= 127; i++) {
                        if (!occupiedSlots.has(i)) {
                            emptySlot = i;
                            break;
                        }
                    }

                    if (emptySlot === -1) {
                        alert("No empty slots available on the target device (all 127 slots are full).");
                        return;
                    }

                    const { error } = await supabase
                        .from("fingerprint_device_links")
                        .upsert({
                            student_id: slot.student_id,
                            device_serial: targetDevice,
                            fingerprint_slot_id: emptySlot,
                        }, { onConflict: 'student_id,device_serial' });

                    if (error) throw error;

                    setMoveTargetRoom("");
                    alert(`✓ Fingerprint copied to slot #${emptySlot} on the target room's kiosk.`);
                } catch (err) {
                    console.error("Failed to copy fingerprint:", err);
                    alert("Failed to copy fingerprint template. Please try again.");
                } finally {
                    setMoving(false);
                }
            }
        });
    };

    const handleSlotClick = (slot: SlotData) => {
        if (selectionMode) {
            if (slot.status === 'empty') return; // Don't allow selecting empty slots
            setSelectedSlots(prev =>
                prev.some(s => s.slot_id === slot.slot_id)
                    ? prev.filter(s => s.slot_id !== slot.slot_id) // Deselect
                    : [...prev, slot] // Select
            );
        } else {
            setSelectedSlots(prev => prev.length === 1 && prev[0].slot_id === slot.slot_id ? [] : [slot]);
        }
    };

    useEffect(() => {
        if (selectedSlots.length > 0) {
            // Keep selected slots up to date with new matrix data
            const updatedSelections = selectedSlots.map(selected => {
                return slots.find(s => s.slot_id === selected.slot_id) || selected;
            }).filter(s => s.status !== 'empty'); // Drop removed slots

            // Only update if something changed (prevents infinite loops)
            if (JSON.stringify(updatedSelections) !== JSON.stringify(selectedSlots)) {
                setSelectedSlots(updatedSelections);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slots]); // Intentionally omitting selectedSlots and relying on deep comparison

    useEffect(() => {
        if (profile?.role === "admin" || profile?.is_super_admin) {
            loadMatrix();

            // Real-time Subscription
            const supabase = createClient();
            const channel = supabase
                .channel('biometric-matrix-updates')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'students' },
                    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
                        console.log("Realtime: Student change detected", payload);
                        loadMatrix();
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'fingerprint_device_links' },
                    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
                        console.log("Realtime: Fingerprint device link change detected", payload);
                        loadMatrix();
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'instructors' },
                    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
                        console.log("Realtime: Instructor change detected", payload);
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
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setSelectionMode(!selectionMode);
                                    if (selectionMode) setSelectedSlots([]); // Clear if turning off
                                }}
                                className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors ${selectionMode
                                    ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-300'
                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                            >
                                {selectionMode ? 'Cancel Selection' : 'Select Multiple'}
                            </button>
                            {selectionMode && (
                                <button
                                    onClick={() => {
                                        const selectable = slots.filter(s => s.status === 'occupied');
                                        if (selectedSlots.length === selectable.length && selectable.length > 0) {
                                            setSelectedSlots([]); // Deselect all
                                        } else {
                                            setSelectedSlots(selectable); // Select all
                                        }
                                    }}
                                    className="text-xs px-3 py-1.5 rounded-md border font-medium transition-colors bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
                                >
                                    {selectedSlots.length === slots.filter(s => s.status === 'occupied').length && slots.filter(s => s.status === 'occupied').length > 0 ? 'Deselect All' : 'Select All'}
                                </button>
                            )}
                        </div>

                        {selectionMode && selectedSlots.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500">{selectedSlots.length} selected</span>
                                <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                                <button
                                    onClick={() => toggleLockSlots(selectedSlots, true)}
                                    disabled={togglingLock || selectedSlots.every(s => s.fingerprint_locked)}
                                    className="text-xs flex items-center gap-1 text-orange-600 hover:text-orange-700 disabled:opacity-50"
                                >
                                    <Lock className="w-3 h-3" /> Lock
                                </button>
                                <button
                                    onClick={() => toggleLockSlots(selectedSlots, false)}
                                    disabled={togglingLock || selectedSlots.every(s => !s.fingerprint_locked)}
                                    className="text-xs flex items-center gap-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                                >
                                    <Unlock className="w-3 h-3" /> Unlock
                                </button>
                                <button
                                    onClick={() => deleteSlots(selectedSlots)}
                                    disabled={deleting}
                                    className="text-xs flex items-center gap-1 text-red-600 hover:text-red-700 disabled:opacity-50 ml-2"
                                >
                                    {deleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-8 gap-1.5 max-h-[300px] overflow-y-auto pr-1 mb-4">
                        {slots.map((slot) => {
                            const isSelected = selectedSlots.some(s => s.slot_id === slot.slot_id);
                            return (
                                <button
                                    key={slot.slot_id}
                                    onClick={() => handleSlotClick(slot)}
                                    className={`
                                        relative p-1 rounded border text-center transition-all hover:scale-105 focus:outline-none
                                        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 z-10 shadow-md transform scale-105' : ''}
                                        ${slot.status === 'occupied'
                                            ? slot.is_activator
                                                ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300'
                                                : slot.fingerprint_locked
                                                    ? 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/40 dark:border-orange-700 dark:text-orange-300'
                                                    : 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                                            : slot.status === 'restricted'
                                                ? 'bg-gray-200 border-gray-300 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 cursor-not-allowed opacity-60'
                                                : 'bg-gray-50 border-gray-100 text-gray-300 dark:bg-gray-800/30 dark:border-gray-700 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }
                                        ${selectionMode && slot.status === 'empty' ? 'opacity-30 cursor-not-allowed' : ''}
                                    `}
                                    title={slot.status === 'occupied' ? `${slot.student_name}${slot.fingerprint_locked ? ' (Locked)' : ''}` : `Slot ${slot.slot_id}: ${slot.status}`}
                                    disabled={selectionMode && slot.status === 'empty'}
                                >
                                    <span className="text-[9px] font-bold block">#{slot.slot_id}</span>
                                    {slot.status === 'occupied' && slot.fingerprint_locked && (
                                        <div className="absolute -bottom-1 -right-1">
                                            <Lock className="h-2 w-2 text-orange-600 fill-orange-100" />
                                        </div>
                                    )}
                                    {selectionMode && isSelected && (
                                        <div className="absolute inset-0 border-2 border-blue-500 rounded bg-blue-500/10 pointer-events-none"></div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Selected Slot Details (Only show when exactly ONE slot is selected) */}
                    <div className="mt-auto border-t border-gray-100 dark:border-gray-700 pt-4">
                        {selectedSlots.length === 1 ? (
                            <div className="text-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        Slot #{selectedSlots[0].slot_id}
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider ${selectedSlots[0].status === 'occupied' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                            {selectedSlots[0].status}
                                        </span>
                                    </span>

                                    {selectedSlots[0].status === 'occupied' && !selectionMode && (
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleLockSlots([selectedSlots[0]], !selectedSlots[0].fingerprint_locked)}
                                                disabled={togglingLock}
                                                className={`text-xs flex items-center gap-1 hover:underline disabled:opacity-50 ${selectedSlots[0].fingerprint_locked ? "text-green-600 hover:text-green-700" : "text-orange-600 hover:text-orange-700"}`}
                                            >
                                                {togglingLock ? 'Updating...' : selectedSlots[0].fingerprint_locked ? <><Unlock className="w-3 h-3" /> Unlock</> : <><Lock className="w-3 h-3" /> Lock</>}
                                            </button>
                                            <div className="w-px h-3 bg-gray-300 dark:bg-gray-600"></div>
                                            <button
                                                onClick={() => deleteSlots([selectedSlots[0]])}
                                                disabled={deleting}
                                                className="text-xs text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
                                            >
                                                {deleting ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {selectedSlots[0].status === 'occupied' ? (
                                    <div className="space-y-1">
                                        <p className="text-gray-600 dark:text-gray-300 truncate">
                                            <span className="font-medium text-gray-500 text-xs uppercase block">{selectedSlots[0].is_activator ? "Activator" : "Student"}</span>
                                            {selectedSlots[0].student_name}
                                        </p>
                                        <p className="text-xs text-gray-400 font-mono truncate">{selectedSlots[0].student_id}</p>
                                    </div>
                                ) : selectedSlots[0].status === 'restricted' ? (
                                    <div className="space-y-1">
                                        <p className="text-gray-500 text-xs italic">
                                            This slot is occupied by {selectedSlots[0].student_name === "Restricted" ? "another instructor's user" : selectedSlots[0].student_name}.
                                        </p>
                                        {profile?.role === "admin" && !selectionMode && (
                                            <button
                                                onClick={() => deleteSlots([selectedSlots[0]])}
                                                disabled={deleting}
                                                className="text-xs text-red-600 hover:text-red-700 hover:underline mt-2 disabled:opacity-50 inline-block"
                                            >
                                                {deleting ? 'Force Deleting...' : 'Force Delete as Admin'}
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 text-xs italic">Empty slot available for enrollment.</p>
                                )}

                                {/* Copy to Room — fingerprint template duplication */}
                                {selectedSlots[0].status === 'occupied' && rooms.length > 1 && !selectionMode && (
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
                                                onClick={() => copySlotToRoom(selectedSlots[0])}
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
                        ) : selectedSlots.length > 1 ? (
                            <p className="text-blue-500 text-xs font-semibold py-2">
                                {selectedSlots.length} slots selected. Use the actions above to modify them.
                            </p>
                        ) : (
                            <p className="text-gray-400 text-xs text-center py-2 italic">
                                Select a slot to view details
                            </p>
                        )}
                    </div>
                </>
            )}

            <ConfirmationModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                variant={confirmConfig.variant}
            />
        </div>
    );
}
