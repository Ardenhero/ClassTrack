"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";
import {
    Monitor, CheckCircle2, XCircle, Clock, Wifi, WifiOff,
    DoorClosed, Tag, Trash2, Loader2, Users, Save
} from "lucide-react";
import {
    approveKiosk, rejectKiosk, assignKioskToAdmin,
    bindKioskToRoom, updateKioskLabel, deleteKiosk
} from "./actions";

interface KioskDevice {
    device_serial: string;
    status: string | null;
    assigned_admin_id: string | null;
    room_id: string | null;
    label: string | null;
    is_online: boolean;
    last_heartbeat: string | null;
    firmware_version: string | null;
    ip_address: string | null;
    approved_at: string | null;
    rooms?: { name: string; building: string | null } | null;
}

interface SystemAdmin {
    name: string;
    auth_user_id: string;
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

    const isAdmin = profile?.role === 'admin' || profile?.is_super_admin;
    const isSuperAdmin = profile?.is_super_admin;

    const [kiosks, setKiosks] = useState<KioskDevice[]>([]);
    const [systemAdmins, setSystemAdmins] = useState<SystemAdmin[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [pendingRoomBindings, setPendingRoomBindings] = useState<Record<string, string>>({});
    const [savedRoomBindings, setSavedRoomBindings] = useState<Record<string, boolean>>({});

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [kioskRes, adminsRes, roomRes] = await Promise.all([
                fetch(`/api/kiosk/heartbeat?t=${Date.now()}`, { cache: 'no-store' }),
                supabase.from('instructors').select('name, auth_user_id').eq('role', 'admin').order('name'),
                supabase.from('rooms').select('id, name, building, department_id').order('name'),
            ]);

            const kioskData = await kioskRes.json();
            setKiosks(kioskData.devices || []);
            setSystemAdmins(adminsRes.data || []);
            setRooms(roomRes.data || []);
        } catch (err) {
            console.error("Failed to load kiosk data:", err);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isAdmin) loadData();
    }, [isAdmin, loadData]);

    if (!isAdmin) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <p className="text-gray-500 dark:text-gray-400">You do not have permission to view this page.</p>
            </div>
        );
    }

    const handleApprove = async (serial: string, adminId: string | null) => {
        setActionLoading(serial);
        const res = await approveKiosk(serial, adminId);
        if (res.error) alert(`Error: ${res.error}`);
        else setKiosks(prev => prev.map(k => k.device_serial === serial ? { ...k, status: 'approved', assigned_admin_id: adminId } : k));
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

    const handleAdminAssign = async (serial: string, adminId: string) => {
        setActionLoading(serial);
        const res = await assignKioskToAdmin(serial, adminId || null);
        if (res.error) alert(`Error: ${res.error}`);
        else setKiosks(prev => prev.map(k => k.device_serial === serial ? { ...k, assigned_admin_id: adminId || null } : k));
        setActionLoading(null);
    };

    const handleRoomBind = async (serial: string) => {
        const roomId = pendingRoomBindings[serial] ?? "";
        setActionLoading(serial);
        const res = await bindKioskToRoom(serial, roomId || null);
        if (res.error) alert(`Error: ${res.error}`);
        else {
            setKiosks(prev => prev.map(k => k.device_serial === serial ? { ...k, room_id: roomId || null } : k));
            // Clear pending and show success briefly
            setPendingRoomBindings(prev => { const n = { ...prev }; delete n[serial]; return n; });
            setSavedRoomBindings(prev => ({ ...prev, [serial]: true }));
            setTimeout(() => setSavedRoomBindings(prev => { const n = { ...prev }; delete n[serial]; return n; }), 2000);
        }
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
            case 'approved': return 'bg-green-500/10 text-green-400 border-green-500/30 shadow-[inset_0_1px_2px_rgba(34,197,94,0.1)]';
            case 'rejected': return 'bg-red-500/10 text-red-400 border-red-500/30 shadow-[inset_0_1px_2px_rgba(239,68,68,0.1)]';
            default: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 shadow-[0_0_8px_rgba(234,179,8,0.15)]';
        }
    };

    return (
        <div className="flex-1 overflow-y-auto space-y-6 animate-in fade-in duration-500">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 flex items-start gap-3 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 relative z-10 group-hover:scale-110 transition-transform shadow-[inset_0_1px_2px_rgba(59,130,246,0.1)]">
                        <Monitor className="h-5 w-5 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-2xl font-bold text-white drop-shadow-md tracking-tight">{kiosks.length}</p>
                        <p className="text-xs text-gray-400 font-medium">Total Kiosks</p>
                    </div>
                </div>
                {isSuperAdmin && (
                    <div className="glass-card p-4 flex items-start gap-3 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0 relative z-10 group-hover:scale-110 transition-transform shadow-[inset_0_1px_2px_rgba(234,179,8,0.1)]">
                            <Clock className="h-5 w-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-2xl font-bold text-white drop-shadow-md tracking-tight">{pending}</p>
                            <p className="text-xs text-gray-400 font-medium">Pending Approval</p>
                        </div>
                    </div>
                )}
                {isSuperAdmin && (
                    <div className="glass-card p-4 flex items-start gap-3 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 relative z-10 group-hover:scale-110 transition-transform shadow-[inset_0_1px_2px_rgba(34,197,94,0.1)]">
                            <CheckCircle2 className="h-5 w-5 text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2">
                                <p className="text-2xl font-bold text-white drop-shadow-md tracking-tight leading-none">{approved}</p>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-bold border border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.1)]">{bound} bound</span>
                            </div>
                            <p className="text-xs text-gray-400 font-medium mt-1">Approved</p>
                        </div>
                    </div>
                )}
                <div className="glass-card p-4 flex items-start gap-3 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 relative z-10 group-hover:scale-110 transition-transform shadow-[inset_0_1px_2px_rgba(168,85,247,0.1)]">
                        <Wifi className="h-5 w-5 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-2xl font-bold text-white drop-shadow-md tracking-tight">{online}</p>
                        <p className="text-xs text-gray-400 font-medium">Online Now</p>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-white drop-shadow-md">
                        <Monitor className="h-5 w-5 text-nu-400 drop-shadow-[0_0_8px_rgba(176,42,42,0.8)]" />
                        ESP32 Kiosk Management
                    </h1>
                    <p className="text-sm text-gray-400 mt-0.5">Approve, assign, and bind ESP32 kiosks to rooms</p>
                </div>
            </div>

            {/* Kiosk List */}
            {
                loading && kiosks.length === 0 ? (
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
                                    className={`glass-panel p-5 transition-all duration-300 relative overflow-hidden group/kiosk
                                    ${isPending ? 'border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.15)] ring-1 ring-yellow-500/20' :
                                            'hover:border-white/20 hover:bg-white-[0.03]'}`}
                                >
                                    {isPending && <div className="absolute inset-0 bg-yellow-500/5 animate-pulse rounded-2xl pointer-events-none"></div>}
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-5 relative z-10">
                                        {/* Identity */}
                                        <div className="flex items-center gap-3 lg:w-1/4 min-w-0">
                                            <div className={`w-3.5 h-3.5 rounded-full shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.5)] ${kiosk.is_online ? 'bg-green-400 animate-pulse drop-shadow-[0_0_5px_rgba(74,222,128,0.8)]' : 'bg-gray-500 border border-gray-400'}`} />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-white truncate font-mono tracking-wider drop-shadow-md">
                                                    {kiosk.device_serial}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border tracking-widest ${statusColor(status)}`}>
                                                        {status}
                                                    </span>
                                                    {kiosk.is_online ? (
                                                        <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium drop-shadow-sm"><Wifi className="h-3 w-3" />Online</span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-[10px] text-gray-400"><WifiOff className="h-3 w-3 opacity-50" />{timeAgo(kiosk.last_heartbeat)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Label */}
                                        <div className="lg:w-1/6">
                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase font-black mb-1.5 tracking-wider">
                                                <Tag className="h-3 w-3 text-white/50" /> Label
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
                                                className="glass-input h-8 py-1"
                                            />
                                        </div>

                                        {/* Assigned Admin */}
                                        {isSuperAdmin && (
                                            <div className="lg:w-1/6">
                                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase font-black mb-1.5 tracking-wider">
                                                    <Users className="h-3 w-3 text-white/50" /> Assigned Admin
                                                </div>
                                                <select
                                                    value={kiosk.assigned_admin_id || ""}
                                                    onChange={(e) => handleAdminAssign(kiosk.device_serial, e.target.value)}
                                                    className="glass-input h-8 py-1"
                                                >
                                                    <option value="" className="bg-dark-surface text-gray-400">Unassigned</option>
                                                    {systemAdmins.map(admin => (
                                                        <option key={admin.auth_user_id} value={admin.auth_user_id} className="bg-dark-surface text-white">{admin.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Room Binding — System Admins only */}
                                        {!isSuperAdmin && (
                                            <div className="lg:w-1/4">
                                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase font-black mb-1.5 tracking-wider">
                                                    <DoorClosed className="h-3 w-3 text-white/50" /> Room
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={pendingRoomBindings[kiosk.device_serial] ?? kiosk.room_id ?? ""}
                                                        onChange={(e) => setPendingRoomBindings(prev => ({ ...prev, [kiosk.device_serial]: e.target.value }))}
                                                        disabled={!isApproved}
                                                        className="glass-input h-8 py-1 flex-1 disabled:opacity-50"
                                                    >
                                                        <option value="" className="bg-dark-surface text-gray-400">Unbound</option>
                                                        {rooms
                                                            .filter(r => r.department_id === profile?.department_id)
                                                            .map(r => (
                                                                <option key={r.id} value={r.id} className="bg-dark-surface text-white">{r.name}{r.building ? ` (${r.building})` : ''}</option>
                                                            ))}
                                                    </select>
                                                    {(pendingRoomBindings[kiosk.device_serial] !== undefined && pendingRoomBindings[kiosk.device_serial] !== (kiosk.room_id ?? "")) ? (
                                                        <button
                                                            onClick={() => handleRoomBind(kiosk.device_serial)}
                                                            disabled={isLoading}
                                                            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors border border-blue-500/30 uppercase tracking-widest shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.15)]"
                                                        >
                                                            <Save className="h-3.5 w-3.5" /> Save
                                                        </button>
                                                    ) : savedRoomBindings[kiosk.device_serial] ? (
                                                        <span className="flex items-center gap-1 text-[10px] text-green-400 font-bold shrink-0 uppercase tracking-widest drop-shadow-sm">
                                                            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        {isSuperAdmin && (
                                            <div className="lg:w-1/6 flex items-center gap-3 lg:justify-end">
                                                {isLoading ? (
                                                    <Loader2 className="h-4 w-4 animate-spin text-nu-400 drop-shadow-[0_0_5px_rgba(176,42,42,0.8)]" />
                                                ) : isPending ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprove(kiosk.device_serial, kiosk.assigned_admin_id)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-all border border-green-500/30 shadow-[inset_0_1px_2px_rgba(34,197,94,0.1)] hover:shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                                                        >
                                                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(kiosk.device_serial)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all border border-red-500/30 shadow-[inset_0_1px_2px_rgba(239,68,68,0.1)] hover:shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                                                        >
                                                            <XCircle className="h-3.5 w-3.5" /> Reject
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleDelete(kiosk.device_serial)}
                                                        className="p-2 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                                                        title="Delete device"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Meta row */}
                                    {kiosk.firmware_version && (
                                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-4 text-[10px] text-gray-500 font-mono tracking-wider relative z-10">
                                            <span>FW: {kiosk.firmware_version}</span>
                                            {kiosk.ip_address && <span>IP: {kiosk.ip_address}</span>}
                                            {kiosk.approved_at && <span>APVD: {new Date(kiosk.approved_at).toLocaleDateString()}</span>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            }
        </div >
    );
}
