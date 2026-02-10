"use client";

import { useProfile } from "@/context/ProfileContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { AdminNav } from "./components/AdminNav";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useProfile();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!profile) {
                router.push("/identity");
            } else if (profile.role !== "admin") {
                router.push("/");
            }
        }
    }, [profile, loading, router]);

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
                        <p className="text-gray-500 mb-8">Manage departments, instructors, and system settings.</p>
                    </>
                )}

                <AdminNav />

                {children}
            </div>
        </DashboardLayout>
    );
}
