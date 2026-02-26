"use client";

import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { PinVerificationModal } from "@/components/PinVerificationModal";
import { useProfile, Profile } from "@/context/ProfileContext";

export function ProfileSelector({ profiles }: { profiles: Profile[] }) {
    const { selectProfile } = useProfile();
    const [selectedProfileForPin, setSelectedProfileForPin] = useState<Profile | null>(null);
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);

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

    // No profiles linked - show a message
    if (profiles.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
                <h1 className="text-3xl md:text-5xl font-bold mb-6">No Profiles Found</h1>
                <p className="text-gray-400 text-lg mb-8 text-center max-w-md">
                    Your account doesn&apos;t have any profiles yet. Please contact an administrator to get your account approved.
                </p>
                <form action="/login">
                    <button
                        type="submit"
                        className="px-6 py-3 bg-nwu-red text-white rounded-lg font-medium hover:bg-[#5e0d0e] transition-colors"
                    >
                        Back to Login
                    </button>
                </form>
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
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded relative overflow-hidden mb-4 border-2 border-transparent group-hover:border-2 group-hover:border-white transition-all shadow-xl bg-gray-800 flex items-center justify-center">
                            {profile.role === "admin" ? (
                                <ShieldCheck className="h-16 w-16 text-nwu-gold" />
                            ) : (
                                <div className="text-4xl font-bold text-gray-400">
                                    {profile.name[0]}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            {profile.has_pin && (
                                <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full backdrop-blur-sm">
                                    <Lock className="h-3 w-3 text-white/80" />
                                </div>
                            )}
                        </div>
                        <span className="text-lg md:text-xl text-gray-400 group-hover:text-white font-medium text-center transition-colors">
                            {profile.name}
                        </span>
                        {profile.role === 'admin' && (
                            <span className={`text-xs uppercase tracking-widest mt-1 ${profile.is_super_admin ? 'text-red-400' : 'text-nwu-gold'}`}>
                                {profile.is_super_admin ? 'Administrator' : 'Department Admin'}
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
