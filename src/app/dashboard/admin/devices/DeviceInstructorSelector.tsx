"use client";

import { useState, useRef } from "react";
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
    let label = "";

    if (count === 0) {
        label = isSuperAdmin ? "All Admins" : "All Dept Instructors";
    } else {
        if (isSuperAdmin) {
            label = count === 1 ? "1 Admin Selected" : `${count} Admins Selected`;
        } else {
            label = count === 1 ? "1 Instructor Selected" : `${count} Instructors Selected`;
        }
    }

    return (
        <>
            <button
                ref={buttonRef}
                onClick={handleToggle}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium glass-input hover:border-nu-500 transition-all w-48 justify-between relative"
            >
                <div className="flex items-center gap-2 truncate">
                    <Users className="h-3.5 w-3.5 text-gray-500" />
                    <span className={count > 0 ? "text-nu-400 font-bold" : "text-gray-400"}>
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
                        className="absolute glass-panel overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col w-72 max-h-80 shadow-2xl"
                        style={{
                            top: coords.top,
                            left: coords.left
                        }}
                    >
                        {/* Header */}
                        <div className="p-3 border-b border-white/10 bg-dark-bg/50 backdrop-blur-sm">
                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-widest">
                                {isSuperAdmin ? "Grant Admin Access" : "Grant Access"}
                            </p>
                            <div className="flex gap-2 items-center justify-between">
                                <span className="text-xs text-gray-400 font-medium">
                                    {tempSelectedIds.length === 0
                                        ? "Default: Visible to Everyone"
                                        : `${tempSelectedIds.length} select`}
                                </span>
                                <button
                                    onClick={handleClear}
                                    className="text-xs text-nu-400 hover:text-nu-300 hover:underline font-bold transition-colors"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>

                        {/* Scrollable List */}
                        <div className="overflow-y-auto flex-1 p-2 custom-scrollbar space-y-1 bg-dark-surface/80">
                            {instructors.length === 0 ? (
                                <p className="p-3 text-xs text-gray-500 italic text-center">No accounts found.</p>
                            ) : (
                                instructors.map(inst => {
                                    const isSelected = tempSelectedIds.includes(inst.id);
                                    return (
                                        <label
                                            key={inst.id}
                                            className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer text-xs transition-all duration-200 border ${isSelected ? "bg-nu-500/10 border-nu-500/30 shadow-[inset_0_1px_2px_rgba(239,68,68,0.1)]" : "hover:bg-white/5 border-transparent hover:border-white/10"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-300 ${isSelected
                                                    ? "bg-nu-500 border-nu-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                                    : "bg-dark-surface border-gray-500/50 shadow-inner"
                                                    }`}>
                                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`font-bold tracking-wide ${isSelected ? "text-nu-400 drop-shadow-sm" : "text-gray-300"}`}>
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
                        <div className="p-3 bg-dark-bg/90 backdrop-blur-md border-t border-white/10 flex justify-end gap-2 shrink-0 relative z-10">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/20"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 text-xs font-bold text-white bg-nu-500 hover:bg-nu-400 hover:scale-105 active:scale-95 rounded-lg transition-all duration-300 shadow-[0_0_10px_rgba(176,42,42,0.4)] disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
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
