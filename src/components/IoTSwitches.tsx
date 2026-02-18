"use client";

import { useState, useEffect, useCallback } from "react";
import { Lightbulb, Fan, Snowflake, Loader2, Wifi, WifiOff, Zap } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

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

interface DebugInfo {
    userEmail?: string | null;
    departmentId?: string | null;
    isSuperAdmin?: boolean;
    deviceCount?: number;
}

// Map device names to appropriate icons/colors
function getDeviceVisuals(name: string) {
    const lower = name.toLowerCase();
    if (lower.includes("light")) return { Icon: Lightbulb, colorOn: "yellow", colorClass: "bg-yellow-500 shadow-yellow-200", bgOn: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/50" };
    if (lower.includes("fan")) return { Icon: Fan, colorOn: "blue", colorClass: "bg-blue-500 shadow-blue-200", bgOn: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50", spin: true };
    if (lower.includes("ac") || lower.includes("air")) return { Icon: Snowflake, colorOn: "cyan", colorClass: "bg-cyan-500 shadow-cyan-200", bgOn: "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-700/50" };
    // Default: power icon style
    return { Icon: Zap, colorOn: "green", colorClass: "bg-green-500 shadow-green-200", bgOn: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/50" };
}

export function IoTSwitches() {
    const { profile } = useProfile();
    const [devices, setDevices] = useState<IoTDevice[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

    const loadDevices = useCallback(async () => {
        try {
            const headers: HeadersInit = {};
            if (profile?.id) {
                headers['X-Profile-ID'] = profile.id;
            }

            const res = await fetch('/api/iot/control', { headers });
            if (res.ok) {
                const data = await res.json();
                if (data.devices) {
                    setDevices(data.devices);
                    if (data.debug) console.log("IoT Debug:", data.debug);
                    setDebugInfo(data.debug);
                }
            }
        } catch (err) {
            console.error("Failed to load devices", err);
        }
        setLoading(false);
    }, [profile]);

    useEffect(() => {
        loadDevices();

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
                    setToggling((prev) => (prev === updated.id ? null : prev));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadDevices]);

    const toggleDevice = async (device: IoTDevice) => {
        setToggling(device.id);

        // Optimistic update
        setDevices((prev) =>
            prev.map((d) =>
                d.id === device.id ? { ...d, current_state: !d.current_state } : d
            )
        );

        try {
            const res = await fetch(
                `/api/iot/control`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        device_id: device.id,
                        code: device.dp_code || "switch_1",
                        value: !device.current_state,
                        source: "web",
                        profile_id: profile?.id,
                    }),
                }
            );

            if (!res.ok) {
                // Revert on failure
                setDevices((prev) =>
                    prev.map((d) =>
                        d.id === device.id ? { ...d, current_state: device.current_state } : d
                    )
                );
                console.error("Toggle failed:", await res.json());
            }
        } catch (err) {
            // Revert on error
            setDevices((prev) =>
                prev.map((d) =>
                    d.id === device.id ? { ...d, current_state: device.current_state } : d
                )
            );
            console.error("Toggle error:", err);
        } finally {
            setTimeout(() => setToggling((prev) => (prev === device.id ? null : prev)), 5000);
        }
    };

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
                    {debugInfo && (
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs text-left font-mono">
                            <p className="font-bold text-gray-500 mb-1">Debug Info:</p>
                            <p>User: {debugInfo.userEmail || 'Unknown'}</p>
                            <p>Dept ID: {debugInfo.departmentId || 'None (Global)'}</p>
                            <p>Super Admin: {debugInfo.isSuperAdmin ? 'Yes' : 'No'}</p>
                        </div>
                    )}
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Room Controls</h3>
                <div className="flex items-center space-x-2">
                    {devices.some(d => d.online) ? (
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {devices.map((device) => {
                    const visuals = getDeviceVisuals(device.name);
                    const { Icon } = visuals;
                    const isOn = device.current_state;
                    const isToggling = toggling === device.id;

                    return (
                        <button
                            key={device.id}
                            onClick={() => toggleDevice(device)}
                            disabled={isToggling}
                            className={`relative p-4 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center space-y-3 overflow-hidden ${isOn
                                ? visuals.bgOn
                                : "bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600"
                                } ${isToggling ? "opacity-70 cursor-wait" : ""}`}
                        >
                            <div
                                className={`p-3 rounded-full relative z-10 ${isOn
                                    ? `${visuals.colorClass} text-white shadow-lg dark:shadow-none`
                                    : "bg-gray-200 dark:bg-gray-600 text-gray-400"
                                    }`}
                            >
                                {isToggling ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    <Icon
                                        className={`h-6 w-6 ${isOn && visuals.spin ? "animate-spin" : ""
                                            }`}
                                        style={isOn && visuals.spin ? { animationDuration: "3s" } : {}}
                                    />
                                )}
                            </div>
                            <div className="text-center relative z-10">
                                <span className="block font-medium text-gray-900 dark:text-gray-100">
                                    {device.name}
                                </span>
                                {device.room && (
                                    <span className="block text-[10px] text-gray-400 font-mono mt-0.5 uppercase tracking-wide">
                                        {device.room}
                                    </span>
                                )}
                                <span
                                    className={`text-xs font-bold mt-1 block ${isOn
                                        ? `text-${visuals.colorOn}-600 dark:text-${visuals.colorOn}-400`
                                        : "text-gray-400"
                                        }`}
                                >
                                    {isOn ? "ON" : "OFF"}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
