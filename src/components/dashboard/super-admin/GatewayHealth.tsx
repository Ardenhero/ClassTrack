"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff, Radio, Loader2, Server, RefreshCw } from "lucide-react";

interface GatewayStatus {
    id: string;
    online: boolean;
    name: string;
    error?: string;
}

interface DeviceStatus {
    id: string;
    label: string;
    online: boolean;
    name?: string;
    error?: string;
}

export function GatewayHealth() {
    const [gateway, setGateway] = useState<GatewayStatus | null>(null);
    const [devices, setDevices] = useState<DeviceStatus[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/iot/status");
            if (res.ok) {
                const data = await res.json();
                setGateway(data.gateway);
                setDevices(data.devices || []);
            }
        } catch (err) {
            console.error("Gateway health fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        // Poll every 30 seconds
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Server className="h-4 w-4 text-purple-500" />
                    IoT Infrastructure
                </h3>
                <button
                    onClick={fetchStatus}
                    disabled={loading}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                    <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {loading && !gateway ? (
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Gateway Status */}
                    {gateway && (
                        <div className={`flex items-center gap-3 p-3 rounded-lg border ${gateway.online
                                ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800"
                                : "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800"
                            }`}>
                            <div className={`p-1.5 rounded-lg ${gateway.online ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                                <Radio className={`h-4 w-4 ${gateway.online ? "text-green-600" : "text-red-500"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                    {gateway.name}
                                </p>
                                <p className={`text-[10px] font-bold uppercase tracking-wider ${gateway.online ? "text-green-600" : "text-red-500"}`}>
                                    {gateway.online ? "Online" : "Offline"}
                                </p>
                            </div>
                            {gateway.online ? (
                                <Wifi className="h-4 w-4 text-green-500 flex-shrink-0" />
                            ) : (
                                <WifiOff className="h-4 w-4 text-red-400 flex-shrink-0" />
                            )}
                        </div>
                    )}

                    {/* Sub-devices */}
                    {devices.length > 0 && (
                        <div className="space-y-1.5">
                            {devices.map((device) => (
                                <div key={device.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                                    <span className="text-xs text-gray-700 dark:text-gray-300">
                                        {device.name || device.label}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${device.online ? "text-green-600" : "text-gray-400"}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${device.online ? "bg-green-500" : "bg-gray-400"}`} />
                                        {device.online ? "OK" : "—"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
