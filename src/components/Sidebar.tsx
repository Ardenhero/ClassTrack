"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signout } from "@/app/login/actions";
import { useProfile } from "@/context/ProfileContext";
import { cn } from "@/utils/cn";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
    LayoutDashboard,
    Users,
    ClipboardList,
    Settings,
    BookOpen,
    LogOut,
    User,
    Info,
    ShieldCheck,
    Building2,
    ShieldAlert,
    ChevronDown,
    ChevronRight,
    Search,
    FileCheck,
    BarChart3,
    KeyRound,
} from "lucide-react";

// Instructor Navigation (full access including Evidence)
const instructorNavigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Attendance", href: "/attendance", icon: ClipboardList },
    { name: "Evidence Queue", href: "/evidence", icon: FileCheck },
    { name: "Classes", href: "/classes", icon: BookOpen },
    { name: "Students", href: "/students", icon: Users },
    { name: "Reports", href: "/reports", icon: BarChart3 },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "About", href: "/about", icon: Info },
];

// System Admin Navigation (with Dashboard, no Evidence)
const adminNavigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Attendance", href: "/attendance", icon: ClipboardList },
    { name: "Classes", href: "/classes", icon: BookOpen },
    { name: "Students", href: "/students", icon: Users },
    { name: "Reports", href: "/reports", icon: BarChart3 },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "About", href: "/about", icon: Info },
];

// Super Admin "Unpacked" Navigation (no Evidence Queue)
const superAdminNavigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Admin Management", href: "/dashboard/admin/provisioning", icon: ShieldCheck },
    { name: "Security", href: "/dashboard/admin/security", icon: KeyRound },
    { name: "Departments", href: "/dashboard/admin/departments", icon: Building2 },
    // Global Directory is handled separately as a dropdown
    { name: "Reports", href: "/reports", icon: BarChart3 },
    { name: "Audit Logs", href: "/dashboard/admin/audit-logs", icon: ShieldAlert },
    { name: "System Info", href: "/about", icon: Info },
];

import { User as SupabaseUser } from "@supabase/supabase-js";

export function Sidebar({ onLinkClick }: { onLinkClick?: () => void }) {
    const pathname = usePathname();

    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [isDirOpen, setIsDirOpen] = useState(false);
    const supabase = createClient();
    const { profile, clearProfile, isSwitching } = useProfile();

    const isSuperAdmin = profile?.is_super_admin || profile?.role === 'admin' && profile?.name === 'Super Admin';
    const isAdmin = profile?.role === 'admin' && !isSuperAdmin;

    const navItems = isSuperAdmin ? superAdminNavigation : isAdmin ? adminNavigation : instructorNavigation;

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        }
        getUser();
    }, [supabase]);

    return (
        <>
            <div className="flex bg-nwu-red h-full w-full flex-col text-white shadow-xl">
                <div className="flex h-20 items-center px-4 border-b border-nwu-red/50 shrink-0 bg-[#5e0d0e]">
                    <div className="flex items-center space-x-3">
                        <Image
                            src="/branding/nwu_seal.png"
                            alt="NWU Seal"
                            width={40}
                            height={40}
                            className="h-10 w-10 object-contain rounded-full border border-white/20 bg-white"
                        />
                        <div>
                            <span className="block text-sm font-bold font-serif tracking-wider">NORTHWESTERN</span>
                            <span className="block text-xs text-nwu-gold font-medium tracking-widest">UNIVERSITY</span>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                    {navItems.map((item) => {
                        // Handle the gap where Global Directory should be for Super Admin
                        if (isSuperAdmin && item.name === 'Departments') {
                            return (
                                <div key="nav-group-admin" className="space-y-2">
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={onLinkClick}
                                        className={cn(
                                            "flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200",
                                            pathname === item.href
                                                ? "bg-white text-nwu-red shadow-md font-bold"
                                                : "text-white/80 hover:bg-[#5e0d0e] hover:text-white"
                                        )}
                                    >
                                        <item.icon className="mr-3 h-5 w-5" />
                                        {item.name}
                                    </Link>

                                    {/* Global Directory Dropdown */}
                                    <div className="space-y-1">
                                        <button
                                            onClick={() => setIsDirOpen(!isDirOpen)}
                                            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-white/80 hover:bg-[#5e0d0e] hover:text-white rounded-md transition-all group"
                                        >
                                            <div className="flex items-center">
                                                <Search className="mr-3 h-5 w-5" />
                                                <span>Global Directory</span>
                                            </div>
                                            {isDirOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </button>
                                        {isDirOpen && (
                                            <div className="pl-12 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                                <Link
                                                    href="/classes"
                                                    onClick={onLinkClick}
                                                    className={cn(
                                                        "block py-2 text-sm transition-colors",
                                                        pathname === "/classes" ? "text-nwu-gold font-bold" : "text-white/60 hover:text-white"
                                                    )}
                                                >
                                                    Read-Only Classes
                                                </Link>
                                                <Link
                                                    href="/students"
                                                    onClick={onLinkClick}
                                                    className={cn(
                                                        "block py-2 text-sm transition-colors",
                                                        pathname === "/students" ? "text-nwu-gold font-bold" : "text-white/60 hover:text-white"
                                                    )}
                                                >
                                                    Read-Only Students
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={onLinkClick}
                                className={cn(
                                    "flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200",
                                    isActive
                                        ? "bg-white text-nwu-red shadow-md font-bold"
                                        : "text-white/80 hover:bg-[#5e0d0e] hover:text-white"
                                )}
                            >
                                <item.icon className="mr-3 h-5 w-5" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-nwu-red/50 shrink-0 space-y-4 bg-[#5e0d0e]/50">
                    <Link href="/profile" className="flex items-center hover:bg-[#5e0d0e] p-2 rounded-lg transition-colors group">
                        <div className="h-8 w-8 rounded-full bg-nwu-gold flex items-center justify-center text-xs text-nwu-red font-bold">
                            {isSwitching ? "..." : (profile?.name?.[0]?.toUpperCase() || user?.user_metadata?.full_name?.[0]?.toUpperCase() || <User className="h-4 w-4" />)}
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-white group-hover:text-nwu-gold transition-colors">
                                {isSwitching ? "Switching..." : (profile?.name || user?.user_metadata?.full_name || "User")}
                            </p>
                            <p className="text-xs text-gray-400">View Profile</p>
                        </div>
                    </Link>

                    <button
                        onClick={() => clearProfile()}
                        className="flex w-full items-center px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors mb-1"
                    >
                        <User className="mr-3 h-5 w-5" />
                        Switch Profile
                    </button>

                    <form action={signout}>
                        <button
                            type="submit"
                            className="flex w-full items-center px-4 py-2 text-sm font-medium text-gray-400 hover:bg-red-900/30 hover:text-red-400 rounded-md transition-colors"
                        >
                            <LogOut className="mr-3 h-5 w-5" />
                            Sign Out
                        </button>
                    </form>

                    {/* Reset Profile PIN - Only for Regular Admin Role */}
                    {profile?.role === "admin" && !isSuperAdmin && (
                        <div className="pt-2 border-t border-white/10 mt-2">
                            <Link
                                href="/dashboard/admin/security"
                                onClick={onLinkClick}
                                className="flex w-full items-center px-4 py-2 text-sm font-bold text-nwu-gold hover:bg-[#5e0d0e] rounded-md transition-colors"
                            >
                                <KeyRound className="mr-3 h-5 w-5" />
                                Reset Profile PIN
                            </Link>
                        </div>
                    )}
                </div>
            </div>

        </>
    );
}
