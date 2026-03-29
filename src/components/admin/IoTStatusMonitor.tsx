"use client";

import { useState, useEffect } from "react";
import { Activity, RefreshCw, Zap, ShieldCheck, Wifi, Clock } from "lucide-react";
import useSWR from "swr";
import { useSmartPolling } from "@/hooks/useSmartPolling";

interface DeviceStatus {
    id: string;
    label: string;
    online: boolean;
    name: string;
    source: 'cache' | 'tuya' | 'quota-saver';
    error?: string;
}

interface IoTStatusResponse {
    success: boolean;
    isLive: boolean;
    source: 'cache' | 'tuya' | 'quota-saver';
    message?: string;
    gateway: {
        id: string;
        online: boolean;
        name: string;
        error?: string;
    };
    devices: DeviceStatus[];
}

export function IoTStatusMonitor() {
    const [cooldown, setCooldown] = useState(0);
    const [isForcing, setIsForcing] = useState(false);

    const fetcher = (url: string) => fetch(url).then(res => res.json());

    const { data, mutate, isValidating } = useSWR<IoTStatusResponse>(
        '/api/iot/status',
        fetcher,
        {
            revalidateOnFocus: false,
        }
    );

    // 30-minute smart polling — stops when tab is hidden, resumes on focus
    useSmartPolling(() => { mutate(); }, 1800_000);

    // Cooldown timer logic
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const handleForceRefresh = async () => {
        if (cooldown > 0 || isForcing) return;

        setIsForcing(true);
        try {
            await mutate(fetcher('/api/iot/status?force=true'), {
                revalidate: true,
            });
            setCooldown(30); // 30 second safety cooldown
        } catch (err) {
            console.error("Force refresh failed", err);
        } finally {
            setIsForcing(false);
        }
    };

    if (!data) return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 animate-pulse">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="h-20 bg-gray-100 dark:bg-gray-900/50 rounded-xl"></div>
        </div>
    );

    const isQuotaSaver = data.source === 'quota-saver';

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 dark:border-gray-700/50 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/20">
                <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-nwu-red" />
                    <h3 className="font-bold text-gray-900 dark:text-white">IoT Infrastructure Health</h3>
                </div>

                <button
                    onClick={handleForceRefresh}
                    disabled={cooldown > 0 || isForcing || isValidating}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${cooldown > 0
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm"
                        }`}
                >
                    {isForcing || isValidating ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {cooldown > 0 ? `Wait ${cooldown}s` : "Force Refresh"}
                </button>
            </div>

            <div className="p-6">
                {/* Gateway Status Card */}
                <div className={`mb-6 p-4 rounded-xl border relative overflow-hidden ${isQuotaSaver
                        ? "bg-amber-50/50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30"
                        : data.gateway.online
                            ? "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30"
                            : "bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30"
                    }`}>
                    <div className="flex items-start justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${isQuotaSaver ? "bg-amber-100 text-amber-600" : data.gateway.online ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                                }`}>
                                <Wifi className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    {data.gateway.name}
                                    {isQuotaSaver && (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] uppercase font-black tracking-tighter">
                                            Quota-Saver Active
                                        </span>
                                    )}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{data.gateway.id}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`text-xs font-black uppercase tracking-widest ${isQuotaSaver ? "text-amber-600" : data.gateway.online ? "text-emerald-600" : "text-red-600"
                                }`}>
                                {isQuotaSaver ? "Sleeping" : data.gateway.online ? "Live & Online" : "Offline"}
                            </span>
                            {isQuotaSaver && (
                                <p className="text-[10px] text-amber-500 mt-1 font-medium">Auto-polling paused until 7:00 AM</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sub-devices Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.devices.map((device) => (
                        <div key={device.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/50">
                            <div className="flex items-center gap-3">
                                <Zap className={`h-4 w-4 ${device.online ? "text-yellow-500" : "text-gray-300"}`} />
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{device.name}</p>
                                    <p className="text-[10px] text-gray-400 font-mono truncate">{device.id}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${device.online ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-400"}`}></span>
                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">
                                    {device.online ? "Online" : "Offline"}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Metrics / Quota Info */}
                <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-700 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        Next Background Poll: ~30m
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-500">
                        <ShieldCheck className="h-3 w-3" />
                        Priority Sync: Enabled
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                        Data Source: <span className={isQuotaSaver ? "text-amber-500" : "text-indigo-500"}>{data.source}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
