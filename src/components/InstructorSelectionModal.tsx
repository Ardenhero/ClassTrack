"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Lock, User, ChevronDown, ChevronRight } from "lucide-react";

interface Instructor {
    id: string;
    name: string;
    has_pin: boolean;
    department?: {
        id: string;
        name: string;
        code: string;
    };
}

interface DepartmentGroup {
    id: string;
    name: string;
    code: string;
    instructors: Instructor[];
}

export function InstructorSelectionModal({ onSelect }: { onSelect: (instructor: Instructor) => void }) {
    const [departments, setDepartments] = useState<DepartmentGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
    const [expandedDept, setExpandedDept] = useState<string | null>(null);
    const [pin, setPin] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const fetchData = async () => {
            // Fetch instructors with their departments
            const { data, error } = await supabase
                .from("instructors")
                .select(`
                    id, 
                    name, 
                    pin_code,
                    departments (
                        id,
                        name,
                        code
                    )
                `)
                .eq("is_visible_on_kiosk", true)
                .order("name");

            if (!error && data) {
                // Group by department
                const groups: Record<string, DepartmentGroup> = {};
                const unassigned: Instructor[] = [];

                data.forEach((i: { id: string; name: string; pin_code: string | null; departments: { id: string; name: string; code: string } | null }) => {
                    const inst: Instructor = {
                        id: i.id,
                        name: i.name,
                        has_pin: i.pin_code !== null && i.pin_code !== "",
                        department: i.departments || undefined
                    };

                    if (inst.department) {
                        if (!groups[inst.department.id]) {
                            groups[inst.department.id] = {
                                id: inst.department.id,
                                name: inst.department.name,
                                code: inst.department.code,
                                instructors: []
                            };
                        }
                        groups[inst.department.id].instructors.push(inst);
                    } else {
                        unassigned.push(inst);
                    }
                });

                // Convert to array and sort
                const deptArray = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));

                // Add "General / Unassigned" at the end if exists
                if (unassigned.length > 0) {
                    deptArray.push({
                        id: "unassigned",
                        name: "General Faculty",
                        code: "GEN",
                        instructors: unassigned
                    });
                }

                setDepartments(deptArray);

                // Auto-expand first department if exists
                if (deptArray.length > 0) {
                    setExpandedDept(deptArray[0].id);
                }
            }
            setLoading(false);
        };
        fetchData();
    }, [supabase]);

    const handleVerifyPin = async () => {
        if (!selectedInstructor) return;
        setVerifying(true);
        setError(null);

        const res = await fetch("/api/auth/verify_pin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instructor_id: selectedInstructor.id, pin }),
        });

        const result = await res.json();
        if (result.success) {
            onSelect(selectedInstructor);
        } else {
            setError(result.error || "Verification failed");
        }
        setVerifying(false);
    };

    if (loading) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all flex flex-col max-h-[80vh]">
                <div className="bg-nwu-red p-6 text-white shrink-0">
                    <h2 className="text-xl font-bold uppercase tracking-wide">Instructor Identity</h2>
                    <p className="text-xs opacity-80 mt-1">Please identify yourself to continue</p>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {!selectedInstructor ? (
                        <div className="space-y-4">
                            <p className="text-sm font-medium text-gray-500 mb-2">Select your department:</p>
                            <div className="space-y-2">
                                {departments.map((dept) => (
                                    <div key={dept.id} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
                                            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <div className="flex items-center">
                                                <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">{dept.name}</span>
                                                <span className="ml-2 text-xs bg-white dark:bg-gray-800 px-2 py-0.5 rounded text-gray-500 border border-gray-200 dark:border-gray-600">{dept.code}</span>
                                            </div>
                                            {expandedDept === dept.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </button>

                                        {expandedDept === dept.id && (
                                            <div className="p-2 space-y-1 bg-white dark:bg-gray-800">
                                                {dept.instructors.map(instructor => (
                                                    <button
                                                        key={instructor.id}
                                                        onClick={() => {
                                                            if (instructor.has_pin) {
                                                                setSelectedInstructor(instructor);
                                                            } else {
                                                                onSelect(instructor);
                                                            }
                                                        }}
                                                        className="w-full flex items-center p-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left group transition-colors"
                                                    >
                                                        <div className="h-8 w-8 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mr-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                            <User className="h-4 w-4" />
                                                        </div>
                                                        <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{instructor.name}</span>
                                                    </button>
                                                ))}
                                                {dept.instructors.length === 0 && (
                                                    <p className="text-center text-xs text-gray-400 py-2">No instructors found.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {departments.length === 0 && (
                                    <p className="text-center text-gray-500 py-8">No departments or instructors found.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="h-16 w-16 bg-nwu-red/10 rounded-full flex items-center justify-center text-nwu-red mx-auto mb-4">
                                    <Lock className="h-8 w-8" />
                                </div>
                                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedInstructor.name}</p>
                                <p className="text-sm text-gray-500">This account is protected with a PIN</p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Enter 4-Digit PIN</label>
                                <input
                                    type="password"
                                    maxLength={4}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                                    autoFocus
                                    className="w-full text-center text-2xl tracking-[1em] font-mono px-4 py-3 border-2 border-gray-100 dark:border-gray-700 dark:bg-gray-900 rounded-xl focus:outline-none focus:border-nwu-red transition-colors"
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-medium text-center">
                                    {error}
                                </div>
                            )}

                            <div className="flex space-x-3">
                                <button
                                    onClick={() => {
                                        setSelectedInstructor(null);
                                        setPin("");
                                        setError(null);
                                    }}
                                    className="flex-1 px-4 py-3 text-sm font-bold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    BACK
                                </button>
                                <button
                                    onClick={handleVerifyPin}
                                    disabled={pin.length < 4 || verifying}
                                    className="flex-2 px-8 py-3 bg-nwu-red text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {verifying ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "VERIFY"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
