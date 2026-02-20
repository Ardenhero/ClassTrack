"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";
import { DoorClosed, Plus, Edit2, Cpu, Save, Loader2 } from "lucide-react";
import { createRoom, updateRoomDetails, assignDeviceToRoom } from "./actions";

interface Room {
    id: string;
    name: string;
    building: string | null;
    capacity: number | null;
    department_id: string | null;
}

interface Device {
    id: string;
    name: string;
    type: string;
    room_id: string | null;
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
    const canCreateRooms = profile?.is_super_admin || profile?.role === "admin"; // Both admins and supers can create rooms

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch Rooms (RLS will filter based on department if normal admin, or return all if super admin)
            const { data: roomsData, error: roomsError } = await supabase
                .from("rooms")
                .select("*")
                .order("name");
            if (roomsError) throw roomsError;
            setRooms(roomsData || []);

            // Fetch Devices (same RLS applies conceptually or we fetch what we can)
            // If strictly admin, they might only see devices for their department.
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
        if (isAdmin) {
            loadData();
        }
    }, [isAdmin, loadData]);

    if (!isAdmin) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <p className="text-gray-500">You do not have permission to view this page.</p>
            </div>
        );
    }

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRoomName) return;

        const fd = new FormData();
        fd.append("name", newRoomName);
        fd.append("building", newRoomBuilding);
        if (profile?.department_id) {
            fd.append("department_id", profile.department_id);
        }

        await createRoom(fd);
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
        await assignDeviceToRoom(deviceId, roomId);
        loadData();
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full p-10"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                        <DoorClosed className="h-6 w-6 text-nwu-red" />
                        Room Management
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage physical classrooms and assign IoT devices.</p>
                </div>
                {canCreateRooms && (
                    <button
                        onClick={() => setIsCreating(!isCreating)}
                        className="bg-nwu-red hover:bg-red-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                    >
                        <Plus className="h-4 w-4" />
                        Add Room
                    </button>
                )}
            </div>

            {/* Create Room Form */}
            {isCreating && (
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all">
                    <h3 className="font-bold mb-4 text-gray-900 dark:text-gray-100">Create New Room</h3>
                    <form onSubmit={handleCreateRoom} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Room Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    placeholder="e.g. Room 101"
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-nwu-red outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Building</label>
                                <input
                                    type="text"
                                    value={newRoomBuilding}
                                    onChange={(e) => setNewRoomBuilding(e.target.value)}
                                    placeholder="e.g. Main Building"
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-nwu-red outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                            <button type="submit" className="px-4 py-2 text-sm bg-nwu-red hover:bg-red-800 text-white rounded-lg">Create</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Rooms List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rooms.length === 0 ? (
                    <div className="col-span-1 border-2 border-dashed border-gray-200 p-8 text-center rounded-xl text-gray-500">
                        No rooms created yet.
                    </div>
                ) : rooms.map(room => (
                    <div key={room.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-full hover:border-nwu-red/50 transition">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                                {editingRoomId === room.id ? (
                                    <div className="space-y-2 mb-2 pr-2">
                                        <input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="w-full text-lg font-bold bg-gray-50 border rounded p-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        />
                                        <input
                                            value={editBuilding}
                                            onChange={(e) => setEditBuilding(e.target.value)}
                                            placeholder="Building"
                                            className="w-full text-sm bg-gray-50 border rounded p-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">{room.name}</h3>
                                        <p className="text-sm text-gray-500">{room.building || "No Building Info"}</p>
                                    </>
                                )}
                            </div>

                            {editingRoomId === room.id ? (
                                <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded bg-green-50/50 transition"><Save className="h-4 w-4" /></button>
                            ) : (
                                <button onClick={() => startEditing(room)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition rounded"><Edit2 className="h-4 w-4" /></button>
                            )}
                        </div>

                        {/* Device Management For Room */}
                        <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                            <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1.5">
                                <Cpu className="h-3 w-3 text-nwu-red" />
                                Assigned Devices
                            </h4>

                            <div className="space-y-2 mb-3">
                                {devices.filter(d => d.room_id === room.id).length === 0 && (
                                    <p className="text-[10px] text-gray-400 italic">No devices assigned.</p>
                                )}
                                {devices.filter(d => d.room_id === room.id).map(device => (
                                    <div key={device.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-1.5 rounded text-xs border border-gray-100 dark:border-gray-600">
                                        <span className="truncate pr-2 font-medium flex gap-2">
                                            {device.type === 'KIOSK' && <span className="bg-blue-100 text-blue-700 px-1 rounded font-bold text-[9px]">KIOSK</span>}
                                            {device.name}
                                        </span>
                                        <button
                                            onClick={() => handleDeviceAssignment(device.id, null)}
                                            className="text-red-500 hover:underline px-1 shrink-0 text-[10px]"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Dropdown to add unassigned devices */}
                            <select
                                onChange={(e) => {
                                    if (e.target.value) handleDeviceAssignment(e.target.value, room.id);
                                }}
                                value=""
                                className="w-full text-xs p-1.5 bg-gray-50 outline-none border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="" disabled>+ Assign existing device...</option>
                                {devices.filter(d => d.room_id !== room.id && d.room_id === null).map(device => (
                                    <option key={device.id} value={device.id}>
                                        {device.type === 'KIOSK' ? '[KIOSK] ' : ''}{device.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
