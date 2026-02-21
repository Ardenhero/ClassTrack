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
        const res = await assignDeviceToRoom(deviceId, roomId);
        if (res && res.error) {
            alert(`Failed to assign device: ${res.error}`);
            return;
        }
        loadData();
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
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                        <DoorClosed className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalRooms}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Rooms</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                        <Wifi className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAssignedDevices}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold">Online</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Active Devices</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{maintenanceRooms}</p>
                            {maintenanceRooms > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-semibold">Attention</span>}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Needs Maintenance</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                        <Activity className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{devices.length}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Devices</p>
                    </div>
                </div>
            </div>

            {/* Header + Add */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                        <DoorClosed className="h-5 w-5 text-nwu-red" />
                        Room Management
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage physical classrooms and assign IoT devices</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {canCreateRooms && (
                        <button
                            onClick={() => setIsCreating(!isCreating)}
                            className="bg-nwu-red hover:bg-red-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm font-semibold whitespace-nowrap shadow-sm"
                        >
                            <Plus className="h-4 w-4" />
                            Create Room
                        </button>
                    )}
                </div>
            </div>

            {/* Create Room Modal */}
            {isCreating && (
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-900 dark:text-white">Create New Room</h3>
                        <button onClick={() => setIsCreating(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white transition">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <form onSubmit={handleCreateRoom} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-[#a8adc4] mb-1">Room Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    placeholder="e.g. STC 102"
                                    className="w-full bg-[#12151f] border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-gray-900 dark:text-white placeholder-[#6b7094] outline-none focus:ring-1 focus:ring-nwu-red/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#a8adc4] mb-1">Building</label>
                                <input
                                    type="text"
                                    value={newRoomBuilding}
                                    onChange={(e) => setNewRoomBuilding(e.target.value)}
                                    placeholder="e.g. CEAT"
                                    className="w-full bg-[#12151f] border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-gray-900 dark:text-white placeholder-[#6b7094] outline-none focus:ring-1 focus:ring-nwu-red/50"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-sm text-[#a8adc4] hover:bg-[#242840] rounded-lg transition">Cancel</button>
                            <button type="submit" className="px-4 py-2 text-sm bg-nwu-red hover:bg-red-800 text-white rounded-lg font-semibold transition">Create Room</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Room Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredRooms.length === 0 && !isCreating ? (
                    <div className="col-span-full border-2 border-dashed border-gray-200 dark:border-gray-700 p-10 text-center rounded-xl text-gray-500 dark:text-gray-400">
                        No rooms created yet. Click &quot;Create Room&quot; to get started.
                    </div>
                ) : filteredRooms.map(room => {
                    const roomDevices = devices.filter(d => d.room_id === room.id);
                    const unassignedDevices = devices.filter(d => d.room_id === null);
                    const statusLabel = room.status === "maintenance" ? "Maintenance" : "Active";
                    const statusColor = room.status === "maintenance"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-green-500/20 text-green-400";
                    const deptName = room.departments?.name || room.building || "—";
                    const MAX_VISIBLE_DEVICES = 2;
                    const hiddenCount = Math.max(0, roomDevices.length - MAX_VISIBLE_DEVICES);

                    return (
                        <div key={room.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col hover:border-gray-300 dark:hover:border-gray-600 transition-all group">
                            {/* Card Header */}
                            <div className="p-5 pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        {editingRoomId === room.id ? (
                                            <div className="space-y-2 pr-2">
                                                <input
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full text-lg font-bold bg-[#12151f] border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-nwu-red/50"
                                                />
                                                <input
                                                    value={editBuilding}
                                                    onChange={(e) => setEditBuilding(e.target.value)}
                                                    placeholder="Building"
                                                    className="w-full text-sm bg-[#12151f] border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-[#a8adc4] outline-none focus:ring-1 focus:ring-nwu-red/50"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">{room.name}</h3>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${statusColor}`}>
                                                        {statusLabel}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                                                    <DoorClosed className="h-3 w-3" />
                                                    {deptName}
                                                </p>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1 ml-2 shrink-0">
                                        {editingRoomId === room.id ? (
                                            <>
                                                <button onClick={saveEdit} className="p-1.5 text-green-400 hover:bg-green-500/10 rounded transition" title="Save">
                                                    <Save className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => setEditingRoomId(null)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-[#242840] rounded transition" title="Cancel">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => startEditing(room)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition opacity-0 group-hover:opacity-100" title="Edit">
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => handleDeleteRoom(room.id)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition opacity-0 group-hover:opacity-100" title="Delete">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Devices Section */}
                            <div className="px-5 pb-5 flex-1 flex flex-col">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[11px] font-bold text-[#a8adc4] uppercase tracking-wider">Assigned Devices</h4>
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{roomDevices.length} device{roomDevices.length !== 1 ? "s" : ""}</span>
                                </div>

                                <div className="space-y-2 flex-1">
                                    {roomDevices.length === 0 && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 italic py-2">No devices assigned.</p>
                                    )}
                                    {roomDevices.slice(0, MAX_VISIBLE_DEVICES).map(device => (
                                        <div key={device.id} className="flex items-center justify-between bg-[#12151f] p-2.5 rounded-lg border border-[rgba(255,255,255,0.05)] group/device">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${getDeviceDot(device.name)}`} />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{device.name}</p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">ID: {device.id.substring(0, 8).toUpperCase()}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeviceAssignment(device.id, null)}
                                                className="text-[10px] text-red-400 hover:text-red-300 opacity-0 group-hover/device:opacity-100 transition px-1 shrink-0"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                    {hiddenCount > 0 && (
                                        <div className="text-center py-1.5 rounded-lg bg-[#12151f] border border-[rgba(255,255,255,0.05)]">
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400">+ {hiddenCount} more device{hiddenCount !== 1 ? "s" : ""}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Assign Device Button */}
                                <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.05)]">
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) handleDeviceAssignment(e.target.value, room.id);
                                        }}
                                        value=""
                                        className="w-full text-xs p-2 bg-transparent border border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 outline-none hover:border-gray-300 dark:border-gray-600 hover:text-[#a8adc4] cursor-pointer transition"
                                    >
                                        <option value="" disabled>+ Assign existing device</option>
                                        {unassignedDevices.map(device => (
                                            <option key={device.id} value={device.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
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
                        className="bg-[#12151f] rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center py-12 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-white dark:bg-gray-800/50 transition-all cursor-pointer group min-h-[200px]"
                    >
                        <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-3 group-hover:bg-nwu-red/10 group-hover:border-nwu-red/30 transition">
                            <Plus className="h-6 w-6 text-gray-500 dark:text-gray-400 group-hover:text-nwu-red transition" />
                        </div>
                        <p className="text-sm font-semibold text-[#a8adc4] group-hover:text-gray-900 dark:text-white transition">Create Room</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Create a new classroom space</p>
                    </button>
                )}
            </div>
        </div>
    );
}
