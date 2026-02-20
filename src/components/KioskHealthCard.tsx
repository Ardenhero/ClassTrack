"use client";

import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, Clock, RefreshCw, Radio } from "lucide-react";

interface KioskDevice {
    id: string;
    device_serial: string;
    name: string;
    is_online: boolean;
    last_heartbeat: string | null;
    firmware_version: string | null;
    ip_address: string | null;
    rooms: { name: string; building: string | null } | null;
}

export function KioskHealthCard() {
    const [devices, setDevices] = useState<KioskDevice[]>([]);
    const [loading, setLoading] = useState(true);
    const [pingingDevice, setPingingDevice] = useState<string | null>(null);
    const [pingResult, setPingResult] = useState<{ serial: string; status: "sent" | "error" } | null>(null);

    const fetchDevices = useCallback(async () => {
        try {
            const res = await fetch("/api/kiosk/heartbeat");
            const data = await res.json();
            setDevices(data.devices || []);
        } catch (err) {
            console.error("[KioskHealth] Fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDevices();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchDevices, 30000);
        return () => clearInterval(interval);
    }, [fetchDevices]);

    const handlePing = async (deviceSerial: string) => {
        setPingingDevice(deviceSerial);
        setPingResult(null);
        try {
            const res = await fetch("/api/kiosk/ping", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ device_serial: deviceSerial }),
            });
            if (res.ok) {
                setPingResult({ serial: deviceSerial, status: "sent" });
            } else {
                setPingResult({ serial: deviceSerial, status: "error" });
            }
        } catch {
            setPingResult({ serial: deviceSerial, status: "error" });
        } finally {
            setPingingDevice(null);
            // Auto-clear the ping result after 5 seconds
            setTimeout(() => setPingResult(null), 5000);
        }
    };

    const onlineCount = devices.filter(d => d.is_online).length;
    const totalCount = devices.length;

    const timeAgo = (dateStr: string | null) => {
        if (!dateStr) return "Never";
        const diff = Date.now() - new Date(dateStr).getTime();
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-green-500" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Kiosk Health</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${onlineCount === totalCount && totalCount > 0
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                        {onlineCount}/{totalCount} Online
                    </span>
                    <button onClick={fetchDevices} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                {devices.length === 0 && !loading && (
                    <p className="text-xs text-gray-400 text-center py-4">No kiosks registered yet.</p>
                )}
                {loading && devices.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4 animate-pulse">Loading...</p>
                )}
                {devices.map(device => (
                    <div
                        key={device.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${device.is_online
                            ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30'
                            : 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            {device.is_online
                                ? <Wifi className="h-3.5 w-3.5 text-green-500" />
                                : <WifiOff className="h-3.5 w-3.5 text-red-400" />
                            }
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white">{device.name}</p>
                                <p className="text-gray-500 dark:text-gray-400">
                                    {device.rooms?.name || device.device_serial}
                                    {device.firmware_version && ` • v${device.firmware_version}`}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Ping Button */}
                            <button
                                onClick={() => handlePing(device.device_serial)}
                                disabled={pingingDevice === device.device_serial}
                                className={`p-1.5 rounded-lg transition-all ${pingResult?.serial === device.device_serial && pingResult.status === "sent"
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                        : pingResult?.serial === device.device_serial && pingResult.status === "error"
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
                                            : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-blue-500'
                                    }`}
                                title="Send diagnostic ping"
                            >
                                <Radio className={`h-3.5 w-3.5 ${pingingDevice === device.device_serial ? 'animate-ping' : ''}`} />
                            </button>
                            {/* Ping result label */}
                            {pingResult?.serial === device.device_serial && (
                                <span className={`text-[10px] font-bold ${pingResult.status === "sent" ? 'text-green-600' : 'text-red-500'
                                    }`}>
                                    {pingResult.status === "sent" ? "Sent ✓" : "Failed"}
                                </span>
                            )}
                            {/* Heartbeat time */}
                            <div className="flex items-center gap-1 text-gray-400">
                                <Clock className="h-3 w-3" />
                                <span>{timeAgo(device.last_heartbeat)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
