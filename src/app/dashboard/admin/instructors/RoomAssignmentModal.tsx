"use client";

import { useState, useEffect } from "react";
import { DoorClosed, X, Check, Loader2, Search } from "lucide-react";
import { updateInstructorRooms } from "./instructorActions";

interface Room {
    id: string;
    name: string;
    building: string | null;
}

interface RoomAssignmentModalProps {
    instructorId: string;
    instructorName: string;
    initialRoomIds: string[];
    availableRooms: Room[];
}

export function RoomAssignmentModal({
    instructorId,
    instructorName,
    initialRoomIds,
    availableRooms
}: RoomAssignmentModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(initialRoomIds);
    const [isPending, setIsPending] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Sync state only when modal opens or instructor changes
    useEffect(() => {
        if (!isOpen) {
            setSelectedRoomIds(initialRoomIds);
        }
    }, [initialRoomIds, isOpen]);

    const handleToggleRoom = (roomId: string) => {
        console.log("[RoomAssignment] Toggling room:", roomId);
        setSelectedRoomIds(prev => {
            const isSelected = prev.includes(roomId);
            const next = isSelected 
                ? prev.filter(id => id !== roomId) 
                : [...prev, roomId];
            console.log("[RoomAssignment] Next selection state:", next);
            return next;
        });
    };

    const handleSave = async () => {
        setIsPending(true);
        console.log("[RoomAssignment] Saving for instructor", instructorId, ":", selectedRoomIds);
        const result = await updateInstructorRooms(instructorId, selectedRoomIds);
        if (result.success) {
            setIsOpen(false);
        } else {
            alert(`Error: ${result.error}`);
        }
        setIsPending(false);
    };

    const filteredRooms = availableRooms.filter(room => 
        room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (room.building && room.building.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-1.5"
            >
                <DoorClosed className="h-3 w-3" />
                Rooms ({initialRoomIds.filter(id => availableRooms.some(r => r.id === id)).length})
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white">Assign Rooms</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{instructorName}</p>
                            </div>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input 
                                    type="text"
                                    placeholder="Search rooms..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 dark:bg-gray-900/50 border-transparent focus:bg-white dark:focus:bg-gray-900 border focus:border-nwu-red rounded-xl outline-none transition-all dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Room List */}
                        <div className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
                            {filteredRooms.length === 0 ? (
                                <div className="py-8 text-center">
                                    <DoorClosed className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No rooms found</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-1">
                                    {filteredRooms.map(room => {
                                        const isSelected = selectedRoomIds.includes(room.id);
                                        return (
                                            <button
                                                key={room.id}
                                                onClick={() => handleToggleRoom(room.id)}
                                                className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                                                    isSelected 
                                                        ? 'bg-nwu-red/5 dark:bg-nwu-red/10 border-nwu-red/20' 
                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-transparent'
                                                } border text-left group`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                                        isSelected 
                                                            ? 'bg-nwu-red text-white' 
                                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                                                    }`}>
                                                        <DoorClosed className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-semibold transition-colors ${
                                                            isSelected ? 'text-nwu-red' : 'text-gray-700 dark:text-gray-300'
                                                        }`}>
                                                            {room.name}
                                                        </p>
                                                        {room.building && (
                                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
                                                                {room.building}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                                    isSelected 
                                                        ? 'bg-green-500 border-green-500 text-white scale-110' 
                                                        : 'border-gray-300 dark:border-gray-600'
                                                }`}>
                                                    {isSelected && <Check className="h-3 w-3" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                {selectedRoomIds.length} room(s) selected
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isPending}
                                    className="px-5 py-2 text-xs font-bold text-white bg-nwu-red hover:bg-red-800 rounded-lg transition-all shadow-md shadow-nwu-red/20 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    Save Access
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
