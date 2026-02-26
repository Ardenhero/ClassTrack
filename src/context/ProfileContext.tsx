"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";

// Define the shape of a Profile
export interface Profile {
    id: string;
    name: string;
    role: "admin" | "instructor";
    department_id?: string;
    has_pin?: boolean;
    is_super_admin?: boolean;
}

interface ProfileContextType {
    profile: Profile | null;
    selectProfile: (profile: Profile) => void;
    clearProfile: () => void;
    refreshProfile: () => Promise<void>;
    loading: boolean;
    isSwitching: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSwitching, setIsSwitching] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        const initializeProfile = async () => {
            // Priority 1: LocalStorage (Fastest)
            const stored = localStorage.getItem("sc_profile");
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    setProfile(parsed);

                    // Background hydration for the is_super_admin flag if missing from cache
                    if (parsed.role === 'admin' && typeof parsed.is_super_admin === 'undefined') {
                        supabase.from('instructors')
                            .select('is_super_admin')
                            .eq('id', parsed.id)
                            .maybeSingle()
                            .then(({ data }: { data: { is_super_admin: boolean } | null }) => {
                                if (data) {
                                    const updated = { ...parsed, is_super_admin: data.is_super_admin };
                                    setProfile(updated);
                                    localStorage.setItem("sc_profile", JSON.stringify(updated));
                                }
                            });
                    }

                    setLoading(false);
                    return;
                } catch (e) {
                    console.error("Failed to parse profile", e);
                    localStorage.removeItem("sc_profile");
                }
            }

            // Priority 2: Cookie (Sticky Identity)
            // If we are here, localStorage was empty or invalid.
            // Check if we have a cookie set by a previous session or middleware.
            const match = document.cookie.match(new RegExp('(^| )sc_profile_id=([^;]+)'));
            const cookieProfileId = match ? match[2] : null;

            if (cookieProfileId) {
                console.log("Found sticky profile cookie:", cookieProfileId);

                // 1. Resolve Profile Record (Handle legacy string vs UUID)
                let query = supabase
                    .from('instructors')
                    .select('id, name, department_id, role, pin_enabled, is_super_admin');

                if (cookieProfileId === 'admin-profile') {
                    // Specific fallback for legacy admin request
                    query = query.eq('role', 'admin');
                } else {
                    // Standard UUID resolution
                    query = query.eq('id', cookieProfileId);
                }

                const { data, error } = await query.maybeSingle();

                if (!error && data) {
                    const isAdmin = data.role === 'admin';
                    const hydratedProfile: Profile = {
                        id: data.id,
                        name: data.name || "Department Admin",
                        role: (data.role as "admin" | "instructor") || "instructor",
                        department_id: data.department_id,
                        has_pin: data.pin_enabled,
                        is_super_admin: data.is_super_admin || false
                    };
                    setProfile(hydratedProfile);
                    localStorage.setItem("sc_profile", JSON.stringify(hydratedProfile));
                } else if (cookieProfileId === 'admin-profile') {
                    // Legacy fallback for when the record doesn't exist yet but cookie is present
                    const adminProfile: Profile = {
                        id: "admin-profile",
                        name: "Department Admin",
                        role: "admin",
                        has_pin: false
                    };
                    setProfile(adminProfile);
                    localStorage.setItem("sc_profile", JSON.stringify(adminProfile));
                } else {
                    // Cookie was invalid or instructor deleted? Clear it.
                    console.warn("Sticky profile not found in DB, clearing.");
                    document.cookie = "sc_profile_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                }
            }
            setLoading(false);
        };

        initializeProfile();
    }, [supabase]);



    const refreshProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch latest instructor data
        const { data, error } = await supabase
            .from('instructors')
            .select('id, name, department_id, role, pin_enabled, is_super_admin')
            .eq('id', profile?.id || user.id) // Use existing ID or Auth ID
            .maybeSingle();

        if (!error && data) {
            const isAdmin = data.role === 'admin';
            const updatedProfile: Profile = {
                id: data.id,
                name: data.name || "Department Admin",
                role: (data.role as "admin" | "instructor") || "instructor",
                department_id: data.department_id,
                has_pin: data.pin_enabled,
                is_super_admin: data.is_super_admin || false
            };
            setProfile(updatedProfile);
            localStorage.setItem("sc_profile", JSON.stringify(updatedProfile));
        }
    };

    const selectProfile = (newProfile: Profile) => {
        setProfile(newProfile);
        localStorage.setItem("sc_profile", JSON.stringify(newProfile));

        // Sync to cookie for Middleware & Server Components
        // Max-Age: 1 year (31536000 seconds)
        document.cookie = `sc_profile_id=${newProfile.id}; path=/; max-age=31536000; SameSite=Lax`;
    };

    const clearProfile = () => {
        // Set switching state FIRST to hide stale UI
        setIsSwitching(true);
        setProfile(null);
        localStorage.removeItem("sc_profile");

        // Clear cookie
        document.cookie = "sc_profile_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

        window.location.href = "/select-profile";
    };

    return (
        <ProfileContext.Provider value={{ profile, selectProfile, clearProfile, refreshProfile, loading, isSwitching }}>
            {children}
        </ProfileContext.Provider>
    );
}

export function useProfile() {
    const context = useContext(ProfileContext);
    if (context === undefined) {
        throw new Error("useProfile must be used within a ProfileProvider");
    }
    return context;
}
