"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";
// DashboardLayout is provided by parent admin/layout.tsx — do NOT wrap again
import { KeyRound, ShieldCheck, Lock, Loader2, AlertTriangle, CheckCircle } from "lucide-react";

interface UserTarget {
    id: string;
    email: string;
    name: string;
}

interface InstructorTarget {
    id: string;
    name: string;
    role: string;
}

export default function SecurityPage() {
    const supabase = createClient();
    const { profile } = useProfile();
    const isSuperAdmin = profile?.is_super_admin === true;

    // Password Reset State
    const [users, setUsers] = useState<UserTarget[]>([]);
    const [selectedUser, setSelectedUser] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [pwdRemaining, setPwdRemaining] = useState<number | null>(null);
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdMessage, setPwdMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // PIN Reset State
    const [instructors, setInstructors] = useState<InstructorTarget[]>([]);
    const [selectedInstructor, setSelectedInstructor] = useState("");
    const [newPin, setNewPin] = useState("");
    const [pinRemaining, setPinRemaining] = useState<number | null>(null);
    const [pinLoading, setPinLoading] = useState(false);
    const [pinMessage, setPinMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        async function loadTargets() {
            // First get the current user's auth_user_id for scoping
            const { data: currentProfile } = await supabase
                .from("instructors")
                .select("auth_user_id")
                .eq("id", profile?.id || "")
                .single();

            const myAuthUserId = currentProfile?.auth_user_id;

            // Load instructors for PIN reset — scoped to same account
            let instructorQuery = supabase
                .from("instructors")
                .select("id, name, role")
                .neq("id", profile?.id || "")
                .order("name");

            // Scope: show only instructors under the same account (owner_id = my auth_user_id)
            if (myAuthUserId && !isSuperAdmin) {
                instructorQuery = instructorQuery.eq("owner_id", myAuthUserId);
            }

            const { data: instructorData } = await instructorQuery;
            if (instructorData) setInstructors(instructorData);

            // Load users for password reset (super admin only) — scoped to same account
            if (isSuperAdmin && myAuthUserId) {
                const { data: accountInstructors } = await supabase
                    .from("instructors")
                    .select("auth_user_id, name")
                    .not("auth_user_id", "is", null)
                    .eq("owner_id", myAuthUserId);

                if (accountInstructors) {
                    setUsers(accountInstructors.map((i: { auth_user_id: string | null; name: string }) => ({
                        id: i.auth_user_id!,
                        email: "",
                        name: i.name,
                    })));
                }
            }
        }
        if (profile?.id) loadTargets();
    }, [profile?.id, isSuperAdmin, supabase]);

    const handlePasswordReset = async () => {
        setPwdLoading(true);
        setPwdMessage(null);
        try {
            const res = await fetch("/api/admin/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target_user_id: selectedUser, new_password: newPassword }),
            });
            const data = await res.json();
            if (res.ok) {
                setPwdMessage({ type: "success", text: `Password reset successful. ${data.remaining} resets remaining this month.` });
                setPwdRemaining(data.remaining);
                setNewPassword("");
                setSelectedUser("");
            } else {
                setPwdMessage({ type: "error", text: data.error });
                if (data.remaining !== undefined) setPwdRemaining(data.remaining);
            }
        } catch {
            setPwdMessage({ type: "error", text: "Network error" });
        } finally {
            setPwdLoading(false);
        }
    };

    const handlePinReset = async () => {
        setPinLoading(true);
        setPinMessage(null);
        try {
            const res = await fetch("/api/admin/reset-pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target_instructor_id: selectedInstructor, new_pin: newPin }),
            });
            const data = await res.json();
            if (res.ok) {
                setPinMessage({ type: "success", text: `PIN reset successful. ${data.remaining} resets remaining this month.` });
                setPinRemaining(data.remaining);
                setNewPin("");
                setSelectedInstructor("");
            } else {
                setPinMessage({ type: "error", text: data.error });
                if (data.remaining !== undefined) setPinRemaining(data.remaining);
            }
        } catch {
            setPinMessage({ type: "error", text: "Network error" });
        } finally {
            setPinLoading(false);
        }
    };

    return (
        <>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="h-7 w-7 text-nwu-red" />
                    Security Management
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Manage password and PIN resets with rate-limited controls</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Password Reset Card — Super Admin Only */}
                {isSuperAdmin && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-red-600 to-red-700 p-5 text-white">
                            <div className="flex items-center gap-3">
                                <KeyRound className="h-6 w-6" />
                                <div>
                                    <h2 className="text-lg font-bold">Password Reset</h2>
                                    <p className="text-red-200 text-xs">Super Admin • {pwdRemaining !== null ? `${pwdRemaining}/10 remaining` : "10 resets per month"}</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Target User</label>
                                <select
                                    value={selectedUser}
                                    onChange={(e) => setSelectedUser(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-nwu-red focus:border-transparent"
                                >
                                    <option value="">Select a user...</option>
                                    {users.map((u) => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Minimum 6 characters"
                                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-nwu-red focus:border-transparent"
                                />
                            </div>

                            {pwdMessage && (
                                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${pwdMessage.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                                    {pwdMessage.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                                    {pwdMessage.text}
                                </div>
                            )}

                            <button
                                onClick={handlePasswordReset}
                                disabled={!selectedUser || newPassword.length < 6 || pwdLoading}
                                className="w-full py-2.5 bg-nwu-red text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                {pwdLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                                Reset Password
                            </button>
                        </div>
                    </div>
                )}

                {/* PIN Reset Card — All Admins */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-5 text-white">
                        <div className="flex items-center gap-3">
                            <Lock className="h-6 w-6" />
                            <div>
                                <h2 className="text-lg font-bold">PIN Reset</h2>
                                <p className="text-amber-200 text-xs">Profile Lock Recovery • {pinRemaining !== null ? `${pinRemaining}/10 remaining` : "10 resets per month"}</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Target Instructor</label>
                            <select
                                value={selectedInstructor}
                                onChange={(e) => setSelectedInstructor(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-nwu-red focus:border-transparent"
                            >
                                <option value="">Select an instructor...</option>
                                {instructors.map((i) => (
                                    <option key={i.id} value={i.id}>{i.name} ({i.role})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">New 4-Digit PIN</label>
                            <input
                                type="password"
                                maxLength={4}
                                value={newPin}
                                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                                placeholder="••••"
                                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-center tracking-[0.5em] font-mono focus:ring-2 focus:ring-nwu-red focus:border-transparent"
                            />
                        </div>

                        {pinMessage && (
                            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${pinMessage.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                                {pinMessage.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                                {pinMessage.text}
                            </div>
                        )}

                        <button
                            onClick={handlePinReset}
                            disabled={!selectedInstructor || newPin.length !== 4 || pinLoading}
                            className="w-full py-2.5 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {pinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                            Reset PIN
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
