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
            // 1. Fetch Profiles from instructors table
            const { data: instructors, error } = await supabase
                .from("instructors")
                .select("id, name, department_id, pin_enabled, role")
                .order("name");

            if (error) {
                console.error("Error fetching profiles:", error);
            }

            // 2. Map profiles and ensure Admin is correctly handled
            // 2. Map profiles
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allProfiles: Profile[] = (instructors || []).map((inst: any) => {
                return {
                    id: inst.id,
                    name: inst.name,
                    role: inst.role === 'admin' ? 'admin' : 'instructor',
                    department_id: inst.department_id,
                    has_pin: inst.pin_enabled
                };
            });

            // 3. Ensure Admin priority in list
            const adminProfile = allProfiles.find(p => p.role === 'admin');
            const otherProfiles = allProfiles.filter(p => p.role !== 'admin').sort((a, b) => a.name.localeCompare(b.name));

            if (adminProfile) {
                // If real admin exists, show them first
                setProfiles([adminProfile, ...otherProfiles]);
            } else {
                // Only inject Virtual Admin if NO real admin exists in DB
                const virtualAdmin: Profile = {
                    id: 'admin-profile',
                    name: "System Admin",
                    role: "admin",
                    has_pin: false
                };
                setProfiles([virtualAdmin, ...otherProfiles]);
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
            // No PIN needed, direct login
            completeLogin(profile);
        }
    };

    const completeLogin = (profile: Profile) => {
        selectProfile(profile);
        // Force full reload to ensure middleware and context sync perfectly
        window.location.replace("/");
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nwu-red"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
            <h1 className="text-3xl md:text-5xl font-bold mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">Who&apos;s checking in?</h1>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 max-w-5xl">
                {profiles.map((profile) => (
                    <div
                        key={profile.id}
                        onClick={() => handleProfileClick(profile)}
                        className="group flex flex-col items-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
                    >
                        {/* Avatar Image */}
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded relative overflow-hidden mb-4 border-2 border-transparent group-hover:border-2 group-hover:border-white transition-all shadow-xl bg-gray-800 flex items-center justify-center">
                            {profile.role === "admin" ? (
                                <ShieldCheck className="h-16 w-16 text-nwu-gold" />
                            ) : (
                                <div className="text-4xl font-bold text-gray-400">
                                    {profile.name[0]}
                                </div>
                            )}

                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                            {/* Lock Icon if PIN enabled */}
                            {profile.has_pin && (
                                <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full backdrop-blur-sm">
                                    <Lock className="h-3 w-3 text-white/80" />
                                </div>
                            )}
                        </div>

                        {/* Name */}
                        <span className="text-lg md:text-xl text-gray-400 group-hover:text-white font-medium text-center transition-colors">
                            {profile.name}
                        </span>

                        {/* Role Badge */}
                        {profile.role === 'admin' && (
                            <span className="text-xs uppercase tracking-widest text-nwu-gold mt-1">Admin</span>
                        )}
                    </div>
                ))}
            </div>

            {/* PIN Verification Modal */}
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
