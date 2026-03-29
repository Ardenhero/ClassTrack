"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, X, List, Layers, Zap, ChevronRight } from "lucide-react";
import * as Actions from "./group-actions";

interface GroupMember {
    id: string;
    device_id: string;
    dp_code: string;
}

interface VirtualGroup {
    id: string;
    name: string;
    room_id: string;
    members: GroupMember[];
}

export function VirtualGroupManager({ devices, rooms }: { 
    devices: { id: string, name: string, room_id?: string | null }[], 
    rooms: { id: string; name: string }[] 
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [groups, setGroups] = useState<VirtualGroup[]>([]);
    const [newName, setNewName] = useState("");
    const [newRoomId, setNewRoomId] = useState("");

    // Add member state
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedDeviceId, setSelectedDeviceId] = useState("");
    const [selectedDpCode, setSelectedDpCode] = useState("switch_1");

    const refreshGroups = async () => {
        const { data, error } = await Actions.getVirtualGroups();
        if (data) setGroups(data as VirtualGroup[]);
        if (error) console.error(error);
    };

    useEffect(() => {
        if (isOpen) refreshGroups();
    }, [isOpen]);

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName || !newRoomId) return;

        const { error } = await Actions.createVirtualGroup(newName, newRoomId);
        if (error) alert(error);
        else {
            setNewName("");
            refreshGroups();
        }
    };

    const handleDeleteGroup = async (id: string) => {
        if (!confirm("Delete this group control?")) return;
        const { error } = await Actions.deleteVirtualGroup(id);
        if (error) alert(error);
        else refreshGroups();
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGroupId || !selectedDeviceId || !selectedDpCode) return;

        const { error } = await Actions.addMemberToGroup(selectedGroupId, selectedDeviceId, selectedDpCode);
        if (error) alert(error);
        else {
            refreshGroups();
            setSelectedDeviceId("");
        }
    };

    const handleRemoveMember = async (id: string) => {
        const { error } = await Actions.removeMemberFromGroup(id);
        if (error) alert(error);
        else refreshGroups();
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-sm font-bold border border-transparent transition-all hover:bg-nwu-red hover:text-white"
            >
                <Layers className="h-4 w-4" />
                Group Controls
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-nwu-red flex items-center justify-center text-white shadow-lg shadow-nwu-red/20">
                            <Layers className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Group Controls</h2>
                            <p className="text-sm text-gray-500 font-medium tracking-tight">Group multiple devices into a single virtual group switch</p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 flex flex-col md:flex-row gap-8 scrollbar-thin">
                    {/* Left: Create & List Groups */}
                    <div className="flex-1 space-y-8">
                        {/* Create Form */}
                        <div className="bg-gray-50/50 dark:bg-gray-800/20 p-6 rounded-3xl border border-gray-100 dark:border-gray-800">
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                                <Plus className="h-4 w-4 text-nwu-red" /> New Group
                            </h3>
                            <form onSubmit={handleCreateGroup} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Group Name</label>
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            placeholder="e.g. All Lights"
                                            className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red outline-none transition-all text-sm font-medium"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Location / Room</label>
                                        <select
                                            value={newRoomId}
                                            onChange={(e) => setNewRoomId(e.target.value)}
                                            className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red outline-none transition-all text-sm font-medium"
                                        >
                                            <option value="">Select Room</option>
                                            {rooms.map(room => (
                                                <option key={room.id} value={room.id}>{room.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className="w-full py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-nwu-red hover:text-white transition-all shadow-lg shadow-gray-900/10 dark:shadow-none"
                                >
                                    Create Group Control
                                </button>
                            </form>
                        </div>

                        {/* Groups List */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 ml-1">
                                <List className="h-4 w-4" /> Active Groups ({groups.length})
                            </h3>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                                {groups.map(group => (
                                    <div
                                        key={group.id}
                                        onClick={() => setSelectedGroupId(group.id)}
                                        className={`p-4 rounded-[2rem] border transition-all cursor-pointer group ${selectedGroupId === group.id
                                            ? "bg-nwu-red border-nwu-red shadow-lg shadow-nwu-red/10"
                                            : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-nwu-red/30"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center transition-all ${selectedGroupId === group.id ? "bg-white/20 text-white" : "bg-gray-50 dark:bg-gray-900 text-gray-400"}`}>
                                                    <Zap className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h4 className={`text-sm font-black tracking-tight ${selectedGroupId === group.id ? "text-white" : "text-gray-900 dark:text-white"}`}>{group.name}</h4>
                                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${selectedGroupId === group.id ? "text-white/60" : "text-gray-400"}`}>
                                                        {rooms.find(r => r.id === group.room_id)?.name || "Unknown Room"} • {group.members?.length || 0} Devices
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                                                    className={`p-2 rounded-xl transition-all ${selectedGroupId === group.id ? "hover:bg-white/20 text-white/50 hover:text-white" : "hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 hover:text-nwu-red"}`}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                <ChevronRight className={`h-5 w-5 transition-all ${selectedGroupId === group.id ? "text-white translate-x-1" : "text-gray-300"}`} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {groups.length === 0 && (
                                    <div className="py-12 text-center bg-gray-50/50 dark:bg-gray-800/20 rounded-[2.5rem] border border-dashed border-gray-200 dark:border-gray-700">
                                        <Layers className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                                        <p className="text-gray-400 text-sm font-medium italic">No devices grouped yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Manage Members */}
                    <div className="w-full md:w-[350px] flex flex-col gap-6">
                        {selectedGroupId ? (
                            <>
                                <div className="bg-gray-50/50 dark:bg-gray-800/20 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-right-4">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2 text-nwu-red">
                                        Add Device to {groups.find(g => g.id === selectedGroupId)?.name}
                                    </h3>
                                    <form onSubmit={handleAddMember} className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Target Device</label>
                                            <select
                                                required
                                                value={selectedDeviceId}
                                                onChange={(e) => setSelectedDeviceId(e.target.value)}
                                                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red outline-none transition-all text-sm font-medium"
                                            >
                                                <option value="">Select Device</option>
                                                {devices
                                                    .filter(d => d.room_id === groups.find(g => g.id === selectedGroupId)?.room_id)
                                                    .map(dev => (
                                                        <option key={dev.id} value={dev.id}>{dev.name}</option>
                                                    ))
                                                }
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">DP Code (Toggle ID)</label>
                                            <input
                                                type="text"
                                                required
                                                value={selectedDpCode}
                                                onChange={(e) => setSelectedDpCode(e.target.value)}
                                                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red outline-none transition-all text-sm font-medium"
                                            />
                                            <p className="text-[9px] text-gray-400 px-1 font-bold italic">* Usually switch_1, switch_2 etc.</p>
                                        </div>
                                        <button
                                            type="submit"
                                            className="w-full py-3 bg-nwu-red text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-nwu-red/20"
                                        >
                                            Add to Group
                                        </button>
                                    </form>
                                </div>

                                <div className="space-y-3 flex-1 overflow-y-auto">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 ml-1">
                                        Devices in Group
                                    </h3>
                                    <div className="space-y-2 pr-2 scrollbar-thin">
                                        {groups.find(g => g.id === selectedGroupId)?.members?.map(member => {
                                            const dev = devices.find(d => d.id === member.device_id);
                                            return (
                                                <div key={member.id} className="p-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-50 dark:border-gray-800 flex items-center justify-between group shadow-sm">
                                                    <div>
                                                        <p className="text-xs font-black text-gray-900 dark:text-white truncate max-w-[180px] tracking-tight">{dev?.name || "Unknown"}</p>
                                                        <p className="text-[9px] font-bold text-gray-400 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded inline-block mt-0.5 uppercase tracking-tighter">Code: {member.dp_code}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveMember(member.id)}
                                                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {(!groups.find(g => g.id === selectedGroupId)?.members || groups.find(g => g.id === selectedGroupId)?.members?.length === 0) && (
                                            <div className="py-8 text-center bg-gray-50/30 dark:bg-gray-800/10 rounded-2xl border border-dashed border-gray-100 dark:border-gray-800">
                                                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest italic">No devices added</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-gray-50/50 dark:bg-gray-800/20 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                                <div className="h-16 w-16 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center text-gray-200 dark:text-gray-700 mb-4 shadow-sm">
                                    <Layers className="h-8 w-8" />
                                </div>
                                <h4 className="text-sm font-black text-gray-400 uppercase tracking-tighter">Select a Group</h4>
                                <p className="text-[10px] font-bold text-gray-400/60 uppercase tracking-widest mt-1">to manage members and devices</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50/50 dark:bg-gray-800/20 border-t border-gray-50 dark:border-gray-800 flex justify-end">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="px-8 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:border-nwu-red hover:text-nwu-red transition-all shadow-sm"
                    >
                        Done Managing Groups
                    </button>
                </div>
            </div>
        </div>
    );
}
