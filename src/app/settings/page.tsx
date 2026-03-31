import DashboardLayout from "@/components/DashboardLayout";
import { ModeToggle } from "@/components/ModeToggle";
import { Fingerprint, Calendar } from "lucide-react";
import { DeleteSection } from "./DeleteSection";
import { checkIsSuperAdmin, getProfileRole } from "@/lib/auth-utils";
import { initializeStorage } from "./actions";
import { createClient } from "@/utils/supabase/server";

export default async function SettingsPage() {
    try {
        // 1. Silently ensure storage is ready
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error("CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing from environment.");
        } else {
            await initializeStorage();
        }

        const isSuperAdmin = await checkIsSuperAdmin();
        const role = await getProfileRole();
        const isAdmin = role === 'admin';

        const supabase = createClient();
        const { data: activeTerm } = await supabase
            .from('academic_terms')
            .select('name, academic_years(name)')
            .eq('is_active', true)
            .maybeSingle();

        return (
            <DashboardLayout>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

                <div className="space-y-8">
                    {/* Academic Management Link (Super Admin Only) */}
                    {isSuperAdmin && (
                        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:hover:shadow-[0_4px_20px_rgb(255,255,255,0.05)]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="h-12 w-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                                        <Calendar className="h-6 w-6 text-blue-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Academic Periods</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage academic years, semesters, and historical records</p>
                                    </div>
                                </div>
                                <a
                                    href="/settings/academic"
                                    className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
                                >
                                    Manage
                                </a>
                            </div>
                        </section>
                    )}

                    {/* Academic Status (All Instructors) */}
                    {!isSuperAdmin && (
                        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:hover:shadow-[0_4px_20px_rgb(255,255,255,0.05)]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="h-12 w-12 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                                        <Calendar className="h-6 w-6 text-purple-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active Period</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Current university-wide academic session</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="inline-flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-black uppercase tracking-widest border border-green-200 dark:border-green-800/30">
                                        {activeTerm ? `${(Array.isArray(activeTerm.academic_years) ? (activeTerm.academic_years as unknown as { name: string }[])[0] : (activeTerm.academic_years as unknown as { name: string }))?.name || ""} ${activeTerm.name}` : "No Active Term"}
                                    </span>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Appearance Section */}
                    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:hover:shadow-[0_4px_20px_rgb(255,255,255,0.05)]">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Appearance</h2>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-700 dark:text-gray-300">Theme Mode</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Toggle between light and dark themes</p>
                            </div>
                            <ModeToggle />
                        </div>
                    </section>

                    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:hover:shadow-[0_4px_20px_rgb(255,255,255,0.05)]">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Hardware Info</h2>
                        <div className="flex items-center space-x-4">
                            <div className="h-12 w-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                <Fingerprint className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">Biometric Terminal #1</p>
                                <p className="text-sm text-green-600">Online • Firmware v2.1.0</p>
                            </div>
                        </div>
                    </section>

                    <DeleteSection isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
                </div>
            </DashboardLayout>
        );
    } catch (error) {
        console.error("Critical error in SettingsPage:", error);
        return (
            <DashboardLayout>
                <div className="p-8 text-center bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/30">
                    <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Settings Load Failed</h2>
                    <p className="text-sm text-red-600 dark:text-red-400/80">
                        {error instanceof Error ? error.message : "An unexpected server error occurred."}
                    </p>
                </div>
            </DashboardLayout>
        );
    }
}

export const dynamic = 'force-dynamic';
