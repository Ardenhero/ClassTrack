"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { PinVerificationModal } from "@/components/PinVerificationModal";
import { useProfile, Profile } from "@/context/ProfileContext";

export default function SelectProfilePage() {
    const supabase = createClient();
    const { selectProfile } = useProfile();

    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProfileForPin, setSelectedProfileForPin] = useState<Profile | null>(null);
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);

    useEffect(() => {
        const fetchProfiles = async () => {
            // Get the current authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error("No authenticated user");
                setLoading(false);
                return;
            }

            // Fetch ONLY this user's linked profiles
            const { data: instructors, error } = await supabase
                .from("instructors")
                .select("id, name, department_id, pin_enabled, role, is_super_admin")
                .eq("owner_id", user.id)
                .order("name");

            if (error) {
                console.error("Error fetching profiles:", error);
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allProfiles: Profile[] = (instructors || []).map((inst: any) => {
                return {
                    id: inst.id,
                    name: inst.name,
                    role: inst.role === 'admin' ? 'admin' : 'instructor',
                    department_id: inst.department_id,
                    has_pin: inst.pin_enabled,
                    is_super_admin: inst.is_super_admin
                };
            });

            // Sort: admin first, then alphabetical
            const adminProfile = allProfiles.find(p => p.role === 'admin');
            const otherProfiles = allProfiles.filter(p => p.role !== 'admin').sort((a, b) => a.name.localeCompare(b.name));

            if (adminProfile) {
                setProfiles([adminProfile, ...otherProfiles]);
            } else if (otherProfiles.length > 0) {
                setProfiles(otherProfiles);
            } else {
                // No profiles linked to this user yet
                setProfiles([]);
            }

            setLoading(false);
        };

        fetchProfiles();
    }, [supabase]);

    const handleProfileClick = (profile: Profile) => {
        if (profile.has_pin) {
            setSelectedProfileForPin(profile);
            setIsPinModalOpen(true);
        } else {
            completeLogin(profile);
        }
    };

    const completeLogin = (profile: Profile) => {
        selectProfile(profile);
        window.location.replace("/");
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nwu-red"></div>
            </div>
        );
    }

    // No profiles linked - show a message
    if (profiles.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
                <div className="max-w-md w-full text-center space-y-8 glass-panel p-8 rounded-[2rem]">
                    <h1 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">No Profiles Found</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-lg mb-8 text-center max-w-md">
                        Your account doesn&apos;t have any profiles yet. Please contact an administrator to get your account approved.
                    </p>
                    <form action="/login">
                        <button
                            type="submit"
                            className="px-6 py-3 bg-nwu-red text-white rounded-lg font-medium hover:bg-red-800 transition-colors shadow-lg"
                        >
                            Back to Login
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
            <h1 className="text-3xl md:text-5xl font-bold mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 text-gray-900 dark:text-white">Who&apos;s checking in?</h1>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 max-w-5xl">
                {profiles.map((profile) => (
                    <div
                        key={profile.id}
                        onClick={() => handleProfileClick(profile)}
                        className="group flex flex-col items-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
                    >
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl relative overflow-hidden mb-4 border-2 border-transparent group-hover:border-nwu-red/50 transition-all shadow-xl glass-panel flex items-center justify-center">
                            {profile.role === "admin" ? (
                                <ShieldCheck className="h-16 w-16 text-nwu-gold" />
                            ) : (
                                <div className="text-4xl font-bold text-gray-500 dark:text-gray-400">
                                    {profile.name[0]}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            {profile.has_pin && (
                                <div className="absolute top-2 right-2 bg-gray-900/50 p-1.5 rounded-full backdrop-blur-sm">
                                    <Lock className="h-3 w-3 text-white/80" />
                                </div>
                            )}
                        </div>
                        <span className="text-lg md:text-xl text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white font-medium text-center transition-colors">
                            {profile.name}
                        </span>
                        {profile.role === 'admin' && (
                            <span className={`text-xs uppercase tracking-widest mt-1 ${profile.is_super_admin ? 'text-red-400' : 'text-nwu-gold'}`}>
                                {profile.is_super_admin ? 'Super Admin' : 'Admin'}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            <PinVerificationModal
                isOpen={isPinModalOpen}
                onClose={() => setIsPinModalOpen(false)}
                onSuccess={() => {
                    if (selectedProfileForPin) {
                        completeLogin(selectedProfileForPin);
                        setIsPinModalOpen(false);
                    }
                }}
                instructorId={selectedProfileForPin?.id || ""}
                title={`Enter PIN for ${selectedProfileForPin?.name}`}
                description="This profile is protected."
            />
        </div>
    );
}
