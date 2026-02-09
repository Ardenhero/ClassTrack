import DashboardLayout from "@/components/DashboardLayout";
import { ModeToggle } from "@/components/ModeToggle";
import { Fingerprint } from "lucide-react";
import { DeleteSection } from "./DeleteSection";
import { getProfileRole } from "@/lib/auth-utils";

export default async function SettingsPage() {
    const role = await getProfileRole();

    return (
        <DashboardLayout>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

            <div className="space-y-8">
                {/* Appearance Section */}
                <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Appearance</h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-700 dark:text-gray-300">Theme Mode</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Toggle between light and dark themes</p>
                        </div>
                        <ModeToggle />
                    </div>
                </section>

                <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
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

                <DeleteSection role={role} />
            </div>
        </DashboardLayout>
    );
}

export const dynamic = 'force-dynamic';
