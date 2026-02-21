"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";
import {
    Monitor, CheckCircle2, XCircle, Clock, Wifi, WifiOff,
    Building2, DoorClosed, Tag, Trash2, Loader2, RefreshCw
} from "lucide-react";
import {
    approveKiosk, rejectKiosk, assignKioskDepartment,
    bindKioskToRoom, updateKioskLabel, deleteKiosk
} from "./actions";

interface KioskDevice {
    device_serial: string;
    status: string | null;
    department_id: string | null;
    room_id: string | null;
    label: string | null;
    is_online: boolean;
    last_heartbeat: string | null;
    firmware_version: string | null;
    ip_address: string | null;
    approved_at: string | null;
    rooms?: { name: string; building: string | null } | null;
    departments?: { name: string } | null;
}

interface Department {
    id: string;
    name: string;
}

interface Room {
    id: string;
    name: string;
    building: string | null;
    department_id: string | null;
}

export default function KioskInventoryPage() {
    const { profile } = useProfile();
    const supabase = createClient();

    const [kiosks, setKiosks] = useState<KioskDevice[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const isSuperAdmin = profile?.is_super_admin;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Use service role via API to bypass RLS for super admin
            const [kioskRes, deptRes, roomRes] = await Promise.all([
                fetch('/api/kiosk/heartbeat'),
                supabase.from('departments').select('id, name').order('name'),
                supabase.from('rooms').select('id, name, building, department_id').order('name'),
            ]);

            const kioskData = await kioskRes.json();
            setKiosks(kioskData.devices || []);
            setDepartments(deptRes.data || []);
            setRooms(roomRes.data || []);
        } catch (err) {
            console.error("Failed to load kiosk data:", err);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        if (isSuperAdmin) loadData();
    }, [isSuperAdmin, loadData]);

    if (!isSuperAdmin) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <p className="text-gray-500 dark:text-gray-400">You do not have permission to view this page.</p>
            </div>
        );
    }

    const handleApprove = async (serial: string, deptId: string | null) => {
        setActionLoading(serial);
        const res = await approveKiosk(serial, deptId);
        if (res.error) alert(`Error: ${res.error}`);
        else setKiosks(prev => prev.map(k => k.device_serial === serial ? { ...k, status: 'approved', department_id: deptId } : k));
        setActionLoading(null);
    };

    const handleReject = async (serial: string) => {
        if (!confirm(`Reject device ${serial}?`)) return;
        setActionLoading(serial);
        const res = await rejectKiosk(serial);
        if (res.error) alert(`Error: ${res.error}`);
        else setKiosks(prev => prev.map(k => k.device_serial === serial ? { ...k, status: 'rejected' } : k));
        setActionLoading(null);
    };

    const handleDeptChange = async (serial: string, deptId: string) => {
        setActionLoading(serial);
        const res = await assignKioskDepartment(serial, deptId || null);
        if (res.error) alert(`Error: ${res.error}`);
        else setKiosks(prev => prev.map(k => k.device_serial === serial ? { ...k, department_id: deptId || null } : k));
        setActionLoading(null);
    };

    const handleRoomBind = async (serial: string, roomId: string) => {
        setActionLoading(serial);
        const res = await bindKioskToRoom(serial, roomId || null);
        if (res.error) alert(`Error: ${res.error}`);
        else setKiosks(prev => prev.map(k => k.device_serial === serial ? { ...k, room_id: roomId || null } : k));
        setActionLoading(null);
    };

    const handleLabelSave = async (serial: string, label: string) => {
        const res = await updateKioskLabel(serial, label);
        if (res.error) alert(`Error: ${res.error}`);
        else setKiosks(prev => prev.map(k => k.device_serial === serial ? { ...k, label } : k));
    };

    const handleDelete = async (serial: string) => {
        if (!confirm(`Permanently delete device ${serial}? This cannot be undone.`)) return;
        setActionLoading(serial);
        const res = await deleteKiosk(serial);
        if (res.error) alert(`Error: ${res.error}`);
        else setKiosks(prev => prev.filter(k => k.device_serial !== serial));
        setActionLoading(null);
    };

    const timeAgo = (ts: string | null) => {
        if (!ts) return "Never";
        const diff = Date.now() - new Date(ts).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    // Stats
    const pending = kiosks.filter(k => (k.status || 'pending') === 'pending').length;
    const approved = kiosks.filter(k => k.status === 'approved').length;
    const online = kiosks.filter(k => k.is_online).length;
    const bound = kiosks.filter(k => k.room_id).length;

    const statusColor = (s: string | null) => {
        switch (s) {
            case 'approved': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        }
    };

    return (
        <div className="flex-1 overflow-y-auto space-y-6 animate-in fade-in duration-500">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Monitor className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{kiosks.length}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Kiosks</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
                        <Clock className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{pending}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Pending Approval</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{approved}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold">{bound} bound</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">Approved</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                        <Wifi className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{online}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Online Now</p>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                        <Monitor className="h-5 w-5 text-nwu-red" />
                        ESP32 Kiosk Management
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Approve, assign, and bind ESP32 kiosks to rooms</p>
                </div>
                <button
                    onClick={loadData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Kiosk List */}
            {loading && kiosks.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            ) : kiosks.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
                    No kiosks registered yet. Connect an ESP32 and it will appear here automatically.
                </div>
            ) : (
                <div className="space-y-3">
                    {kiosks.map(kiosk => {
                        const isLoading = actionLoading === kiosk.device_serial;
                        const status = kiosk.status || 'pending';
                        const isPending = status === 'pending';
                        const isApproved = status === 'approved';

                        return (
                            <div
                                key={kiosk.device_serial}
                                className={`bg-white dark:bg-gray-800 rounded-xl border p-5 transition-all
                                    ${isPending ? 'border-yellow-300 dark:border-yellow-700 ring-1 ring-yellow-200 dark:ring-yellow-800' :
                                        'border-gray-200 dark:border-gray-700'}`}
                            >
                                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                    {/* Identity */}
                                    <div className="flex items-center gap-3 lg:w-1/4 min-w-0">
                                        <div className={`w-3 h-3 rounded-full shrink-0 ${kiosk.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate font-mono">
                                                {kiosk.device_serial}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${statusColor(status)}`}>
                                                    {status}
                                                </span>
                                                {kiosk.is_online ? (
                                                    <span className="flex items-center gap-1 text-[10px] text-green-500"><Wifi className="h-3 w-3" />Online</span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[10px] text-gray-400"><WifiOff className="h-3 w-3" />{timeAgo(kiosk.last_heartbeat)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Label */}
                                    <div className="lg:w-1/6">
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase font-bold mb-1">
                                            <Tag className="h-3 w-3" /> Label
                                        </div>
                                        <input
                                            type="text"
                                            defaultValue={kiosk.label || ""}
                                            placeholder="e.g. STC 102 Kiosk"
                                            onBlur={(e) => {
                                                if (e.target.value !== (kiosk.label || "")) {
                                                    handleLabelSave(kiosk.device_serial, e.target.value);
                                                }
                                            }}
                                            className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent focus:border-nwu-red outline-none transition text-gray-900 dark:text-white"
                                        />
                                    </div>

                                    {/* Department */}
                                    <div className="lg:w-1/6">
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase font-bold mb-1">
                                            <Building2 className="h-3 w-3" /> Department
                                        </div>
                                        <select
                                            value={kiosk.department_id || ""}
                                            onChange={(e) => handleDeptChange(kiosk.device_serial, e.target.value)}
                                            className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent focus:border-nwu-red outline-none cursor-pointer transition text-gray-900 dark:text-white"
                                        >
                                            <option value="">Unassigned</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Room Binding */}
                                    <div className="lg:w-1/6">
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase font-bold mb-1">
                                            <DoorClosed className="h-3 w-3" /> Room
                                        </div>
                                        <select
                                            value={kiosk.room_id || ""}
                                            onChange={(e) => handleRoomBind(kiosk.device_serial, e.target.value)}
                                            disabled={!isApproved}
                                            className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent focus:border-nwu-red outline-none cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white"
                                        >
                                            <option value="">Unbound</option>
                                            {rooms
                                                .filter(r => !kiosk.department_id || r.department_id === kiosk.department_id || !r.department_id)
                                                .map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}{r.building ? ` (${r.building})` : ''}</option>
                                                ))}
                                        </select>
                                    </div>

                                    {/* Actions */}
                                    <div className="lg:w-1/6 flex items-center gap-2 lg:justify-end">
                                        {isLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                        ) : isPending ? (
                                            <>
                                                <button
                                                    onClick={() => handleApprove(kiosk.device_serial, kiosk.department_id)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-green-500/10 text-green-600 rounded-lg hover:bg-green-500/20 transition border border-green-500/20"
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                                </button>
                                                <button
                                                    onClick={() => handleReject(kiosk.device_serial)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition border border-red-500/20"
                                                >
                                                    <XCircle className="h-3.5 w-3.5" /> Reject
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleDelete(kiosk.device_serial)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                                title="Delete device"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Meta row */}
                                {kiosk.firmware_version && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4 text-[10px] text-gray-400">
                                        <span>FW: {kiosk.firmware_version}</span>
                                        {kiosk.ip_address && <span>IP: {kiosk.ip_address}</span>}
                                        {kiosk.approved_at && <span>Approved: {new Date(kiosk.approved_at).toLocaleDateString()}</span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
