"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users, UserCheck, ShieldAlert, KeyRound, Monitor } from "lucide-react";
import { cn } from "@/utils/cn";
import { useProfile } from "@/context/ProfileContext";

const tabs = [
    // Regular Admin Tabs
    { name: "Overview", href: "/dashboard/admin", icon: ShieldAlert, superAdminOnly: false, hideForSuperAdmin: true },
    { name: "Rooms", href: "/dashboard/admin/rooms", icon: Building2, superAdminOnly: false, hideForSuperAdmin: true },
    { name: "Departments", href: "/dashboard/admin/departments", icon: Building2, superAdminOnly: false, hideForSuperAdmin: true },
    { name: "Instructors", href: "/dashboard/admin/instructors", icon: Users, superAdminOnly: false, hideForSuperAdmin: true },

    // Super Admin "Admin Management" Tabs
    { name: "Provisioning", href: "/dashboard/admin/provisioning", icon: UserCheck, superAdminOnly: true, hideForSuperAdmin: false },
    { name: "Devices", href: "/dashboard/admin/devices", icon: KeyRound, superAdminOnly: false, hideForSuperAdmin: false },
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
        <div className="flex flex-wrap gap-1 glass-panel px-1.5 py-1.5 rounded-2xl mb-8 w-fit bg-dark-bg/60">
            {visibleTabs.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                    <Link
                        key={tab.name}
                        href={tab.href}
                        className={cn(
                            "flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300",
                            isActive
                                ? "bg-nu-500 text-white shadow-glow-red"
                                : "text-gray-400 hover:text-white hover:bg-white/10"
                        )}
                    >
                        <tab.icon className={cn("mr-2 h-4 w-4", isActive ? "animate-pulse" : "")} />
                        {tab.name}
                    </Link>
                );
            })}
        </div>
    );
}
