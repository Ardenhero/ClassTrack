"use client";

import { useState } from "react";
import { Save, Check, Trash2, X } from "lucide-react";
import { updateDeviceDetails, bulkDeleteDevices } from "./actions";
import { DeleteDeviceButton } from "./DeleteDeviceButton";
import { VirtualGroupManager } from "./VirtualGroupManager";

interface Device {
    id: string;
    name: string;
    type: string;
    room_id?: string | null;
    room?: string | null;
    rooms?: { name: string } | null;
    department_id?: string | null;
    assigned_instructor_ids?: string[] | null;
}


export function DeviceTableClient({
    initialDevices,
    rooms,
    isSuperAdmin
}: { initialDevices: Device[], rooms: { id: string; name: string }[], isSuperAdmin: boolean }) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);

    const toggleSelectAll = () => {
        if (selectedIds.length === initialDevices.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(initialDevices.map(d => d.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };


    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} devices? This cannot be undone.`)) return;

        setIsDeletingBulk(true);
        try {
            const result = await bulkDeleteDevices(selectedIds);
            if (result.success) {
                setSelectedIds([]);
            } else {
                alert("Error: " + result.error);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to delete devices");
        } finally {
            setIsDeletingBulk(false);
        }
    };

    return (
        <div className="relative">
            {/* Bulk Action Bar (Floating) */}
            {selectedIds.length > 0 && isSuperAdmin && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-nwu-red/20 p-4 flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-3 pr-6 border-r border-gray-100 dark:border-gray-700">
                        <div className="bg-nwu-red text-white text-xs font-bold h-6 w-6 rounded-full flex items-center justify-center">
                            {selectedIds.length}
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">Selected</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleBulkDelete}
                            disabled={isDeletingBulk}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 text-nwu-red rounded-xl text-sm font-bold border border-red-100 dark:border-red-900/30 transition-all disabled:opacity-50"
                        >
                            <Trash2 className="h-4 w-4" />
                            {isDeletingBulk ? "Deleting..." : "Delete Selected"}
                        </button>

                        <button
                            onClick={() => {
                                setSelectedIds([]);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all"
                            title="Clear Selection"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            )}

            {isSuperAdmin && (
                <div className="flex justify-end mb-4">
                    <VirtualGroupManager devices={initialDevices} rooms={rooms} />
                </div>
            )}

            <div className="overflow-x-auto h-[600px] overflow-y-auto pb-20 scrollbar-thin">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                        <tr className="text-sm font-bold text-gray-600 dark:text-gray-300">
                            {isSuperAdmin && (
                                <th className="py-3 px-4 w-12">
                                    <div
                                        onClick={toggleSelectAll}
                                        className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all ${selectedIds.length === initialDevices.length && initialDevices.length > 0
                                                ? "bg-nwu-red border-nwu-red"
                                                : "border-gray-300 dark:border-gray-600 hover:border-nwu-red"
                                            }`}
                                    >
                                        {selectedIds.length === initialDevices.length && initialDevices.length > 0 ? (
                                            <Check className="h-3.5 w-3.5 text-white" />
                                        ) : selectedIds.length > 0 ? (
                                            <div className="w-2 h-0.5 bg-nwu-red rounded" />
                                        ) : null}
                                    </div>
                                </th>
                            )}
                            <th className="py-3 px-4 w-1/4">DEVICE DETAILS</th>
                            <th className="py-3 px-4">TUYA ID</th>
                            <th className="py-3 px-4">TYPE</th>
                            {isSuperAdmin && <th className="py-3 px-4 w-16 text-center">ACTION</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {initialDevices.map((device) => {
                            const isSelected = selectedIds.includes(device.id);
                            return (
                                <tr
                                    key={device.id}
                                    className={`group transition-colors ${isSelected ? "bg-nwu-red/5 dark:bg-nwu-red/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                        }`}
                                >
                                    {isSuperAdmin && (
                                        <td className="py-4 px-4 w-12">
                                            <div
                                                onClick={() => toggleSelect(device.id)}
                                                className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all ${isSelected
                                                        ? "bg-nwu-red border-nwu-red"
                                                        : "border-gray-300 dark:border-gray-600 hover:border-nwu-red"
                                                    }`}
                                            >
                                                {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                                            </div>
                                        </td>
                                    )}
                                    <td className="py-4 px-4">
                                        <div className="flex flex-col gap-1.5">
                                            {isSuperAdmin ? (
                                                <>
                                                    <form className="flex items-center gap-2 group/form" action={async (formData: FormData) => {
                                                        const name = formData.get("name") as string;
                                                        const room = device.room; // keep room same
                                                        await updateDeviceDetails(device.id, name, room || "");
                                                    }}>
                                                        <input
                                                            type="text"
                                                            name="name"
                                                            defaultValue={device.name}
                                                            className="px-2 py-0.5 text-sm font-bold border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-nwu-red rounded transition-all w-full bg-transparent text-gray-900 dark:text-white outline-none"
                                                        />
                                                        <button type="submit" className="p-1 opacity-0 group-hover/form:opacity-100 text-gray-400 hover:text-nwu-red transition-all">
                                                            <Save className="h-3.5 w-3.5" />
                                                        </button>
                                                    </form>
                                                    <div className="flex items-center gap-2 px-2 py-0.5">
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase">Room</span>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                            {device.rooms?.name || "Unassigned"}
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="px-2">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{device.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Room: {device.rooms?.name || "Unassigned"}</p>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                                            {device.id}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-red-50 dark:bg-red-900/20 text-nwu-red border border-red-100 dark:border-red-900/30 uppercase tracking-wider">
                                            {device.type}
                                        </span>
                                    </td>
                                    {isSuperAdmin && (
                                        <td className="py-4 px-4 text-center">
                                            <DeleteDeviceButton deviceId={device.id} deviceName={device.name} />
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {initialDevices.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                        <Trash2 className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-sm italic font-medium">No IoT devices found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
