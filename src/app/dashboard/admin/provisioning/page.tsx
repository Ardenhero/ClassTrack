"use client";

import { useState } from "react";
import { UserPlus, Shield, Mail, Key, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function ProvisioningPage() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        email: "",
        name: "",
        departmentId: "",
        password: Math.random().toString(36).slice(-10) // Generate temp password
    });

    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // 1. Create User in Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        name: formData.name,
                        role: 'admin'
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Failed to create user");

            // 2. Create Instructor Record (Admin Profile)
            const { error: profileError } = await supabase
                .from('instructors')
                .insert({
                    auth_user_id: authData.user.id,
                    user_id: authData.user.id,
                    owner_id: authData.user.id,
                    name: formData.name,
                    role: 'admin',
                    department_id: formData.departmentId || null,
                    is_super_admin: false,
                    is_visible_on_kiosk: false
                });

            if (profileError) throw profileError;

            setSuccess(`Provisioning successful! Temp Password: ${formData.password}`);
            setFormData({
                email: "",
                name: "",
                departmentId: "",
                password: Math.random().toString(36).slice(-10)
            });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-3 mb-8">
                    <div className="p-3 bg-nwu-red rounded-2xl text-white">
                        <UserPlus className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Provision Admin Account</h1>
                        <p className="text-sm text-gray-500">Manually generate credentials for College Deans</p>
                    </div>
                </div>

                {success && (
                    <div className="mb-8 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-start space-x-3 animate-in slide-in-from-top duration-300">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-green-800">Account Provisioned Successfully</p>
                            <p className="text-xs text-green-700 mt-1 font-mono bg-white inline-block px-2 py-1 rounded border border-green-200">
                                {success}
                            </p>
                            <p className="text-[10px] text-green-600 mt-2 uppercase tracking-wider font-bold">
                                Please provide these credentials to the respective Admin.
                            </p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                                <Mail className="h-4 w-4 mr-2 text-gray-400" />
                                Email Address
                            </label>
                            <input
                                required
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red outline-none transition-all dark:bg-gray-900"
                                placeholder="dean@university.edu"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                                <Shield className="h-4 w-4 mr-2 text-gray-400" />
                                Full Name
                            </label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red outline-none transition-all dark:bg-gray-900"
                                placeholder="Dr. Jane Doe"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                            <Key className="h-4 w-4 mr-2 text-gray-400" />
                            Temporary Password
                        </label>
                        <div className="relative">
                            <input
                                readOnly
                                type="text"
                                value={formData.password}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 font-mono text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, password: Math.random().toString(36).slice(-10) })}
                                className="absolute right-3 top-2.5 text-[10px] font-bold text-nwu-red hover:bg-nwu-red/5 px-2 py-1.5 rounded-lg border border-nwu-red/20 transition-all uppercase tracking-wider"
                            >
                                Regenerate
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 italic">User will be prompted to change this on first login.</p>
                    </div>

                    <button
                        disabled={loading}
                        type="submit"
                        className="w-full py-4 bg-nwu-red text-white rounded-2xl font-bold shadow-lg shadow-nwu-red/20 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                <UserPlus className="h-5 w-5" />
                                <span>Generate Admin Access</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
