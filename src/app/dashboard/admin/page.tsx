"use client";

import { useProfile } from "@/context/ProfileContext";
import { AdminBiometricMatrix } from "@/components/AdminBiometricMatrix";
import { Users, BookOpen, ShieldCheck, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
    const { profile } = useProfile();

    return (
        <div className="animate-in fade-in duration-500">
            <div className="mb-6">
                <p className="text-gray-500 dark:text-gray-400">
                    Welcome back, <span className="font-semibold text-gray-900 dark:text-white">{profile?.name || 'Admin'}</span>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Stats / Quick Links */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link href="/dashboard/admin/instructors" className="group bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-nwu-red/50 transition-colors">
                        <div className="flex justify-between items-start">
                            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <Users className="h-6 w-6" />
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-nwu-red" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">Manage Instructors</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">View and manage instructor accounts and their classes.</p>
                    </Link>

                    <Link href="/classes" className="group bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-nwu-red/50 transition-colors">
                        <div className="flex justify-between items-start">
                            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                <BookOpen className="h-6 w-6" />
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-nwu-red" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">All Classes</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Oversee all scheduled classes across the system.</p>
                    </Link>

                    <Link href="/reports" className="group bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-nwu-red/50 transition-colors md:col-span-2">
                        <div className="flex justify-between items-start">
                            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4 text-red-600 dark:text-red-400 group-hover:bg-red-600 group-hover:text-white transition-colors">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-nwu-red" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">System Reports</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">View attendance analytics and system-wide performance reports.</p>
                    </Link>
                </div>

                {/* Biometric Matrix */}
                <div className="lg:col-span-1">
                    <AdminBiometricMatrix />
                </div>
            </div>
        </div>
    );
}
