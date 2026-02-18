"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
    isSuperAdmin?: boolean; // New prop
}

export function DeviceInstructorSelector({ deviceId, assignedIds, instructors, isSuperAdmin }: Props) {
    const [savedIds, setSavedIds] = useState<string[]>(assignedIds || []);
    const [tempSelectedIds, setTempSelectedIds] = useState<string[]>(assignedIds || []); // Temporary state for manual save
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

    // Toggle open/close and calculate position
    const handleToggle = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            // Check if near bottom of screen to flip up? (Optional, keeping simple for now)
            setCoords({
                top: rect.bottom + 4, // 4px gap
                left: rect.left
            });
            setTempSelectedIds(savedIds); // Reset temp state
        }
        setIsOpen(!isOpen);
    };

    const toggleInstructor = (instructorId: string) => {
        const newIds = tempSelectedIds.includes(instructorId)
            ? tempSelectedIds.filter(id => id !== instructorId)
            : [...tempSelectedIds, instructorId];
        setTempSelectedIds(newIds);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateDeviceInstructors(deviceId, tempSelectedIds);
            setSavedIds(tempSelectedIds);
            setIsOpen(false);
        } catch (err) {
            console.error(err);
            alert("Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const handleClear = () => {
        setTempSelectedIds([]);
    };

    const count = savedIds.length;
    const label = isSuperAdmin
        ? (count === 0 ? "All Admins" : `${count} Admins Selected`)
        : (count === 0 ? "All Dept Instructors" : `${count} Selected`);

    return (
        <>
            <button
                ref={buttonRef}
                onClick={handleToggle}
                className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-nwu-red transition-all w-48 justify-between relative"
            >
                <div className="flex items-center gap-2 truncate">
                    <Users className="h-3.5 w-3.5 text-gray-500" />
                    <span className={count > 0 ? "text-nwu-red" : "text-gray-600 dark:text-gray-300"}>
                        {label}
                    </span>
                </div>
            </button>

            {isOpen && coords && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-start justify-start"
                // Prevent catching clicks intended for the dropdown itself, but catch outside clicks
                >
                    <div className="fixed inset-0 bg-transparent" onClick={() => setIsOpen(false)} />

                    <div
                        className="absolute bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col w-72 max-h-80 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                        style={{
                            top: coords.top,
                            left: coords.left
                        }}
                    >
                        {/* Header */}
                        <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800">
                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">
                                {isSuperAdmin ? "Grant Admin Access" : "Grant Access"}
                            </p>
                            <div className="flex gap-2 items-center justify-between">
                                <span className="text-xs text-gray-400">
                                    {tempSelectedIds.length === 0
                                        ? "Default: Visible to Everyone"
                                        : `${tempSelectedIds.length} select`}
                                </span>
                                <button
                                    onClick={handleClear}
                                    className="text-xs text-nwu-red hover:underline font-medium"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>

                        {/* Scrollable List */}
                        <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                            {instructors.length === 0 ? (
                                <p className="p-3 text-xs text-gray-400 italic text-center">No accounts found.</p>
                            ) : (
                                instructors.map(inst => {
                                    const isSelected = tempSelectedIds.includes(inst.id);
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
                                                <div className="flex flex-col">
                                                    <span className={`font-medium ${isSelected ? "text-nwu-red" : "text-gray-700 dark:text-gray-200"}`}>
                                                        {inst.name}
                                                    </span>
                                                </div>
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
                        </div>

                        {/* Fixed Footer */}
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2 shrink-0">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-nwu-red hover:bg-red-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
