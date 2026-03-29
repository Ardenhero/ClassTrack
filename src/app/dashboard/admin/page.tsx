// src/app/dashboard/admin/page.tsx is now a Server Component

import { AdminBiometricMatrix } from "../../../components/AdminBiometricMatrix";


export default async function AdminDashboardPage() {
    return (
        <div className="space-y-6">
            {/* Sensor Memory Map */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:hover:shadow-[0_4px_20px_rgb(255,255,255,0.05)]">
                <AdminBiometricMatrix />
            </div>
        </div>
    );
}
