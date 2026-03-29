"use client";

import { useState, useEffect } from "react";
import { Lightbulb, Fan, Snowflake, Zap, Lock, Wifi, Clock } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import useSWR from "swr";
import { useSmartPolling } from "@/hooks/useSmartPolling";

interface Room {
    id: string;
    name: string;
}

interface IoTDevice {
    id: string;
    name: string;
    type: string;
    room: string;
    dp_code: string;
    current_state: boolean;
    online: boolean;
    updated_at: string;
    department?: string;
}

interface IoTGroup {
    id: string;
    name: string;
    room_id: string;
    members: { device_id: string; dp_code: string }[];
}

function getDeviceIcon(name: string) {
    const lower = name.toLowerCase();
    if (lower.includes("lock") || lower.includes("door")) return Lock;
    if (lower.includes("light")) return Lightbulb;
    if (lower.includes("fan")) return Fan;
    if (lower.includes("ac") || lower.includes("air")) return Snowflake;
    return Zap;
}

export function AdminRoomControl({ title = "University Room Controls" }: { title?: string }) {
    const [devices, setDevices] = useState<IoTDevice[]>([]);
    const [groups, setGroups] = useState<IoTGroup[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [togglingGroups, setTogglingGroups] = useState<string[]>([]);

    const fetcher = (url: string) => fetch(url).then(res => res.json());
    const { data, mutate, isValidating } = useSWR('/api/iot/control', fetcher, {
        revalidateOnFocus: false,
    });

    // 2-minute smart polling — stops when tab is hidden, resumes on focus
    useSmartPolling(() => { mutate(); }, 120_000);

    useEffect(() => {
        if (data?.devices) setDevices(data.devices);
        if (data?.groups) setGroups(data.groups);
    }, [data]);

    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel("admin_iot_realtime")
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "iot_devices" },
                (payload: RealtimePostgresChangesPayload<IoTDevice>) => {
                    const updated = payload.new as IoTDevice;
                    setDevices((prev) =>
                        prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d))
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const toggleDevice = async (device: IoTDevice) => {
        const newState = !device.current_state;

        // Optimistic update
        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, current_state: newState } : d));

        try {
            const res = await fetch('/api/iot/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_id: device.id,
                    code: device.dp_code || 'switch_1',
                    value: newState,
                    source: "admin_dashboard"
                })
            });
            if (!res.ok) throw new Error("Failed to control device");
            mutate();
        } catch (err) {
            console.error(err);
            // Revert
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, current_state: !newState } : d));
        }
    };

    const toggleGroup = async (group: IoTGroup, value: boolean) => {
        setTogglingGroups(prev => [...prev, group.id]);

        // Optimistic update for all members
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
                    source: "admin_group_control"
                })
            });
            if (!res.ok) throw new Error("Failed to control group");
            mutate();
        } catch (err) {
            console.error(err);
            // Mutate will revert from server state
            mutate();
        } finally {
            setTogglingGroups(prev => prev.filter(id => id !== group.id));
        }
    };

    const filteredDevices = devices.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.room?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group by room
    const rooms = Array.from(new Set(filteredDevices.map(d => d.room || "Unassigned")));

    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Command center for all IoT infrastructure</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Filter:</span>
                    <select
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red outline-none transition-all w-full md:w-48 appearance-none"
                    >
                        <option value="">All Rooms</option>
                        {(data?.rooms || []).sort((a: Room, b: Room) => a.name.localeCompare(b.name)).map((room: Room) => (
                            <option key={room.id} value={room.name}>{room.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="p-6">
                <div className="space-y-6">
                    {rooms.length > 0 ? rooms.map(room => (
                        <div key={room} className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-nwu-red"></span>
                                    {room}
                                </h4>
                                <span className="text-[10px] text-gray-400 font-medium">
                                    {(data?.rooms?.find((r: Room) => r.name === room))?.id && (
                                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                            {groups.filter(g => g.room_id === (data.rooms.find((r: Room) => r.name === room)?.id)).map(group => {
                                                const groupDevices = devices.filter(d => group.members.some(m => m.device_id === d.id));
                                                const isAnyOn = groupDevices.some(d => d.current_state);
                                                const isToggling = togglingGroups.includes(group.id);

                                                return (
                                                    <button
                                                        key={group.id}
                                                        onClick={() => toggleGroup(group, !isAnyOn)}
                                                        disabled={isToggling}
                                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-tight transition-all ${isAnyOn
                                                            ? "bg-nwu-red text-white border-nwu-red shadow-sm"
                                                            : "bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-gray-700 hover:border-nwu-red/30 shadow-sm"
                                                            } ${isToggling ? "opacity-50 animate-pulse" : ""}`}
                                                    >
                                                        {group.name.toLowerCase().includes('light') ? <Lightbulb className="h-2.5 w-2.5" /> :
                                                            group.name.toLowerCase().includes('fan') ? <Fan className="h-2.5 w-2.5" /> :
                                                                <Zap className="h-2.5 w-2.5" />}
                                                        <span>{group.name}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {filteredDevices.filter(d => (d.room || "Unassigned") === room).length} Devices
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {filteredDevices.filter(d => (d.room || "Unassigned") === room).map(device => {
                                    const Icon = getDeviceIcon(device.name);
                                    return (
                                        <div
                                            key={device.id}
                                            className="flex items-center justify-between p-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 group hover:border-nwu-red/30 transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl transition-colors ${device.current_state
                                                        ? "bg-nwu-red text-white"
                                                        : "bg-white dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-700"
                                                    }`}>
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{device.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`h-1.5 w-1.5 rounded-full ${device.online ? "bg-green-500" : "bg-red-400"}`}></span>
                                                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">
                                                            {device.online ? "Online" : "Offline"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleDevice(device)}
                                                disabled={!device.online}
                                                className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-nwu-red focus:ring-offset-2 ${device.current_state ? "bg-nwu-red" : "bg-gray-200 dark:bg-gray-700"
                                                    } ${!device.online && "opacity-50 cursor-not-allowed"}`}
                                            >
                                                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${device.current_state ? "translate-x-5" : "translate-x-0"
                                                    }`} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-10">
                            <Zap className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-500 text-sm font-medium">No devices found matching your search</p>
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-4 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <Wifi className="h-3 w-3 text-green-500" />
                            System Live
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            Refresh: 60s
                        </div>
                    </div>
                    {isValidating && <span className="animate-pulse text-nwu-red">Syncing...</span>}
                </div>
            </div>
        </div>
    );
}
