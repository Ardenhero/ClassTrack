"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users, LayoutDashboard, UserCheck } from "lucide-react";
import { cn } from "@/utils/cn";
import { useProfile } from "@/context/ProfileContext";

const tabs = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, superAdminOnly: false, hideForSuperAdmin: false },
    { name: "Departments", href: "/dashboard/admin/departments", icon: Building2, superAdminOnly: false, hideForSuperAdmin: true },
    { name: "Instructors", href: "/dashboard/admin/instructors", icon: Users, superAdminOnly: false, hideForSuperAdmin: true },
    { name: "Approvals", href: "/dashboard/admin/approvals", icon: UserCheck, superAdminOnly: true, hideForSuperAdmin: false },
];

export function AdminNav() {
    const pathname = usePathname();
    const { profile } = useProfile();
    const isSuperAdmin = profile?.is_super_admin ?? false;

    const visibleTabs = tabs.filter(tab => {
        if (isSuperAdmin) {
            return !tab.hideForSuperAdmin;
        } else {
            return !tab.superAdminOnly;
        }
    });

    return (
        <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
            {visibleTabs.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                    <Link
                        key={tab.name}
                        href={tab.href}
                        className={cn(
                            "flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all",
                            isActive
                                ? "bg-white text-nwu-red shadow-sm"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                        )}
                    >
                        <tab.icon className="mr-2 h-4 w-4" />
                        {tab.name}
                    </Link>
                );
            })}
        </div>
    );
}
