"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Wifi, WifiOff, RefreshCw, Radio, MapPin, Cpu, Check, Loader2, X } from "lucide-react";
import { bindKioskToRoom } from "@/app/dashboard/admin/kiosks/actions";
import { useSmartPolling } from "@/hooks/useSmartPolling";

interface KioskDevice {
    id: string;
    device_serial: string;
    name: string;
    label: string | null;
    is_online: boolean;
    last_heartbeat: string | null;
    firmware_version: string | null;
    ip_address: string | null;
    rooms: { name: string; building: string | null } | null;
}

interface Room {
    id: string;
    name: string;
}

export function KioskHealthCard() {
    const [devices, setDevices] = useState<KioskDevice[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [pingingDevice, setPingingDevice] = useState<string | null>(null);
    const [pingResult, setPingResult] = useState<{ serial: string; status: "sent" | "error" } | null>(null);
    const [selectedDevice, setSelectedDevice] = useState<KioskDevice | null>(null);
    const [isReassigning, setIsReassigning] = useState(false);
    const [newRoomId, setNewRoomId] = useState<string>("");
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchDevices = useCallback(async () => {
        try {
            const res = await fetch("/api/kiosk/heartbeat");
            const data = await res.json();

            // Computed Online Status (5 minute buffer for 2-minute heartbeats)
            const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
            const processedDevices = (data.devices || []).map((d: KioskDevice) => ({
                ...d,
                is_online: d.last_heartbeat ? new Date(d.last_heartbeat).getTime() > fiveMinsAgo : false
            }));

            setDevices(processedDevices);
        } catch (err) {
            console.error("[KioskHealth] Fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchRooms = useCallback(async () => {
        try {
            const res = await fetch("/api/iot/control");
            const data = await res.json();
            setRooms(data.rooms || []);
        } catch (err) {
            console.error("[KioskHealth] Fetch rooms error:", err);
        }
    }, []);

    useEffect(() => {
        fetchDevices();
        fetchRooms();
    }, [fetchDevices, fetchRooms]);

    // 15-minute smart polling — stops when tab is hidden, resumes on focus
    useSmartPolling(fetchDevices, 900_000);

    // Handle clicking outside the selected device area to dismiss
    useEffect(() => {
        if (!selectedDevice) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedDevice(null);
                setIsReassigning(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedDevice]);

    const handlePing = async (deviceSerial: string) => {
        setPingingDevice(deviceSerial);
        setPingResult(null);
        try {
            const res = await fetch("/api/kiosk/ping", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ device_serial: deviceSerial, command: "ping" }),
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
            setTimeout(() => setPingResult(null), 5000);
        }
    };

    const handleReassign = async () => {
        if (!selectedDevice || !newRoomId) return;
        setIsUpdating(true);
        try {
            const res = await bindKioskToRoom(selectedDevice.device_serial, newRoomId);
            if (res.success) {
                await fetchDevices();
                setIsReassigning(false);
                setNewRoomId("");
                setSelectedDevice(null);
            } else {
                alert("Error: " + res.error);
            }
        } catch (err) {
            console.error("Reassign error:", err);
            alert("Failed to reassign node");
        } finally {
            setIsUpdating(false);
        }
    };

    const onlineCount = useMemo(() => devices.filter(d => d.is_online).length, [devices]);
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

            <div className={`p-4 transition-all duration-300 ${selectedDevice ? 'pb-2' : ''}`}>
                {devices.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl">
                        <WifiOff className="h-8 w-8 text-gray-300 mb-2" />
                        <p className="text-xs font-semibold text-gray-400">No sensors mapped</p>
                    </div>
                )}

                {loading && devices.length === 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 animate-pulse">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="aspect-square bg-gray-100 dark:bg-gray-700/50 rounded-lg"></div>
                        ))}
                    </div>
                )}

                {/* SENSOR MEMORY MAP GRID */}
                {devices.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {devices.map((device, index) => {
                            const isSelected = selectedDevice?.id === device.id;
                            return (
                                <button
                                    key={device.id}
                                    onClick={() => {
                                        setSelectedDevice(isSelected ? null : device);
                                        setIsReassigning(false);
                                    }}
                                    className={`
                                        aspect-square rounded-lg flex flex-col items-center justify-center p-1 relative
                                        transition-all duration-200 overflow-hidden group
                                        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800 scale-105 z-10' : 'hover:scale-105'}
                                        ${device.is_online
                                            ? 'bg-gradient-to-br from-green-400 to-emerald-600 shadow-sm'
                                            : 'bg-red-50 dark:bg-red-900/20 border-2 border-dashed border-red-300 dark:border-red-700'
                                        }
                                    `}
                                >
                                    <span className="text-[10px] font-mono font-bold opacity-50 absolute top-1 left-1.5 text-white mix-blend-overlay">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    {device.is_online ? (
                                        <Radio className="h-4 w-4 text-white drop-shadow-sm mb-0.5" />
                                    ) : (
                                        <WifiOff className="h-4 w-4 text-red-500/50 mb-0.5" />
                                    )}
                                    <span className={`text-[9px] font-bold truncate w-full text-center px-0.5 ${device.is_online ? 'text-white' : 'text-red-700 dark:text-red-400'}`}>
                                        {device.rooms?.name || 'Unassigned'}
                                    </span>
                                </button>
                            );
                        })}

                        {/* Empty Slots to fill out the grid visually */}
                        {Array.from({ length: Math.max(0, 8 - (devices.length % 8 || 8)) }).map((_, i) => (
                            <div key={`empty-${i}`} className="aspect-square rounded-lg border-2 border-dashed border-gray-100 dark:border-gray-700/50 flex items-center justify-center">
                                <span className="text-gray-300 dark:text-gray-600">·</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* EXPANDED DIAGNOSTIC PANEL FOR SELECTED NODE */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${selectedDevice ? 'max-h-80 opacity-100 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80' : 'max-h-0 opacity-0'}`}>
                {selectedDevice && (
                    <div className="p-4 relative">
                        <button
                            onClick={() => {
                                setSelectedDevice(null);
                                setIsReassigning(false);
                            }}
                            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xs font-bold p-2 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div className="flex items-start gap-3 mb-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${selectedDevice.is_online ? 'bg-green-100 text-green-600 dark:bg-green-900/50' : 'bg-red-100 text-red-600 dark:bg-red-900/50'}`}>
                                {selectedDevice.is_online ? <Cpu className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                                    {selectedDevice.label || selectedDevice.name}
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${selectedDevice.is_online ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {selectedDevice.is_online ? 'SYNCED' : 'OFFLINE'}
                                    </span>
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                                    SN: {selectedDevice.device_serial}
                                </p>
                            </div>
                        </div>

                        {isReassigning ? (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select New Location</label>
                                    <select
                                        value={newRoomId}
                                        onChange={(e) => setNewRoomId(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red transition-all"
                                    >
                                        <option value="">-- Select Room --</option>
                                        {rooms.map(room => (
                                            <option key={room.id} value={room.id}>{room.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsReassigning(false)}
                                        className="flex-1 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleReassign}
                                        disabled={!newRoomId || isUpdating}
                                        className="flex-[2] bg-nwu-red text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-red-700 transition-colors"
                                    >
                                        {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                        Confirm Move
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-4">
                                    <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1">
                                        <span className="text-gray-500">Location</span>
                                        <span className="font-semibold">{selectedDevice.rooms?.name || 'Unassigned Center'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1">
                                        <span className="text-gray-500">Firmware</span>
                                        <span className="font-mono">{selectedDevice.firmware_version ? `v${selectedDevice.firmware_version}` : 'Unknown'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1">
                                        <span className="text-gray-500">IP Addr</span>
                                        <span className="font-mono">{selectedDevice.ip_address || '---.---.---.---'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1">
                                        <span className="text-gray-500">Last Seen</span>
                                        <span className="font-medium text-amber-600">{timeAgo(selectedDevice.last_heartbeat)}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePing(selectedDevice.device_serial)}
                                        disabled={pingingDevice === selectedDevice.device_serial}
                                        className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold py-1.5 rounded-lg transition-colors border ${pingResult?.serial === selectedDevice.device_serial
                                            ? pingResult.status === "sent"
                                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        <Radio className={`h-3.5 w-3.5 ${pingingDevice === selectedDevice.device_serial ? 'animate-ping' : ''}`} />
                                        {pingResult?.serial === selectedDevice.device_serial
                                            ? (pingResult.status === "sent" ? "Ping Sent" : "Ping Failed")
                                            : "Send Ping"
                                        }
                                    </button>
                                    <button
                                        onClick={() => setIsReassigning(true)}
                                        className="flex-1 flex items-center justify-center gap-2 text-xs font-bold py-1.5 rounded-lg bg-nwu-red text-white hover:bg-red-700 transition-colors"
                                    >
                                        <MapPin className="h-3.5 w-3.5" />
                                        Reassign Node
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
