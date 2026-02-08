"use client";

import { useState, useEffect } from "react";
import { UserPlus, X, Check } from "lucide-react";
import { addStudent, getAssignableClasses } from "./actions";

import { useRouter } from "next/navigation";

interface ClassItem {
    id: string;
    name: string;
    description?: string;
}

interface AddStudentDialogProps {
    trigger?: React.ReactNode;
}

export function AddStudentDialog({ trigger }: AddStudentDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [nameLength, setNameLength] = useState(0);
    const router = useRouter();

    useEffect(() => {
        if (isOpen) {
            const fetchClasses = async () => {
                const data = await getAssignableClasses();
                if (data) setClasses(data);
            };
            fetchClasses();
        } else {
            // Reset selection when closed
            setSelectedClasses([]);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        // Append selected classes as JSON string
        formData.append("class_ids", JSON.stringify(selectedClasses));

        const result = await addStudent(formData);

        if (result?.error) {
            alert(result.error);
        } else {
            if (result?.message) {
                alert(result.message);
            }
            setIsOpen(false);
            (e.target as HTMLFormElement).reset();
            setSelectedClasses([]);
            router.refresh();
        }
        setLoading(false);
    };

    const toggleClass = (id: string) => {
        setSelectedClasses(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    if (!isOpen) {
        return (
            <div onClick={() => setIsOpen(true)}>
                {trigger || (
                    <button
                        className="flex items-center px-4 py-2 bg-nwu-red text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                    >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Student
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200 lg:max-w-lg max-h-[90vh] overflow-y-auto">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X className="h-5 w-5" />
                </button>

                <h2 className="text-xl font-bold mb-4">Add New Student</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SIN (Student ID)</label>
                        <input
                            name="sin"
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red"
                            placeholder="e.g. 22-00000"
                        />
                        <p className="text-xs text-gray-500 mt-1">Format: YY-XXXXX</p>
                    </div>



                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                            name="name"
                            required
                            maxLength={200}
                            onChange={(e) => setNameLength(e.target.value.length)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red"
                            placeholder="e.g. John Doe"
                        />
                        <p className="text-xs text-gray-500 mt-1">{nameLength}/200 characters</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
                        <select
                            name="year_level"
                            required
                            defaultValue="1st Year"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red"
                        >
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                            <option value="3rd Year">3rd Year</option>
                            <option value="4th Year">4th Year</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Assign Classes</label>
                        <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                            {classes.length === 0 ? (
                                <p className="p-3 text-sm text-gray-500 text-center">No classes found.</p>
                            ) : (
                                classes.map(c => (
                                    <div
                                        key={c.id}
                                        className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedClasses.includes(c.id) ? 'bg-red-50' : ''}`}
                                        onClick={() => toggleClass(c.id)}
                                    >
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900">{c.name}</p>
                                            {c.description && <p className="text-xs text-gray-500 truncate">{c.description}</p>}
                                        </div>
                                        <div className={`h-5 w-5 rounded border flex items-center justify-center ${selectedClasses.includes(c.id) ? 'bg-nwu-red border-nwu-red text-white' : 'border-gray-300'}`}>
                                            {selectedClasses.includes(c.id) && <Check className="h-3 w-3" />}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{selectedClasses.length} classes selected</p>
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
                            {loading ? "Adding..." : "Save Student"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
