"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { addClass } from "./actions";
import { useRouter } from "next/navigation";

interface AddClassDialogProps {
    trigger?: React.ReactNode;
}

export function AddClassDialog({ trigger }: AddClassDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [nameLength, setNameLength] = useState(0);
    const [descLength, setDescLength] = useState(0);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const result = await addClass(formData);

        if (result?.error) {
            alert(result.error);
        } else {
            setIsOpen(false);
            (e.target as HTMLFormElement).reset();
            router.refresh();
        }
        setLoading(false);
    };

    if (!isOpen) {
        return (
            <div onClick={() => setIsOpen(true)}>
                {trigger || (
                    <button
                        className="flex items-center px-4 py-2 bg-nwu-red text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Class
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X className="h-5 w-5" />
                </button>

                <h2 className="text-xl font-bold mb-4">Create New Class</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                        <input
                            name="name"
                            required
                            maxLength={200}
                            onChange={(e) => setNameLength(e.target.value.length)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red"
                            placeholder="e.g. Science 101"
                        />
                        <p className="text-xs text-gray-500 mt-1">{nameLength}/200 characters</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Start Time
                            </label>
                            <input
                                name="start_time"
                                type="time"
                                required
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                End Time
                            </label>
                            <input
                                name="end_time"
                                type="time"
                                required
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Year Level
                        </label>
                        <select
                            name="year_level"
                            required
                            defaultValue="1st Year"
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                            <option value="3rd Year">3rd Year</option>
                            <option value="4th Year">4th Year</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description/Schedule</label>
                        <textarea
                            name="description"
                            maxLength={500}
                            onChange={(e) => setDescLength(e.target.value.length)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red"
                            placeholder="e.g. Mon/Wed 10am - Room 3B"
                            rows={3}
                        />
                        <p className="text-xs text-gray-500 mt-1">{descLength}/500 characters</p>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-nwu-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                            {loading ? "Creating..." : "Create Class"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
