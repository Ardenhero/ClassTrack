"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users, UserCheck, ShieldAlert, KeyRound, Monitor } from "lucide-react";
import { cn } from "../../../../utils/cn";
import { useProfile } from "../../../../context/ProfileContext";

const tabs = [
    // Regular Admin Tabs
    // Regular Admin Tabs
    { name: "Overview", href: "/dashboard/admin", icon: ShieldAlert, superAdminOnly: false, hideForSuperAdmin: true },
    { name: "Instructors", href: "/dashboard/admin/instructors", icon: Users, superAdminOnly: false, hideForSuperAdmin: true },

    // Super Admin "Admin Management" Tabs
    { name: "Departments", href: "/dashboard/admin/departments", icon: Building2, superAdminOnly: true, hideForSuperAdmin: false },
    { name: "Provisioning", href: "/dashboard/admin/provisioning", icon: UserCheck, superAdminOnly: true, hideForSuperAdmin: false },
    { name: "Rooms", href: "/dashboard/admin/rooms", icon: Building2, superAdminOnly: false, hideForSuperAdmin: false },
    { name: "Devices", href: "/dashboard/admin/devices", icon: KeyRound, superAdminOnly: true, hideForSuperAdmin: false },
    { name: "Kiosks", href: "/dashboard/admin/kiosks", icon: Monitor, superAdminOnly: false, hideForSuperAdmin: false },
    { name: "Security", href: "/dashboard/admin/security", icon: KeyRound, superAdminOnly: false, hideForSuperAdmin: false },
    { name: "Audit Logs", href: "/dashboard/admin/audit-logs", icon: ShieldAlert, superAdminOnly: true, hideForSuperAdmin: false },
];

export function AdminNav() {
    const pathname = usePathname();
    const { profile } = useProfile();
    // Fallback to name check if flag is missing from cache
    const isSuperAdmin = profile?.is_super_admin || profile?.name === 'Super Admin';

    const visibleTabs = tabs.filter(tab => {
        if (isSuperAdmin) {
            return !tab.hideForSuperAdmin;
        } else {
            return !tab.superAdminOnly;
        }
    });



    return (
        <nav className="flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-xl mb-6 w-fit" role="tablist">
            {visibleTabs.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                    <Link
                        key={tab.name}
                        href={tab.href}
                        className={cn(
                            "flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all",
                            isActive
                                ? "bg-white dark:bg-gray-700 text-nwu-red shadow-sm"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50"
                        )}
                        aria-current={isActive ? "page" : undefined}
                        role="tab"
                    >
                        <tab.icon className="mr-2 h-4 w-4" aria-hidden="true" />
                        {tab.name}
                    </Link>
                );
            })}
        </nav>
    );
}
