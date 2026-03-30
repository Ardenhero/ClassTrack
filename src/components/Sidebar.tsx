"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signout } from "../app/login/actions";
import { useProfile } from "../context/ProfileContext";
import { cn } from "../utils/cn";
import { useState, useEffect } from "react";
import { createClient } from "../utils/supabase/client";
import {
    LayoutDashboard,
    ClipboardList,
    Settings,
    BookOpen,
    LogOut,
    User,
    Info,
    ShieldCheck,
    ChevronDown,
    ChevronRight,
    Search,

    ChevronLeft,
    QrCode,
    Mail as MailIcon,
    GraduationCap,
} from "lucide-react";

// Instructor Navigation (full access including Evidence)
const instructorNavigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Attendance", href: "/attendance", icon: ClipboardList },
    { name: "Mails", href: "/mails", icon: MailIcon },
    // Directory dropdown containing Classes, Students, and Archived goes here
    { name: "QR Attendance", href: "/dashboard/scanner", icon: QrCode },

    { name: "Settings", href: "/settings", icon: Settings },
    { name: "About", href: "/about", icon: Info },
];

// System Admin Navigation (with Dashboard, no Evidence)
const adminNavigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Attendance", href: "/attendance", icon: ClipboardList },
    { name: "Mails", href: "/mails", icon: MailIcon },
    { name: "QR Attendance", href: "/dashboard/scanner", icon: QrCode },
    { name: "Enrollment List", href: "/enrollment-list", icon: GraduationCap },

    { name: "Admin Console", href: "/dashboard/admin", icon: ShieldCheck },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "About", href: "/about", icon: Info },
];

// Administrator "Unpacked" Navigation (focused on System & IoT)
const superAdminNavigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Attendance", href: "/attendance", icon: ClipboardList },
    { name: "Admin Management", href: "/dashboard/admin/provisioning", icon: ShieldCheck },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "About", href: "/about", icon: Info },
];

import { User as SupabaseUser } from "@supabase/supabase-js";

interface SidebarProps {
    onLinkClick?: () => void;
    isCollapsed?: boolean;
    toggleCollapse?: () => void;
}

export function Sidebar({ onLinkClick, isCollapsed = false, toggleCollapse }: SidebarProps) {
    const pathname = usePathname();
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [isDirOpen, setIsDirOpen] = useState(false);
    const [pendingMailsCount, setPendingMailsCount] = useState<number>(0);
    const supabase = createClient();
    const { profile, clearProfile, isSwitching } = useProfile();

    const isSuperAdmin = profile?.is_super_admin || (profile?.role === 'admin' && profile?.name === 'Super Admin');
    const isAdmin = profile?.role === 'admin' && !isSuperAdmin;

    const navItems = isSuperAdmin ? superAdminNavigation : isAdmin ? adminNavigation : instructorNavigation;

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        }
        getUser();
    }, [supabase]);

    useEffect(() => {
        if (!profile?.id || profile.role !== 'instructor') return;

        const fetchPendingCount = async () => {
            try {
                const { count } = await supabase
                    .from("evidence_documents")
                    .select("id, classes!inner(instructor_id)", { count: 'exact', head: true })
                    .eq("status", "pending")
                    .eq("classes.instructor_id", profile.id);

                setPendingMailsCount(count || 0);
            } catch (err) {
                console.error("Error fetching pending count:", err);
            }
        };

        fetchPendingCount();

        // Optimized real-time: Debounce re-fetches to prevent "slow loading" feeling
        // when multiple rows update simultaneously.
        let debounceTimer: NodeJS.Timeout;

        const channel = supabase
            .channel('sidebar-pending-mails')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'evidence_documents'
                },
                () => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => fetchPendingCount(), 2000);
                }
            )
            .subscribe();

        return () => {
            clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
        };
    }, [profile?.id, profile?.role, supabase]);

    // BEHAVIORAL CHANGE: Removed skeleton loader to allow smooth switching (persistent sidebar).
    // The footer handles the "Switching..." visual state.

    return (
        <>
            <div className="flex bg-nwu-red h-full w-full flex-col text-white shadow-xl">
                <div className="flex h-20 items-center justify-between px-4 border-b border-nwu-red/50 shrink-0 bg-[#5e0d0e] transition-all overflow-hidden relative">
                    <div className={cn("flex items-center space-x-3 transition-all duration-200 overflow-hidden whitespace-nowrap", isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto")}>
                        <Image
                            src="/branding/nwu_seal.png"
                            alt="NWU Seal"
                            width={40}
                            height={40}
                            className="h-10 w-10 object-contain rounded-full border border-white/20 bg-white flex-shrink-0"
                        />
                        <div className="overflow-hidden">
                            <span className="block text-sm font-bold font-serif tracking-wider">NORTHWESTERN</span>
                            <span className="block text-xs text-nwu-gold font-medium tracking-widest">UNIVERSITY</span>
                        </div>
                    </div>

                    {/* Mini Logo (Centered when collapsed) */}
                    <div className={cn(
                        "absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200",
                        isCollapsed ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
                    )}>
                        <Image
                            src="/branding/nwu_seal.png"
                            alt="NWU Seal"
                            width={32}
                            height={32}
                            className="h-8 w-8 object-contain rounded-full border border-white/20 bg-white"
                        />
                    </div>

                    <button
                        onClick={toggleCollapse}
                        className="p-1 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors z-10"
                        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isCollapsed ? <ChevronRight className="h-5 w-5" aria-hidden="true" /> : <ChevronLeft className="h-5 w-5" aria-hidden="true" />}
                    </button>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                    {navItems.map((item) => {
                        // Only System Admin gets the Directory dropdown. Administrator is purely System/IoT focused now.
                        const isSystemAdmin = !isSuperAdmin && profile?.role === 'admin';
                        const shouldRenderDropdown = isSystemAdmin && item.name === 'Attendance';

                        if (shouldRenderDropdown) {
                            return (
                                <div key="nav-group-admin" className="space-y-2">
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={onLinkClick}
                                        className={cn(
                                            "flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200 whitespace-nowrap relative",
                                            pathname === item.href
                                                ? "bg-white text-nwu-red shadow-md font-bold"
                                                : "text-white/80 hover:bg-[#5e0d0e] hover:text-white"
                                        )}
                                        title={isCollapsed ? item.name : undefined}
                                    >
                                        <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                                        <span className={cn("transition-opacity duration-200", isCollapsed ? "opacity-0 w-0" : "opacity-100")}>
                                            {item.name}
                                        </span>
                                    </Link>

                                    {/* Global Directory Dropdown */}
                                    <div className="space-y-1">
                                        <button
                                            onClick={() => {
                                                if (isCollapsed && toggleCollapse) toggleCollapse(); // Expand if clicking group while collapsed
                                                setIsDirOpen(!isDirOpen);
                                            }}
                                            className={cn(
                                                "flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-white/80 hover:bg-[#5e0d0e] hover:text-white rounded-md transition-all group relative",
                                                isCollapsed && "justify-center px-2"
                                            )}
                                            title={isCollapsed ? "Global Directory" : undefined}
                                            aria-label={isCollapsed ? "Global Directory" : (isDirOpen ? "Collapse Directory" : "Expand Directory")}
                                            aria-expanded={isDirOpen}
                                        >
                                            <div className="flex items-center">
                                                <Search className={cn("h-5 w-5", isCollapsed ? "mr-0" : "mr-3")} aria-hidden="true" />
                                                {!isCollapsed && <span>{isSuperAdmin ? "Global Directory" : "Directory"}</span>}
                                            </div>
                                            {!isCollapsed && (isDirOpen ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />)}
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
                                                    {isSuperAdmin ? "Read-Only Classes" : "Classes"}
                                                </Link>
                                                <Link
                                                    href="/students"
                                                    onClick={onLinkClick}
                                                    className={cn(
                                                        "block py-2 text-sm transition-colors",
                                                        pathname === "/students" ? "text-nwu-gold font-bold" : "text-white/60 hover:text-white"
                                                    )}
                                                >
                                                    {isSuperAdmin ? "Read-Only Students" : "Students"}
                                                </Link>
                                                <Link
                                                    href="/archived"
                                                    onClick={onLinkClick}
                                                    className={cn(
                                                        "block py-2 text-sm transition-colors",
                                                        pathname === "/archived" ? "text-nwu-gold font-bold" : "text-white/60 hover:text-white"
                                                    )}
                                                >
                                                    {isSuperAdmin ? "Read-Only Archived" : "Archived"}
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        // Handle the gap where Directory should be for standard Instructors
                        const isInstructor = !isSuperAdmin && profile?.role === 'instructor';
                        const shouldRenderInstructorDirectory = isInstructor && item.name === 'Mails';

                        if (shouldRenderInstructorDirectory) {
                            return (
                                <div key="nav-group-instructor" className="space-y-2">
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={onLinkClick}
                                        className={cn(
                                            "flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200 whitespace-nowrap relative",
                                            pathname === item.href
                                                ? "bg-white text-nwu-red shadow-md font-bold"
                                                : "text-white/80 hover:bg-[#5e0d0e] hover:text-white"
                                        )}
                                        title={isCollapsed ? item.name : undefined}
                                    >
                                        <item.icon className={cn("h-5 w-5 flex-shrink-0", isCollapsed ? "mr-0" : "mr-3")} />
                                        <span className={cn("transition-opacity duration-200", isCollapsed ? "opacity-0 w-0" : "opacity-100")}>
                                            {item.name}
                                        </span>
                                        {pendingMailsCount > 0 && (
                                            <span className={cn(
                                                "bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center min-w-[18px] h-[18px] px-1 animate-in zoom-in duration-300",
                                                isCollapsed ? "absolute -top-1 -right-1 border-2 border-nwu-red" : "ml-auto"
                                            )}>
                                                {pendingMailsCount > 99 ? "99+" : pendingMailsCount}
                                            </span>
                                        )}
                                    </Link>

                                    {/* Instructor Directory Dropdown */}
                                    <div className="space-y-1">
                                        <button
                                            onClick={() => {
                                                if (isCollapsed && toggleCollapse) toggleCollapse();
                                                setIsDirOpen(!isDirOpen);
                                            }}
                                            className={cn(
                                                "flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-white/80 hover:bg-[#5e0d0e] hover:text-white rounded-md transition-all group relative",
                                                isCollapsed && "justify-center px-2"
                                            )}
                                            title={isCollapsed ? "Directory" : undefined}
                                            aria-label={isCollapsed ? "Directory" : (isDirOpen ? "Collapse Directory" : "Expand Directory")}
                                            aria-expanded={isDirOpen}
                                        >
                                            <div className="flex items-center">
                                                <BookOpen className={cn("h-5 w-5", isCollapsed ? "mr-0" : "mr-3")} aria-hidden="true" />
                                                {!isCollapsed && <span>Directory</span>}
                                            </div>
                                            {!isCollapsed && (isDirOpen ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />)}
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
                                                    Classes
                                                </Link>
                                                <Link
                                                    href="/students"
                                                    onClick={onLinkClick}
                                                    className={cn(
                                                        "block py-2 text-sm transition-colors",
                                                        pathname === "/students" ? "text-nwu-gold font-bold" : "text-white/60 hover:text-white"
                                                    )}
                                                >
                                                    Students
                                                </Link>
                                                <Link
                                                    href="/archived"
                                                    onClick={onLinkClick}
                                                    className={cn(
                                                        "block py-2 text-sm transition-colors",
                                                        pathname === "/archived" ? "text-nwu-gold font-bold" : "text-white/60 hover:text-white"
                                                    )}
                                                >
                                                    Archived
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
                                    "flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200 relative group",
                                    isActive
                                        ? "bg-white text-nwu-red shadow-md font-bold"
                                        : "text-white/80 hover:bg-[#5e0d0e] hover:text-white",
                                    isCollapsed && "justify-center px-2"
                                )}
                                title={isCollapsed ? item.name : undefined}
                            >
                                <item.icon className={cn("h-5 w-5 flex-shrink-0", isCollapsed ? "mr-0" : "mr-3")} />
                                {!isCollapsed && <span className="whitespace-nowrap overflow-hidden">{item.name}</span>}
                                {(item.name === "Mails") && pendingMailsCount > 0 && (
                                    <span className={cn(
                                        "bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center min-w-[18px] h-[18px] px-1 animate-in zoom-in duration-300",
                                        isCollapsed ? "absolute -top-1 -right-1 border-2 border-nwu-red" : "ml-auto"
                                    )}>
                                        {pendingMailsCount > 99 ? "99+" : pendingMailsCount}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-nwu-red/50 shrink-0 space-y-4 bg-[#5e0d0e]/50">
                    <Link href="/profile" className="flex items-center hover:bg-[#5e0d0e] p-2 rounded-lg transition-colors group">
                        <div className="h-8 w-8 rounded-full bg-nwu-gold flex items-center justify-center text-xs text-nwu-red font-bold overflow-hidden relative border border-white/10">
                            {isSwitching ? "..." : (
                                profile?.image_url ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={profile.image_url}
                                        alt={profile.name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    profile?.name?.[0]?.toUpperCase() || user?.user_metadata?.full_name?.[0]?.toUpperCase() || <User className="h-4 w-4" />
                                )
                            )}
                        </div>
                        <div className="ml-3 transition-opacity duration-200" style={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : 'auto', overflow: 'hidden' }}>
                            <p className="text-sm font-medium text-white group-hover:text-nwu-gold transition-colors whitespace-nowrap">
                                {isSwitching ? "Switching..." : (profile?.name === 'Super Admin' ? 'Administrator' : (profile?.name || user?.user_metadata?.full_name || "User"))}
                            </p>
                            <p className="text-xs text-gray-400 whitespace-nowrap">View Profile</p>
                        </div>
                    </Link>

                    {!isSuperAdmin && (
                        <button
                            onClick={() => clearProfile()}
                            className={cn(
                                "flex w-full items-center px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors mb-1",
                                isCollapsed && "justify-center px-2"
                            )}
                            title={isCollapsed ? "Switch Profile" : undefined}
                            aria-label="Switch Profile"
                        >
                            <User className={cn("h-5 w-5", isCollapsed ? "mr-0" : "mr-3")} aria-hidden="true" />
                            {!isCollapsed && "Switch Profile"}
                        </button>
                    )}

                    <form action={signout}>
                        <button
                            type="submit"
                            className={cn(
                                "flex w-full items-center px-4 py-2 text-sm font-medium text-gray-400 hover:bg-red-900/30 hover:text-red-400 rounded-md transition-colors",
                                isCollapsed && "justify-center px-2"
                            )}
                            title={isCollapsed ? "Sign Out" : undefined}
                            aria-label="Sign Out"
                        >
                            <LogOut className={cn("h-5 w-5", isCollapsed ? "mr-0" : "mr-3")} aria-hidden="true" />
                            {!isCollapsed && "Sign Out"}
                        </button>
                    </form>

                    {/* Admin Console Link - Only for Regular Admin Role and they need it here if not in nav */}
                    {/* The adminNavigation/superAdminNavigation now includes specific console links, but let's keep this as a safe fallback or secondary link if needed, 
                        BUT standard adminNavigation already has it. I'll remove the DUPLICATE "Admin Console" button here if it is already in standardAdminNavigation, 
                        to avoid clutter, OR keep it if it was designated as a footer item.
                        Looking at old file: Admin Console WAS in adminNavigation (line 50), AND NOT in footer for admins (line 206 only checks !isSuperAdmin).
                    */}
                </div>
            </div >

        </>
    );
}
