"use client";

import { useState } from "react";
import { Users, Check } from "lucide-react";
import { updateDeviceInstructors } from "./actions";

interface Instructor {
    id: string;
    name: string;
    department_id: string | null;
}

interface Props {
    deviceId: string;
    assignedIds: string[] | null;
    instructors: Instructor[];
}

export function DeviceInstructorSelector({ deviceId, assignedIds, instructors }: Props) {
    const [selectedIds, setSelectedIds] = useState<string[]>(assignedIds || []);
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const toggleInstructor = async (instructorId: string) => {
        const newIds = selectedIds.includes(instructorId)
            ? selectedIds.filter(id => id !== instructorId)
            : [...selectedIds, instructorId];

        setSelectedIds(newIds);
        setSaving(true);
        try {
            await updateDeviceInstructors(deviceId, newIds);
        } catch (err) {
            console.error(err);
            alert("Failed to save");
            // Revert
            setSelectedIds(selectedIds);
        } finally {
            setSaving(false);
        }
    };

    // Filter out instructors that are not relevant? 
    // The parent passes filtered instructors, so we just show them.

    const label = selectedIds.length === 0
        ? "All Dept Instructors"
        : `${selectedIds.length} Selected`;

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-nwu-red transition-all w-48 justify-between"
            >
                <div className="flex items-center gap-2 truncate">
                    <Users className="h-3.5 w-3.5 text-gray-500" />
                    <span className={selectedIds.length > 0 ? "text-nwu-red" : "text-gray-600 dark:text-gray-300"}>
                        {label}
                    </span>
                </div>
                {saving && <span className="w-2 h-2 rounded-full bg-nwu-red animate-pulse" />}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full mt-1 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-20 max-h-64 overflow-y-auto p-1">
                        <div className="p-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                            <p className="text-[10px] uppercase font-bold text-gray-400">
                                {selectedIds.length === 0 ? "Visible to Everyone in Department" : "Visible Only To:"}
                            </p>
                        </div>
                        {instructors.length === 0 ? (
                            <p className="p-3 text-xs text-gray-400 italic text-center">No instructors found.</p>
                        ) : (
                            instructors.map(inst => {
                                const isSelected = selectedIds.includes(inst.id);
                                return (
                                    <label
                                        key={inst.id}
                                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${isSelected ? "bg-nwu-red/5" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected
                                                    ? "bg-nwu-red border-nwu-red"
                                                    : "border-gray-300 dark:border-gray-600"
                                                }`}>
                                                {isSelected && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                            <span className={`font-medium ${isSelected ? "text-nwu-red" : "text-gray-700 dark:text-gray-200"}`}>
                                                {inst.name}
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={isSelected}
                                            onChange={() => toggleInstructor(inst.id)}
                                        />
                                    </label>
                                );
                            })
                        )}
                        <div className="p-2 bg-gray-50 dark:bg-gray-900/50 text-[10px] text-gray-500 rounded-b-xl border-t border-gray-100 dark:border-gray-700">
                            {selectedIds.length === 0
                                ? "Default: All instructors in the department can see this device."
                                : "Strict Mode: Only selected instructors can see this device."}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
