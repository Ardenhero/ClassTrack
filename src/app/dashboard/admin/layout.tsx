"use client";

import { useProfile } from "../../../context/ProfileContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { AdminNav } from "./components/AdminNav";
import DashboardLayout from "../../../components/DashboardLayout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useProfile();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading) {
            if (!profile) {
                router.push("/identity");
            } else if (profile.role !== "admin") {
                router.push("/");
            } else if (!profile.is_super_admin) {
                // Restrict Department Admins from Super Admin Only pages
                const superAdminPaths = [
                    "/dashboard/admin/departments",
                    "/dashboard/admin/provisioning",
                    "/dashboard/admin/devices", // This refers to Device Inventory
                    "/dashboard/admin/audit-logs",
                    "/dashboard/admin/deletion-requests"
                ];
                
                if (superAdminPaths.some(path => pathname.startsWith(path))) {
                    console.warn(`[AdminLayout] Redirecting unauthorized access to ${pathname}`);
                    router.push("/dashboard/admin");
                }
            }
        }
    }, [profile, loading, router, pathname]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
                <Loader2 className="h-8 w-8 animate-spin text-nwu-red" />
            </div>
        );
    }

    if (!profile || profile.role !== "admin") {
        return null; // Or a "Not Authorized" message, but redirect will handle it
    }

    const isSuperAdmin = profile?.is_super_admin;

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                {!isSuperAdmin && (
                    <>
                        <h1 className="text-3xl font-bold text-nwu-red mb-2">Admin Console</h1>
                        <p className="text-gray-500 mb-8 max-w-2xl">
                            View room assignments, kiosks and instructors. Manage biometric memory map and instructor room assignments.
                        </p>
                    </>
                )}

                {/* Only show AdminNav tabs for the main console pages, hide for independent tools like Audit Trail/Deletion Requests */}
                {!["/dashboard/admin/deletion-requests", "/dashboard/admin/audit-logs"].includes(pathname) && (
                    <AdminNav />
                )}

                {children}
            </div>
        </DashboardLayout>
    );
}
