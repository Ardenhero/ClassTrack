"use client";

import { useState, useCallback } from "react";
import { createClient } from "../../../../utils/supabase/client";
import { DoorClosed, Plus, Edit2, Trash2, Save, Wifi, WifiOff, Activity, X } from "lucide-react";
import { createRoom, updateRoomDetails, assignDeviceToRoom, toggleRoomAuthorization } from "./actions";
// import { ConfirmationModal } from "../../../../components/ConfirmationModal";
import dynamic from "next/dynamic";

const DynamicConfirmationModal = dynamic(() => import("../../../../components/ConfirmationModal").then(m => m.ConfirmationModal), { ssr: false });

interface AdminUser {
    id: string;
    name: string;
    assigned_room_ids: string[] | null;
}

interface Room {
    id: string;
    name: string;
    building: string | null;
    capacity: number | null;
    status?: string;
}

interface Device {
    id: string;
    name: string;
    type: string;
    room_id: string | null;
    online: boolean;
}

function getDeviceDot(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes("fan")) return "bg-blue-400";
    if (lower.includes("light") || lower.includes("lamp")) return "bg-yellow-400";
    if (lower.includes("ac") || lower.includes("air")) return "bg-cyan-400";
    if (lower.includes("kiosk")) return "bg-purple-400";
    return "bg-gray-400";
}

export default function RoomsClient({
    initialRooms,
    initialDevices,
    initialAdmins,
    profile,
    canManageRooms
}: {
    initialRooms: Room[],
    initialDevices: Device[],
    initialAdmins: AdminUser[],
    profile: { id: string, name?: string, department_id?: string } | null,
    canManageRooms: boolean
}) {
    const supabase = createClient();
    const [rooms, setRooms] = useState<Room[]>(initialRooms);
    const [devices, setDevices] = useState<Device[]>(initialDevices);
    const [admins, setAdmins] = useState<AdminUser[]>(initialAdmins);
    const [isCreating, setIsCreating] = useState(false);
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
    const [expandedRoomIds, setExpandedRoomIds] = useState<Set<string>>(new Set());

    const [newRoomName, setNewRoomName] = useState("");
    const [newRoomBuilding, setNewRoomBuilding] = useState("");

    const [editName, setEditName] = useState("");
    const [editBuilding, setEditBuilding] = useState("");
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant: "danger" | "warning";
    }>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
        variant: "danger"
    });

    const refreshData = useCallback(async () => {
        // Re-fetch data on mutation (simplified for reliability)
        const { data: roomsData } = await supabase.from("rooms").select("id, name, status, last_check, created_at, building, capacity").order("name");
        const { data: devicesData } = await supabase.from("iot_devices").select("id, name, type, room_id, online").order("name");

        if (roomsData) setRooms(roomsData);
        if (devicesData) setDevices(devicesData);
    }, [supabase]);

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
        refreshData();
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
        refreshData();
    };

    const handleDeviceAssignment = async (deviceId: string, roomId: string | null) => {
        try {
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, room_id: roomId } : d));
            const res = await assignDeviceToRoom(deviceId, roomId);
            if (res && res.error) {
                alert(`Failed to assign device: ${res.error}`);
                refreshData();
            }
        } catch (err) {
            alert(`Exception assigning device: ${err}`);
            refreshData();
        }
    };

    const handleRoomAdminToggle = async (roomId: string, adminId: string, isAuthorized: boolean) => {
        try {
            const res = await toggleRoomAuthorization(roomId, adminId, isAuthorized);
            if (res && res.error) {
                alert(`Failed to update authorization: ${res.error}`);
            }
            // Update local state for immediate feedback
            setAdmins(prev => prev.map(a => {
                if (a.id === adminId) {
                    const roomIds = a.assigned_room_ids || [];
                    return {
                        ...a,
                        assigned_room_ids: isAuthorized
                            ? [...roomIds, roomId]
                            : roomIds.filter(id => id !== roomId)
                    };
                }
                return a;
            }));
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteRoom = async (roomId: string) => {
        setConfirmConfig({
            isOpen: true,
            title: "Delete Room",
            message: "Are you sure you want to delete this room? This will unassign all devices currently in this room.",
            variant: "danger",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                await supabase.from("rooms").delete().eq("id", roomId);
                refreshData();
            }
        });
    };

    const totalRooms = rooms.length;
    const onlineDevices = devices.filter(d => d.online).length;
    const offlineDevices = devices.filter(d => !d.online).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-start gap-3 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                        <DoorClosed className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalRooms}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Rooms</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-start gap-3 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                        <Wifi className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{onlineDevices}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold">Live</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Active Devices</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-start gap-3 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                        <WifiOff className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{offlineDevices}</p>
                            {offlineDevices > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">Disconnected</span>}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Offline Devices</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-start gap-3 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
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
                        <DoorClosed className="h-5 w-5 text-nwu-red dark:text-nwu-red-light" />
                        Room Management
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage physical classrooms and assign IoT devices</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {canManageRooms && (
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
                                <label htmlFor="new-room-name" className="block text-xs font-semibold text-[#a8adc4] mb-1">Room Name *</label>
                                <input id="new-room-name" type="text" required value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="e.g. STC 102" className="w-full bg-[#12151f] border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-gray-900 dark:text-white placeholder-[#6b7094] outline-none focus:ring-1 focus:ring-nwu-red/50" />
                            </div>
                            <div>
                                <label htmlFor="new-room-building" className="block text-xs font-semibold text-[#a8adc4] mb-1">Building</label>
                                <input id="new-room-building" type="text" value={newRoomBuilding} onChange={(e) => setNewRoomBuilding(e.target.value)} placeholder="e.g. CEAT" className="w-full bg-[#12151f] border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-gray-900 dark:text-white placeholder-[#6b7094] outline-none focus:ring-1 focus:ring-nwu-red/50" />
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
                {rooms.length === 0 && !isCreating ? (
                    <div className="col-span-full border-2 border-dashed border-gray-200 dark:border-gray-700 p-10 text-center rounded-xl text-gray-500 dark:text-gray-400">
                        {canManageRooms 
                            ? "No rooms created yet. Click \"Create Room\" to get started."
                            : "No rooms available. Please contact the administrator."}
                    </div>
                ) : rooms.map(room => {
                    const roomDevices = devices.filter(d => d.room_id === room.id);
                    const unassignedDevices = devices.filter(d => d.room_id === null);
                    const statusLabel = room.status === "maintenance" ? "Maintenance" : "Active";
                    const statusColor = room.status === "maintenance" ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400";
                    const buildingName = room.building || "—";
                    const MAX_VISIBLE_DEVICES = 2;
                    const hiddenCount = Math.max(0, roomDevices.length - MAX_VISIBLE_DEVICES);

                    return (
                        <div key={room.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col hover:border-gray-300 dark:hover:border-gray-600 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md group">
                            <div className="p-5 pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        {editingRoomId === room.id ? (
                                            <div className="space-y-2 pr-2">
                                                <input aria-label="Edit room name" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full text-lg font-bold bg-[#12151f] border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-nwu-red/50" />
                                                <input aria-label="Edit building" value={editBuilding} onChange={(e) => setEditBuilding(e.target.value)} placeholder="Building" className="w-full text-sm bg-[#12151f] border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-[#a8adc4] outline-none focus:ring-1 focus:ring-nwu-red/50" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">{room.name}</h3>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${statusColor}`}>{statusLabel}</span>
                                                </div>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                                                    <DoorClosed className="h-3 w-3" /> {buildingName}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 ml-2 shrink-0">
                                        {editingRoomId === room.id && canManageRooms ? (
                                            <>
                                                <button onClick={saveEdit} className="p-1.5 text-green-400 hover:bg-green-500/10 rounded transition"><Save className="h-4 w-4" /></button>
                                                <button onClick={() => setEditingRoomId(null)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-[#242840] rounded transition"><X className="h-4 w-4" /></button>
                                            </>
                                        ) : canManageRooms ? (
                                            <>
                                                <button onClick={() => startEditing(room)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-400 transition opacity-0 group-hover:opacity-100"><Edit2 className="h-4 w-4" /></button>
                                                <button onClick={() => handleDeleteRoom(room.id)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-400 transition opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className="px-5 pb-5 flex-1 flex flex-col">
                                <div className="space-y-2 flex-1 pt-3">
                                    <h4 className="text-[11px] font-bold text-[#a8adc4] uppercase tracking-wider mb-2">Assigned Devices</h4>
                                    {roomDevices.slice(0, expandedRoomIds.has(room.id) ? undefined : MAX_VISIBLE_DEVICES).map(device => (
                                        <div key={device.id} className="flex items-center justify-between bg-[#12151f] p-2.5 rounded-lg border border-[rgba(255,255,255,0.05)] group/device">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${getDeviceDot(device.name)}`} />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{device.name}</p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">ID: {device.id.substring(0, 8).toUpperCase()}</p>
                                                </div>
                                            </div>
                                            {canManageRooms && (
                                                <button onClick={() => handleDeviceAssignment(device.id, null)} className="text-[10px] text-red-400 hover:text-red-300 opacity-0 group-hover/device:opacity-100 transition px-1 shrink-0">Remove</button>
                                            )}
                                        </div>
                                    ))}
                                    {roomDevices.length > MAX_VISIBLE_DEVICES && (
                                        <button onClick={() => {
                                            const newSet = new Set(expandedRoomIds);
                                            if (newSet.has(room.id)) {
                                                newSet.delete(room.id);
                                            } else {
                                                newSet.add(room.id);
                                            }
                                            setExpandedRoomIds(newSet);
                                        }} className="w-full text-center py-1.5 rounded-lg bg-[#12151f] border border-[rgba(255,255,255,0.05)] hover:bg-[#1a1e2b] transition group">
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 group-hover:text-nwu-red font-medium">
                                                {expandedRoomIds.has(room.id) ? "Show less" : `+ ${hiddenCount} more`}
                                            </p>
                                        </button>
                                    )}
                                </div>

                                {canManageRooms && (
                                    <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.05)] space-y-4">
                                        <div>
                                            <h4 className="text-[11px] font-bold text-[#a8adc4] uppercase tracking-wider mb-2">Authorized Administrators</h4>
                                            <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                                                {admins.filter(a => a.assigned_room_ids?.includes(room.id)).map(admin => (
                                                    <div key={admin.id} className="flex items-center gap-1 px-2 py-0.5 bg-nwu-red/10 text-nwu-red rounded-full border border-nwu-red/20 group/adm">
                                                        <span className="text-[10px] font-bold">{admin.name}</span>
                                                        <button onClick={() => handleRoomAdminToggle(room.id, admin.id, false)} className="hover:text-red-700 transition"><X className="h-2.5 w-2.5" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <select aria-label="Authorize admin" onChange={(e) => { if (e.target.value) { handleRoomAdminToggle(room.id, e.target.value, true); e.target.value = ""; } }} value="" className="w-full mt-2 text-xs p-2 bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 outline-none hover:border-gray-300">
                                                <option value="" disabled>+ Authorize Administrator</option>
                                                {admins.filter(a => !a.assigned_room_ids?.includes(room.id)).map(admin => (
                                                    <option key={admin.id} value={admin.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{admin.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <h4 className="text-[11px] font-bold text-[#a8adc4] uppercase tracking-wider mb-2">Bind New Device</h4>
                                            <select aria-label="Bind device" onChange={(e) => { if (e.target.value) handleDeviceAssignment(e.target.value, room.id); }} value="" className="w-full text-xs p-2 bg-transparent border border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 outline-none">
                                                <option value="" disabled>+ Select device to bind</option>
                                                {unassignedDevices.map(device => (
                                                    <option key={device.id} value={device.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{device.type === 'KIOSK' ? '[KIOSK] ' : ''}{device.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {canManageRooms && !isCreating && (
                    <button onClick={() => setIsCreating(true)} className="bg-[#12151f] rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center py-12 hover:border-gray-300 dark:bg-gray-800/50 transition-all cursor-pointer group min-h-[200px]">
                        <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-3 group-hover:bg-nwu-red/10 group-hover:border-nwu-red/30 transition">
                            <Plus className="h-6 w-6 text-gray-500 dark:text-gray-400 group-hover:text-nwu-red transition" />
                        </div>
                        <p className="text-sm font-semibold text-[#a8adc4] group-hover:text-gray-900 dark:text-white transition">Create Room</p>
                    </button>
                )}
            </div>

            <DynamicConfirmationModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                variant={confirmConfig.variant}
            />
        </div>
    );
}
