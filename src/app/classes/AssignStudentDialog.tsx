"use client";

import { useState, useEffect } from "react";
import { UserPlus, X, Search } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { assignStudent } from "./[id]/actions";

interface Student {
    id: string;
    name: string;
    year_level: string;
    fingerprint_id: number;
}

export function AssignStudentDialog({ classId }: { classId: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [query, setQuery] = useState("");

    const supabase = createClient();

    useEffect(() => {
        if (isOpen) {
            // Fetch students who are NOT already enrolled (simplified: fetch all, filtered in UI or action ideally, but here just fetching all)
            const fetchStudents = async () => {
                const { data } = await supabase.from('students').select('*').order('name');
                // Safely cast if necessary, though Supabase types are inferred usually if generated.
                setStudents((data as Student[]) || []);
            };
            fetchStudents();
        }
    }, [isOpen, supabase]);

    const handleAssign = async (studentId: string) => {
        setLoading(true);
        const result = await assignStudent(classId, studentId);
        if (result?.error) {
            alert(result.error); // Duplicate key likely
        }
        // Wait for optimistic UI or revalidation
        setLoading(false);
        setIsOpen(false);
    };

    const filteredStudents = students.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center px-4 py-2 bg-nwu-red text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
            >
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Student
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200 h-[500px] flex flex-col">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X className="h-5 w-5" />
                </button>

                <h2 className="text-xl font-bold mb-4">Assign Student</h2>

                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-nwu-red"
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                    {filteredStudents.map(student => (
                        <div key={student.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200">
                            <div>
                                <p className="font-medium text-gray-900">{student.name}</p>
                                <p className="text-xs text-gray-500">{student.year_level}</p>
                            </div>
                            <button
                                onClick={() => handleAssign(student.id)}
                                disabled={loading}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1 px-3 rounded transition-colors"
                            >
                                Assign
                            </button>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
