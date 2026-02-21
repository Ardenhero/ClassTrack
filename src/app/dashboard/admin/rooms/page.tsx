"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";
import { DoorClosed, Plus, Edit2, Trash2, Save, Loader2, Wifi, AlertTriangle, Activity, X } from "lucide-react";
import { createRoom, updateRoomDetails, assignDeviceToRoom } from "./actions";

interface Room {
    id: string;
    name: string;
    building: string | null;
    capacity: number | null;
    department_id: string | null;
    status?: string;
    departments?: { name: string } | null;
}

interface Device {
    id: string;
    name: string;
    type: string;
    room_id: string | null;
}

// Device type color mapping
function getDeviceDot(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes("fan")) return "bg-blue-400";
    if (lower.includes("light") || lower.includes("lamp")) return "bg-yellow-400";
    if (lower.includes("ac") || lower.includes("air")) return "bg-cyan-400";
    if (lower.includes("kiosk")) return "bg-purple-400";
    return "bg-gray-400";
}

export default function RoomsManagementPage() {
    const { profile } = useProfile();
    const supabase = createClient();

    const [rooms, setRooms] = useState<Room[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);


    const [newRoomName, setNewRoomName] = useState("");
    const [newRoomBuilding, setNewRoomBuilding] = useState("");

    const [editName, setEditName] = useState("");
    const [editBuilding, setEditBuilding] = useState("");

    const isAdmin = profile?.role === "admin" || profile?.is_super_admin;
    const canCreateRooms = profile?.is_super_admin || profile?.role === "admin";

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: roomsData, error: roomsError } = await supabase
                .from("rooms")
                .select("*, departments(name)")
                .order("name");
            if (roomsError) throw roomsError;
            setRooms(roomsData || []);

            const { data: devicesData, error: devicesError } = await supabase
                .from("iot_devices")
                .select("id, name, type, room_id")
                .order("name");
            if (devicesError) throw devicesError;
            setDevices(devicesData || []);
        } catch (err) {
            console.error("Failed to load rooms/devices:", err);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

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

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRoomName) return;

        const fd = new FormData();
        fd.append("name", newRoomName);
        fd.append("building", newRoomBuilding);
        if (profile?.department_id) fd.append("department_id", profile.department_id);

        const res = await createRoom(fd);
        if (res && res.error) {
            alert(`Failed to create room: ${res.error}`);
            return;
        }

        setNewRoomName("");
        setNewRoomBuilding("");
        setIsCreating(false);
        loadData();
    };

    const startEditing = (room: Room) => {
        setEditingRoomId(room.id);
        setEditName(room.name);
        setEditBuilding(room.building || "");
    };

    const saveEdit = async () => {
        if (!editingRoomId || !editName) return;
        await updateRoomDetails(editingRoomId, editName, editBuilding);
        setEditingRoomId(null);
        loadData();
    };

    const handleDeviceAssignment = async (deviceId: string, roomId: string | null) => {
        try {
            // Optimistic UI update
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, room_id: roomId } : d));

            const res = await assignDeviceToRoom(deviceId, roomId);
            if (res && res.error) {
                alert(`Failed to assign device: ${res.error}`);
                loadData();
                return;
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            alert(`Exception assigning device: ${errorMessage}`);
            console.error(err);
            loadData();
        }
    };

    const handleDeleteRoom = async (roomId: string) => {
        if (!confirm("Are you sure you want to delete this room?")) return;
        // Unassign all devices from this room first
        const roomDevices = devices.filter(d => d.room_id === roomId);
        for (const device of roomDevices) {
            await assignDeviceToRoom(device.id, null);
        }
        // Delete room
        await supabase.from("rooms").delete().eq("id", roomId);
        loadData();
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full p-10 bg-transparent">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400" />
            </div>
        );
    }

    // Stats
    const totalRooms = rooms.length;
    const totalAssignedDevices = devices.filter(d => d.room_id !== null).length;
    const maintenanceRooms = rooms.filter(r => r.status === "maintenance").length;

    // Filter rooms by search
    const filteredRooms = rooms;

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <DoorClosed className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{totalRooms}</p>
                        <p className="text-xs text-gray-400">Total Rooms</p>
                    </div>
                </div>

                <div className="glass-card p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                        <Wifi className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-2xl font-bold text-white">{totalAssignedDevices}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 font-semibold shadow-[0_0_10px_rgba(34,197,94,0.2)]">Online</span>
                        </div>
                        <p className="text-xs text-gray-400">Active Devices</p>
                    </div>
                </div>

                <div className="glass-card p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-2xl font-bold text-white">{maintenanceRooms}</p>
                            {maintenanceRooms > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-semibold shadow-[0_0_10px_rgba(234,179,8,0.2)] animate-pulse">Attention</span>}
                        </div>
                        <p className="text-xs text-gray-400">Needs Maintenance</p>
                    </div>
                </div>

                <div className="glass-card p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <Activity className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{devices.length}</p>
                        <p className="text-xs text-gray-400">Total Devices</p>
                    </div>
                </div>
            </div>

            {/* Header + Add */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-white drop-shadow-md">
                        <DoorClosed className="h-5 w-5 text-nu-400 drop-shadow-[0_0_8px_rgba(176,42,42,0.8)]" />
                        Room Management
                    </h1>
                    <p className="text-sm text-gray-400 mt-0.5">Manage physical classrooms and assign IoT devices</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {canCreateRooms && (
                        <button
                            onClick={() => setIsCreating(!isCreating)}
                            className="bg-nu-500 hover:bg-nu-400 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all duration-300 text-sm font-semibold whitespace-nowrap shadow-glow-red hover:scale-105"
                        >
                            <Plus className="h-4 w-4" />
                            Create Room
                        </button>
                    )}
                </div>
            </div>

            {/* Create Room Modal */}
            {isCreating && (
                <div className="glass-panel p-6 rounded-2xl shadow-2xl relative overflow-hidden">
                    <div className="flex justify-between items-center mb-5 relative z-10">
                        <h3 className="font-bold text-white text-lg">Create New Room</h3>
                        <button onClick={() => setIsCreating(false)} className="text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <form onSubmit={handleCreateRoom} className="space-y-4 relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Room Name <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    placeholder="e.g. STC 102"
                                    className="glass-input"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Building</label>
                                <input
                                    type="text"
                                    value={newRoomBuilding}
                                    onChange={(e) => setNewRoomBuilding(e.target.value)}
                                    placeholder="e.g. CEAT"
                                    className="glass-input"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4">
                            <button type="button" onClick={() => setIsCreating(false)} className="px-5 py-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-200">Cancel</button>
                            <button type="submit" className="px-5 py-2 text-sm bg-nu-500 hover:bg-nu-400 text-white rounded-xl font-semibold transition-all duration-300 shadow-glow-red hover:scale-105">Create Room</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Room Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredRooms.length === 0 && !isCreating ? (
                    <div className="col-span-full border-2 border-dashed border-white/20 p-10 text-center rounded-2xl text-gray-500 bg-white/5 backdrop-blur-sm">
                        No rooms created yet. Click <span className="text-white">Create Room</span> to get started.
                    </div>
                ) : filteredRooms.map(room => {
                    const roomDevices = devices.filter(d => d.room_id === room.id);
                    const unassignedDevices = devices.filter(d => d.room_id === null);
                    const statusLabel = room.status === "maintenance" ? "Maintenance" : "Active";
                    const statusColor = room.status === "maintenance"
                        ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                        : "bg-green-500/10 text-green-400 border border-green-500/30";
                    const deptName = room.departments?.name || room.building || "—";
                    const MAX_VISIBLE_DEVICES = 2;
                    const hiddenCount = Math.max(0, roomDevices.length - MAX_VISIBLE_DEVICES);

                    return (
                        <div key={room.id} className="glass-card flex flex-col group">
                            {/* Card Header */}
                            <div className="p-5 pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        {editingRoomId === room.id ? (
                                            <div className="space-y-2 pr-2">
                                                <input
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full text-lg font-bold glass-input py-1.5"
                                                    autoFocus
                                                />
                                                <input
                                                    value={editBuilding}
                                                    onChange={(e) => setEditBuilding(e.target.value)}
                                                    placeholder="Building"
                                                    className="w-full text-sm glass-input py-1.5 text-gray-400"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-lg text-white truncate drop-shadow-sm">{room.name}</h3>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${statusColor}`}>
                                                        {statusLabel}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                                                    <DoorClosed className="h-3.5 w-3.5 opacity-70" />
                                                    {deptName}
                                                </p>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1 ml-2 shrink-0">
                                        {editingRoomId === room.id ? (
                                            <>
                                                <button onClick={saveEdit} className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors border border-transparent hover:border-green-500/30 shadow-sm" title="Save">
                                                    <Save className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => setEditingRoomId(null)} className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Cancel">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => startEditing(room)} className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition opacity-0 group-hover:opacity-100" title="Edit">
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => handleDeleteRoom(room.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition opacity-0 group-hover:opacity-100" title="Delete">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Devices Section */}
                            <div className="px-5 pb-5 flex-1 flex flex-col relative z-10">
                                <div className="flex items-center justify-between mb-3 mt-1">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Assigned Devices</h4>
                                    <span className="text-[10px] text-gray-400 font-medium bg-white/5 px-2 py-0.5 rounded-full">{roomDevices.length}</span>
                                </div>

                                <div className="space-y-2 flex-1">
                                    {roomDevices.length === 0 && (
                                        <p className="text-xs text-gray-600 italic py-2">No devices assigned.</p>
                                    )}
                                    {roomDevices.slice(0, MAX_VISIBLE_DEVICES).map(device => (
                                        <div key={device.id} className="flex items-center justify-between bg-dark-bg/50 p-2.5 rounded-xl border border-white/5 group/device hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <span className={`w-2 h-2 rounded-full shrink-0 shadow-[0_0_5px_currentColor] ${getDeviceDot(device.name)}`} />
                                                <div className="min-w-0 pr-2">
                                                    <p className="text-sm font-medium text-gray-300 truncate">{device.name}</p>
                                                    <p className="text-[10px] text-gray-500 font-mono">ID: {device.id.substring(0, 8).toUpperCase()}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeviceAssignment(device.id, null)}
                                                className="text-[10px] font-semibold text-red-500/70 hover:text-red-400 hover:bg-red-500/10 px-2 py-1 rounded transition-colors opacity-0 group-hover/device:opacity-100 shrink-0"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                    {hiddenCount > 0 && (
                                        <div className="text-center py-1.5 rounded-xl bg-dark-bg/30 border border-white/5">
                                            <p className="text-[10px] font-medium text-gray-500">+ {hiddenCount} more device{hiddenCount !== 1 ? "s" : ""}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Assign Device Dropdown */}
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) handleDeviceAssignment(e.target.value, room.id);
                                        }}
                                        value=""
                                        className="w-full text-xs p-2 bg-transparent border border-dashed border-white/10 rounded-xl text-gray-500 outline-none hover:border-white/30 hover:text-gray-300 hover:bg-white/5 cursor-pointer transition-all duration-200"
                                    >
                                        <option value="" disabled className="bg-dark-surface text-gray-400">+ Assign existing device</option>
                                        {unassignedDevices.map(device => (
                                            <option key={device.id} value={device.id} className="bg-dark-surface text-gray-200">
                                                {device.type === 'KIOSK' ? '[KIOSK] ' : ''}{device.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Add New Room Card */}
                {canCreateRooms && !isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="glass-card border-dashed hover:border-white/30 flex flex-col items-center justify-center py-12 cursor-pointer group min-h-[200px]"
                    >
                        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3 group-hover:bg-nu-500/10 group-hover:border-nu-500/30 group-hover:scale-110 group-hover:shadow-glow-red transition-all duration-300">
                            <Plus className="h-6 w-6 text-gray-500 group-hover:text-nu-400 transition-colors" />
                        </div>
                        <p className="text-sm font-semibold text-gray-400 group-hover:text-white transition-colors">Create Room</p>
                        <p className="text-xs text-gray-500 mt-1 opacity-70">Add a new physical space</p>
                    </button>
                )}
            </div>
        </div>
    );
}
