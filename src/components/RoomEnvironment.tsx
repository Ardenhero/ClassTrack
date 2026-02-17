"use client";

import { useState, useEffect, useCallback } from "react";
import { useProfile } from "@/context/ProfileContext";
import { createClient } from "@/utils/supabase/client";
import { Power, Wifi, WifiOff, Loader2, Zap } from "lucide-react";
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

export default function RoomEnvironment() {
    const { profile } = useProfile();
    const [devices, setDevices] = useState<IoTDevice[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);

    const loadDevices = useCallback(async () => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("iot_devices")
            .select("*")
            .order("name");

        if (!error && data) {
            setDevices(data as IoTDevice[]);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadDevices();

        // Subscribe to realtime changes on iot_devices
        const supabase = createClient();
        const channel = supabase
            .channel("iot_devices_realtime")
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "iot_devices" },
                (payload: RealtimePostgresChangesPayload<IoTDevice>) => {
                    const updated = payload.new as IoTDevice;
                    setDevices((prev) =>
                        prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d))
                    );
                    // Clear toggling state if this device was being toggled
                    setToggling((prev) => (prev === updated.id ? null : prev));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadDevices]);

    const handleToggle = async (device: IoTDevice) => {
        setToggling(device.id);

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

            if (res.ok) {
                // Optimistically update
                setDevices((prev) =>
                    prev.map((d) =>
                        d.id === device.id ? { ...d, current_state: !d.current_state } : d
                    )
                );
            } else {
                const err = await res.json();
                console.error("Toggle failed:", err);
            }
        } catch (err) {
            console.error("Toggle error:", err);
        } finally {
            // Clear after 5s max in case realtime doesn't fire
            setTimeout(() => setToggling((prev) => (prev === device.id ? null : prev)), 5000);
        }
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
                <div className="flex items-center justify-center min-h-[120px]">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
            </div>
        );
    }

    if (devices.length === 0) {
        return null; // Don't show card if no devices configured
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Room Environment
                </h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    {devices[0]?.room || "Classroom"}
                </span>
            </div>

            <div className="space-y-3">
                {devices.map((device) => (
                    <div
                        key={device.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${device.current_state
                            ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800"
                            : "bg-gray-50 border-gray-200 dark:bg-gray-700/30 dark:border-gray-600"
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={`p-2 rounded-lg ${device.current_state
                                    ? "bg-green-100 dark:bg-green-900/30"
                                    : "bg-gray-200 dark:bg-gray-600"
                                    }`}
                            >
                                <Power
                                    className={`h-4 w-4 ${device.current_state
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-gray-400 dark:text-gray-500"
                                        }`}
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {device.name}
                                </p>
                                <div className="flex items-center gap-1.5">
                                    {device.online ? (
                                        <Wifi className="h-3 w-3 text-green-500" />
                                    ) : (
                                        <WifiOff className="h-3 w-3 text-red-400" />
                                    )}
                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                                        {device.current_state ? "ON" : "OFF"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Toggle Switch */}
                        <button
                            onClick={() => handleToggle(device)}
                            disabled={toggling === device.id}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${device.current_state
                                ? "bg-green-500"
                                : "bg-gray-300 dark:bg-gray-600"
                                } ${toggling === device.id ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                        >
                            <span className="sr-only">Toggle {device.name}</span>
                            {toggling === device.id ? (
                                <span className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 className="h-3 w-3 animate-spin text-white" />
                                </span>
                            ) : (
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${device.current_state ? "translate-x-6" : "translate-x-1"
                                        }`}
                                />
                            )}
                        </button>
                    </div>
                ))}
            </div>

            {/* Last updated */}
            <p className="text-[10px] text-gray-400 mt-3 text-right">
                Last sync:{" "}
                {devices[0]?.updated_at
                    ? new Date(devices[0].updated_at).toLocaleTimeString()
                    : "—"}
            </p>
        </div>
    );
}
