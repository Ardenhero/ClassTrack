"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Lightbulb, Fan, Snowflake, Wifi, WifiOff, Zap, Lock, Layers } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import useSWR, { mutate } from "swr";
import { useSmartPolling } from "@/hooks/useSmartPolling";

interface IoTDevice {
    id: string;
    name: string;
    type: string;
    room: string;
    dp_code: string;
    current_state: boolean;
    online: boolean;
    updated_at: string;
}

interface IoTGroup {
    id: string;
    name: string;
    room_id: string;
    members: { device_id: string; dp_code: string }[];
}

// Map device names to appropriate icons/colors
function getDeviceVisuals(name: string) {
    const lower = name.toLowerCase();
    if (lower.includes("lock") || lower.includes("door")) return { Icon: Lock, colorOn: "purple", colorClass: "bg-purple-500 shadow-purple-200", bgOn: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700/50" };
    if (lower.includes("light")) return { Icon: Lightbulb, colorOn: "yellow", colorClass: "bg-yellow-500 shadow-yellow-200", bgOn: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/50" };
    if (lower.includes("fan")) return { Icon: Fan, colorOn: "blue", colorClass: "bg-blue-500 shadow-blue-200", bgOn: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50", spin: true };
    if (lower.includes("ac") || lower.includes("air")) return { Icon: Snowflake, colorOn: "cyan", colorClass: "bg-cyan-500 shadow-cyan-200", bgOn: "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-700/50" };
    // Default: power icon style
    return { Icon: Zap, colorOn: "green", colorClass: "bg-green-500 shadow-green-200", bgOn: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/50" };
}

export function IoTSwitches() {
    const { profile } = useProfile();
    const [devices, setDevices] = useState<IoTDevice[]>([]);
    const [groups, setGroups] = useState<IoTGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState<string>("all");
    const [togglingGroups, setTogglingGroups] = useState<string[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    const fetcher = (url: string) => {
        const headers: HeadersInit = {};
        if (profile?.id) headers['X-Profile-ID'] = profile.id;
        return fetch(url, { headers }).then(res => res.json());
    };

    const { data, error: swrError, mutate: mutateLocal } = useSWR(
        profile?.id ? '/api/iot/control' : null,
        fetcher,
        {
            revalidateOnFocus: false,
        }
    );

    // 2-minute smart polling — stops when tab is hidden, resumes on focus
    useSmartPolling(() => { mutateLocal(); }, 120_000, { enabled: !!profile?.id });

    useEffect(() => {
        if (data?.devices) {
            setDevices(data.devices);
            // Auto-select first room on initial load
            if (selectedRoom === "all" && data.devices.length > 0) {
                const rooms = Array.from(new Set(data.devices.map((d: IoTDevice) => d.room).filter(Boolean)));
                if (rooms.length > 0) setSelectedRoom(rooms[0] as string);
            }
            setLoading(false);
        }
        if (data?.groups) setGroups(data.groups);

        // Sync selectedRoomId
        if (selectedRoom !== 'all' && data?.rooms) {
            const r = data.rooms.find((rm: { name: string, id: string }) => rm.name === selectedRoom);
            if (r) setSelectedRoomId(r.id);
        }
    }, [data, selectedRoom]);

    useEffect(() => {
        if (swrError) {
            setLoading(false);
        }
    }, [swrError]);

    useEffect(() => {
        // Realtime: update toggles instantly when DB changes
        const supabase = createClient();
        const channel = supabase
            .channel("iot_switches_realtime")
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "iot_devices" },
                (payload: RealtimePostgresChangesPayload<IoTDevice>) => {
                    const updated = payload.new as IoTDevice;
                    setDevices((prev) =>
                        prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d))
                    );
                    mutateLocal(); // Trigger SWR refresh to stay in sync
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [mutateLocal]);

    // dp_codes that are momentary triggers, not persistent on/off toggles
    const MOMENTARY_DP_CODES = useMemo(() => ['unlock_ble', 'unlock_fingerprint', 'unlock_temporary'], []);

    const toggleDevice = useCallback(async (device: IoTDevice) => {
        const dpCode = device.dp_code || "switch_1";
        const isMomentary = MOMENTARY_DP_CODES.includes(dpCode);
        const newState = isMomentary ? true : !device.current_state;

        // --- TRUE OPTIMISTIC UPDATE ---
        // We flip the state immediately in the UI. No spinner, no disabling.
        setDevices((prev) =>
            prev.map((d) =>
                d.id === device.id ? { ...d, current_state: newState } : d
            )
        );

        try {
            const res = await fetch('/api/iot/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_id: device.id,
                    code: dpCode,
                    value: newState,
                    source: "web",
                    profile_id: profile?.id
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to toggle device");
            }

            // Priority Sync: Trigger immediate re-validation
            mutateLocal();
            // Also notify any global status listeners (Super Admin view)
            mutate('/api/iot/status');
        } catch (err) {
            // Revert on error only
            setDevices((prev) =>
                prev.map((d) =>
                    d.id === device.id ? { ...d, current_state: !newState } : d
                )
            );
            console.error("Toggle error:", err);
        }
    }, [MOMENTARY_DP_CODES, profile?.id, mutateLocal]);

    const toggleGroup = useCallback(async (group: IoTGroup, value: boolean) => {
        setTogglingGroups(prev => [...prev, group.id]);

        // Optimistic update for members
        const memberIds = group.members.map(m => m.device_id);
        setDevices(prev => prev.map(d =>
            memberIds.includes(d.id) ? { ...d, current_state: value } : d
        ));

        try {
            const res = await fetch('/api/iot/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group_id: group.id,
                    value: value,
                    source: "web_group_control",
                    profile_id: profile?.id
                })
            });

            if (!res.ok) throw new Error("Batch toggle failed");
            mutateLocal();
            mutate('/api/iot/status');
        } catch (err) {
            console.error("Group toggle error:", err);
            mutateLocal();
        } finally {
            setTogglingGroups(prev => prev.filter(id => id !== group.id));
        }
    }, [profile?.id, mutateLocal]);

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
                <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                    <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                    <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                </div>
            </div>
        );
    }

    if (devices.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Room Controls</h3>
                </div>
                <p className="text-sm text-gray-400 text-center py-4">
                    No IoT devices configured yet.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.05)] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Room Controls</h3>
                    {(() => {
                        const rooms = Array.from(new Set(devices.map(d => d.room).filter(Boolean))) as string[];
                        if (rooms.length > 0) {
                            return (
                                <select
                                    value={selectedRoom}
                                    onChange={(e) => setSelectedRoom(e.target.value)}
                                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-nwu-red/50 focus:border-nwu-red transition-all text-gray-700 dark:text-gray-200 font-medium"
                                >
                                    {/* Use rooms from API if available (includes empty assigned rooms) */}
                                    {(data?.rooms?.length > 0
                                        ? data.rooms.map((r: { name: string }) => r.name)
                                        : Array.from(new Set(devices.map(d => d.room).filter(Boolean)))
                                    ).map((roomName: string) => (
                                        <option key={roomName} value={roomName}>{roomName}</option>
                                    ))}
                                </select>
                            );
                        }
                        return null;
                    })()}
                </div>
                <div className="flex items-center space-x-2">
                    {devices.filter(d => d.room === selectedRoom).some(d => d.online) ? (
                        <>
                            <Wifi className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Connected</span>
                        </>
                    ) : (
                        <>
                            <WifiOff className="h-3.5 w-3.5 text-red-400" />
                            <span className="text-xs text-red-400">Offline</span>
                        </>
                    )}
                </div>
            </div>

            {/* Group Controls */}
            {selectedRoomId && groups.filter(g => g.room_id === selectedRoomId).length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2 p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                    <span className="w-full text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1 flex items-center gap-2">
                        <Layers className="h-3 w-3 text-nwu-red" /> Room Group Controls
                    </span>
                    {groups.filter(g => g.room_id === selectedRoomId).map(group => {
                        const groupDevices = devices.filter(d => group.members.some(m => m.device_id === d.id));
                        const isAnyOn = groupDevices.some(d => d.current_state);
                        const isToggling = togglingGroups.includes(group.id);

                        return (
                            <button
                                key={group.id}
                                onClick={() => toggleGroup(group, !isAnyOn)}
                                disabled={isToggling}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-tight transition-all ${isAnyOn
                                    ? "bg-nwu-red text-white border-nwu-red shadow-sm"
                                    : "bg-white dark:bg-gray-800 text-gray-500 border-gray-100 dark:border-gray-700 hover:border-nwu-red/30 shadow-sm"
                                    } ${isToggling ? "opacity-50 animate-pulse" : ""}`}
                            >
                                {group.name.toLowerCase().includes('light') ? <Lightbulb className="h-3 w-3" /> :
                                    group.name.toLowerCase().includes('fan') ? <Fan className="h-3 w-3" /> :
                                        <Zap className="h-3 w-3" />}
                                <span>{group.name}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {devices.filter(d => !d.room || d.room === selectedRoom).length === 0 ? (
                <div className="py-12 text-center">
                    <Zap className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No devices in {selectedRoom}</p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col">
                    {(() => {
                        const roomDevices = devices.filter(d => !d.room || d.room === selectedRoom);
                        return (
                            <>
                                <div className="space-y-2">
                                    {(isExpanded ? roomDevices : roomDevices.slice(0, 4)).map((device) => {
                                        const visuals = getDeviceVisuals(device.name);
                                        const { Icon } = visuals;
                                        const isOn = device.current_state;
                                        const isOnline = device.online;

                                        return (
                                            <div
                                                key={device.id}
                                                className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-700 transition-all group ${isOn
                                                    ? visuals.bgOn
                                                    : "bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-700/50 shadow-sm"
                                                    } ${!isOnline && "opacity-60 grayscale-[0.5]"}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isOn
                                                        ? `${visuals.colorClass} text-white shadow-md`
                                                        : "bg-white dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-700"
                                                        }`}>
                                                        <Icon className={`h-4 w-4 ${isOn && visuals.spin ? "animate-spin" : ""}`} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{device.name}</p>
                                                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isOnline ? "bg-green-500" : "bg-red-400"}`}></span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter truncate">
                                                            {isOnline ? "Ready" : "Offline"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleDevice(device)}
                                                    disabled={!isOnline}
                                                    className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-nwu-red focus:ring-offset-2 ${isOn ? "bg-nwu-red" : "bg-gray-200 dark:bg-gray-700"
                                                        } ${!isOnline && "opacity-50 cursor-not-allowed"}`}
                                                >
                                                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isOn ? "translate-x-5" : "translate-x-0"
                                                        }`} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {roomDevices.length > 4 && (
                                    <div className="mt-auto">
                                        <button
                                            onClick={() => setIsExpanded(!isExpanded)}
                                            className="w-full flex items-center justify-center p-2 mt-4 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors border border-dashed border-gray-200 dark:border-gray-700 rounded-xl uppercase tracking-widest"
                                        >
                                            {isExpanded ? "SHOW LESS" : `SHOW ALL DEVICES (${roomDevices.length})`}
                                        </button>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
