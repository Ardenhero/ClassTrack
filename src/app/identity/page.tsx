"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Lock, User, ChevronDown, ChevronRight, ShieldCheck, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

interface Instructor {
    id: string;
    name: string;
    has_pin: boolean;
    role?: "admin" | "instructor";
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

import { useProfile } from "@/context/ProfileContext";

export default function IdentityPage() {
    const router = useRouter();
    const { selectProfile } = useProfile();
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
                    role,
                    pin_enabled,
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

                // Define interface for the raw data from supabase join
                interface RawInstructor {
                    id: string;
                    name: string;
                    pin_code: string | null;
                    role: string;
                    pin_enabled: boolean;
                    departments: {
                        id: string;
                        name: string;
                        code: string;
                    } | null;
                }

                (data as unknown as RawInstructor[]).forEach((i) => {
                    const inst: Instructor = {
                        id: i.id,
                        name: i.name,
                        has_pin: i.pin_code !== null && i.pin_code !== "" && (i.pin_enabled === true),
                        role: i.role as "admin" | "instructor" | undefined,
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

    const handleSelect = async (instructor: Instructor) => {
        // Set profile in context (which persists to localStorage)
        selectProfile({
            id: instructor.id,
            name: instructor.name,
            role: instructor.role || "instructor", // Default to instructor if role is missing
            department_id: instructor.department?.id
        });

        // Navigate to dashboard
        router.push("/");
    }

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
            handleSelect(selectedInstructor);
        } else {
            setError(result.error || "Verification failed");
        }
        setVerifying(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-nwu-red" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col max-h-[85vh]">
                <div className="bg-nwu-red p-6 text-white shrink-0 text-center relative">
                    <div className="w-16 h-16 bg-white rounded-full mx-auto mb-3 flex items-center justify-center shadow-md">
                        <ShieldCheck className="h-8 w-8 text-nwu-red" />
                    </div>
                    <h2 className="text-2xl font-bold uppercase tracking-wide">Instructor Identity</h2>
                    <p className="text-sm opacity-90 mt-1">Who is using this device?</p>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {!selectedInstructor ? (
                        <div className="space-y-6">

                            {/* Admin Bypass - Acts as System Admin Profile */}
                            <button
                                onClick={() => {
                                    selectProfile({
                                        id: "sys_admin",
                                        name: "System Administrator",
                                        role: "admin",
                                        has_pin: false
                                    });
                                    router.push("/dashboard/admin/departments");
                                }}
                                className="flex items-center justify-center w-full px-4 py-3 bg-red-50 text-red-700 font-bold rounded-xl border border-red-100 hover:bg-red-100 transition-colors shadow-sm mb-4 cursor-pointer"
                            >
                                <Settings className="mr-2 h-5 w-5" />
                                Access System Administration
                            </button>

                            <div>
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Select your department</p>
                                <div className="space-y-3">
                                    {departments.map((dept) => (
                                        <div key={dept.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-800">
                                            <button
                                                onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
                                                className="w-full flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <div className="flex items-center">
                                                    <span className="font-bold text-gray-900 dark:text-gray-100">{dept.name}</span>
                                                    <span className="ml-2 text-[10px] font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500 border border-gray-200 dark:border-gray-600 uppercase tracking-tight">{dept.code}</span>
                                                </div>
                                                {expandedDept === dept.id ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                                            </button>

                                            {expandedDept === dept.id && (
                                                <div className="p-2 space-y-1">
                                                    {dept.instructors.map(instructor => (
                                                        <button
                                                            key={instructor.id}
                                                            onClick={() => {
                                                                // Logic: If has_pin is true (which now means code exists AND enabled), show modal
                                                                // Otherwise, direct login.
                                                                if (instructor.has_pin) {
                                                                    setSelectedInstructor(instructor);
                                                                } else {
                                                                    handleSelect(instructor);
                                                                }
                                                            }}
                                                            className="w-full flex items-center p-3 rounded-lg hover:bg-nwu-red/5 dark:hover:bg-gray-700 text-left group transition-all"
                                                        >
                                                            <div className="h-9 w-9 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full flex items-center justify-center mr-3 group-hover:bg-nwu-red group-hover:text-white transition-colors">
                                                                <User className="h-5 w-5" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <span className="font-medium text-gray-700 dark:text-gray-200 block">{instructor.name}</span>
                                                                {instructor.has_pin && (
                                                                    <span className="text-[10px] text-gray-400 flex items-center mt-0.5">
                                                                        <Lock className="h-3 w-3 mr-1" /> PIN Protected
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <ChevronRight className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </button>
                                                    ))}
                                                    {dept.instructors.length === 0 && (
                                                        <div className="p-4 text-center">
                                                            <p className="text-gray-400 text-sm">No instructors found.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {departments.length === 0 && (
                                        <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                                            <p className="text-gray-500 font-medium">No departments found.</p>
                                            <p className="text-sm text-gray-400 mt-1">Please contact your administrator.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 py-4">
                            <div className="text-center">
                                <div className="h-20 w-20 bg-nwu-red/10 rounded-full flex items-center justify-center text-nwu-red mx-auto mb-4 border-4 border-nwu-red/5 ring-4 ring-nwu-red/5">
                                    <Lock className="h-8 w-8" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedInstructor.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">Please enter your 4-digit PIN</p>
                            </div>

                            <div className="space-y-4 max-w-[240px] mx-auto">
                                <input
                                    type="password"
                                    maxLength={4}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                                    autoFocus
                                    placeholder="••••"
                                    className="w-full text-center text-3xl tracking-[1em] font-mono px-4 py-4 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-2xl focus:outline-none focus:border-nwu-red focus:ring-4 focus:ring-nwu-red/10 transition-all placeholder:tracking-widest"
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium text-center animate-shake">
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => {
                                        setSelectedInstructor(null);
                                        setPin("");
                                        setError(null);
                                    }}
                                    className="px-4 py-3 text-sm font-bold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleVerifyPin}
                                    disabled={pin.length < 4 || verifying}
                                    className="px-4 py-3 bg-nwu-red text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all shadow-lg shadow-red-900/20 uppercase tracking-wider flex items-center justify-center"
                                >
                                    {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 text-center">
                    <p className="text-xs text-gray-400">ClassTrack v2.1.0 • Secure Access</p>
                </div>
            </div>
        </div>
    );
}
