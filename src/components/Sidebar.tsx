"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signout } from "@/app/login/actions";
import { useProfile } from "@/context/ProfileContext";
import { LayoutDashboard, Users, ClipboardList, Settings, BookOpen, LogOut, User, Info } from "lucide-react";
import { cn } from "@/utils/cn";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Attendance", href: "/attendance", icon: ClipboardList },
    { name: "Classes", href: "/classes", icon: BookOpen },
    { name: "Students", href: "/students", icon: Users },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "About", href: "/about", icon: Info },
];

import { User as SupabaseUser } from "@supabase/supabase-js";

export function Sidebar({ onLinkClick }: { onLinkClick?: () => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const supabase = createClient();
    const { profile, clearProfile } = useProfile();

    const handleAdminClick = () => {
        router.push("/dashboard/admin/departments");
    };

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
                    {navigation.map((item) => {
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
                            {profile?.name?.[0]?.toUpperCase() || user?.user_metadata?.full_name?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-white group-hover:text-nwu-gold transition-colors">
                                {profile?.name || user?.user_metadata?.full_name || "User"}
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

                    {/* Admin Console Link - Only for Admin Role */}
                    {profile?.role === "admin" && (
                        <div className="pt-2 border-t border-white/10 mt-2">
                            <button
                                onClick={handleAdminClick}
                                className="flex w-full items-center px-4 py-2 text-sm font-bold text-nwu-gold hover:bg-[#5e0d0e] rounded-md transition-colors"
                            >
                                <Settings className="mr-3 h-5 w-5" />
                                Admin Console
                            </button>
                        </div>
                    )}
                </div>
            </div>

        </>
    );
}
