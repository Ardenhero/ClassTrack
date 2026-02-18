"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, Shield, Mail, Key, Loader2, CheckCircle2, Building2, ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { provisionAdmin, toggleAdminStatus, updateAdminDepartment } from "./actions";
import { cn } from "@/utils/cn";
import { ConfirmationModal } from "@/components/ConfirmationModal";

interface Department {
    id: string;
    name: string;
}

interface AdminProfile {
    id: string;
    name: string;
    role: string;
    auth_user_id: string;
    is_locked: boolean;
    is_super_admin: boolean;
    departments?: {
        name: string;
    } | null;
}

export default function AdminManagementPage() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<{ email: string, pass: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [admins, setAdmins] = useState<AdminProfile[]>([]);
    const [copied, setCopied] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        email: "",
        name: "",
        departmentId: "",
        password: Math.random().toString(36).slice(-10)
    });

    const supabase = createClient();

    const fetchAdmins = useCallback(async () => {
        const { data } = await supabase
            .from('instructors')
            .select(`
                *,
                departments (name)
            `)
            .eq('role', 'admin')
            .order('name');

        if (data) setAdmins(data);
    }, [supabase]);

    useEffect(() => {
        async function fetchData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setCurrentUserId(user.id);

            const { data: depts } = await supabase.from('departments').select('id, name').eq('is_active', true).order('name');
            if (depts) setDepartments(depts);
            fetchAdmins();
        }
        fetchData();
    }, [supabase, fetchAdmins]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await provisionAdmin(formData);
            if (result.success) {
                setSuccess({ email: formData.email, pass: formData.password });
                setFormData({
                    email: "",
                    name: "",
                    departmentId: "",
                    password: Math.random().toString(36).slice(-10)
                });
                fetchAdmins();
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    const toggleLock = async (admin: AdminProfile) => {
        if (admin.is_super_admin) return; // UI should disable this, but safety first

        try {
            await toggleAdminStatus(admin.auth_user_id, !admin.is_locked);
            fetchAdmins();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to toggle status");
        }
    };

    const handleCopy = () => {
        if (!success) return;
        const text = `Email: ${success.email}\nPassword: ${success.pass}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 font-sans">
            <div className="flex flex-col lg:flex-row gap-8">

                {/* Left Side: Admin List */}
                <div className="lg:w-2/3 space-y-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                <ShieldCheck className="mr-2 h-6 w-6 text-nwu-gold" />
                                Existing Deans & Admins
                            </h2>
                            <p className="text-sm text-gray-500">Managing {admins.length} institution-level accounts</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Administrator</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Department</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Identity</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-gray-400 tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                {admins.map((admin) => (
                                    <tr key={admin.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-nwu-red/10 flex items-center justify-center text-nwu-red text-xs font-bold mr-3">
                                                    {admin.name[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{admin.name}</p>
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-none mt-0.5">{admin.role}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                                                <Building2 className="h-3 w-3 mr-1.5 text-gray-400" />
                                                {/* Allow Super Admin to change department */}
                                                {!admin.is_super_admin && admin.auth_user_id !== currentUserId ? (
                                                    <select
                                                        className="bg-transparent focus:ring-2 focus:ring-nwu-red rounded py-1 px-2 text-xs w-32 border border-gray-200"
                                                        value={departments.find(d => d.name === admin.departments?.name)?.id || ""}
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        adminId: string;
        newDeptId: string;
        adminName: string;
        currentDeptName: string | null;
        targetDeptName: string | null;
    } | null>(null);

    const { ConfirmationModal } = await import("@/components/ConfirmationModal").then(mod => ({ ConfirmationModal: mod.ConfirmationModal })); // Dynamic import to avoid server/client issues if any, though regular import is fine here since "use client"
    
    // Actually we should import at top level standardly
    // Moving import to top of file in next edit if needed, but for now inside function is wrong.
    // Let's do standard top-level import in previous lines via multi-step or assume standard.
    // Wait, the file is "use client", so standard import is fine.
    
    // ...
    // (Replacing lines 161-174)
                                                        onChange={(e) => {
                                                            const newDeptId = e.target.value;
                                                            const targetDept = departments.find(d => d.id === newDeptId);
                                                            
                                                            // Trigger Modal
                                                            setConfirmModal({
                                                                isOpen: true,
                                                                adminId: admin.id,
                                                                newDeptId: newDeptId,
                                                                adminName: admin.name,
                                                                currentDeptName: admin.departments?.name || "Global / Unassigned",
                                                                targetDeptName: targetDept?.name || "Global / Unassigned"
                                                            });
                                                            
                                                            // Reset select visually until confirmed
                                                            e.target.value = departments.find(d => d.name === admin.departments?.name)?.id || "";
                                                        }}
                                                    >
                                                        <option value="">Global / Unassigned</option>
                                                        {departments.map((d) => (
                                                            <option key={d.id} value={d.id}>{d.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span>{admin.departments?.name || "Global University"}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-[10px] bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-gray-500 font-mono">
                                                {admin.auth_user_id.slice(0, 8)}...
                                            </code>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                {admin.is_locked ? (
                                                    <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold border border-red-100 uppercase">
                                                        Locked
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-bold border border-green-100 uppercase">
                                                        Active
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => toggleLock(admin)}
                                                    disabled={admin.is_super_admin || admin.auth_user_id === currentUserId}
                                                    className={cn(
                                                        "p-1.5 rounded-lg transition-all",
                                                        admin.is_super_admin || admin.auth_user_id === currentUserId
                                                            ? "text-gray-200 cursor-not-allowed"
                                                            : admin.is_locked
                                                                ? "text-blue-400 hover:text-blue-500 hover:bg-blue-50"
                                                                : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                                                    )}
                                                    title={admin.is_super_admin ? "Super Admin Protective Lock" : admin.is_locked ? "Unlock Account" : "Lock Account"}
                                                >
                                                    {admin.is_locked ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {admins.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">No administrators found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Right Side: Provisioning Form */}
            <div className="lg:w-1/3">
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-700 sticky top-8">
                    <div className="flex items-center space-x-3 mb-8">
                        <div className="p-3 bg-nwu-red rounded-2xl text-white">
                            <UserPlus className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add New Admin</h1>
                            <p className="text-xs text-gray-500">Secure credential generation</p>
                        </div>
                    </div>

                    {success && (
                        <div className="mb-8 p-4 bg-green-50 border border-green-100 rounded-2xl animate-in zoom-in duration-300">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3">
                                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-green-800 uppercase tracking-wider">Account Ready</p>
                                        <p className="text-[10px] text-green-700 mt-1">Credentials generated successfully.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleCopy}
                                    className="p-1.5 hover:bg-green-100 rounded-lg transition-colors text-green-600"
                                    title="Copy Credentials"
                                >
                                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </button>
                            </div>
                            <div className="mt-4 p-3 bg-white rounded-xl border border-green-200 space-y-1.5">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-gray-400 uppercase font-bold tracking-tight">Email</span>
                                    <span className="font-mono text-gray-900">{success.email}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-gray-400 uppercase font-bold tracking-tight">Password</span>
                                    <span className="font-mono text-gray-900">{success.pass}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-xs font-medium">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-100 dark:border-gray-700 focus:ring-2 focus:ring-nwu-red/10 focus:border-nwu-red outline-none transition-all dark:bg-gray-900 text-sm"
                                    placeholder="dean@university.edu"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                            <div className="relative">
                                <Shield className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-100 dark:border-gray-700 focus:ring-2 focus:ring-nwu-red/10 focus:border-nwu-red outline-none transition-all dark:bg-gray-900 text-sm"
                                    placeholder="Dr. Jane Doe"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Department</label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                                <select
                                    required
                                    value={formData.departmentId}
                                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-100 dark:border-gray-700 focus:ring-2 focus:ring-nwu-red/10 focus:border-nwu-red outline-none transition-all dark:bg-gray-900 text-sm appearance-none"
                                >
                                    <option value="">Select Department...</option>
                                    {departments.map((dept) => (
                                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Temp Password</label>
                            <div className="relative font-mono">
                                <Key className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                                <input
                                    readOnly
                                    type="text"
                                    value={formData.password}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, password: Math.random().toString(36).slice(-10) })}
                                    className="absolute right-2 top-2 text-[10px] font-bold text-nwu-red hover:bg-nwu-red/5 px-2 py-1.5 rounded-lg border border-nwu-red/10 transition-all"
                                >
                                    REGEN
                                </button>
                            </div>
                        </div>

                        <button
                            disabled={loading}
                            type="submit"
                            className="w-full py-4 bg-nwu-red text-white rounded-2xl font-bold shadow-lg shadow-nwu-red/20 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2 mt-4"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <ShieldCheck className="h-5 w-5" />
                                    <span>Authorize Access</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
        </div >
    );
}
