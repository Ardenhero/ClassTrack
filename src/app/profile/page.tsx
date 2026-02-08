"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { User, Lock, Loader2, ShieldCheck } from "lucide-react";

export default function ProfilePage() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [fullName, setFullName] = useState("");
    const [pinCode, setPinCode] = useState<string | null>(null);
    const [pinEnabled, setPinEnabled] = useState(false);
    const [isKioskVisible, setIsKioskVisible] = useState(true);
    const [instructorId, setInstructorId] = useState<string | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const getUserAndInstructor = async () => {
            setLoadingProfile(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.user_metadata?.full_name) {
                setFullName(user.user_metadata.full_name);
            }

            if (user) {
                // Get the active profile ID from the cookie
                const match = document.cookie.match(new RegExp('(^| )sc_profile_id=([^;]+)'));
                const activeProfileId = match ? match[2] : null;

                let query = supabase.from("instructors").select("*");

                if (activeProfileId && activeProfileId !== 'admin-profile') {
                    // Strictly target the specific UUID session
                    query = query.eq("id", activeProfileId);
                } else {
                    // Fallback to the User's Admin record ONLY if no specific profile selected
                    query = query.eq("user_id", user.id).eq("role", "admin");
                }

                const { data: instructor, error: fetchError } = await query.maybeSingle();

                if (!instructor && (!activeProfileId || activeProfileId === 'admin-profile')) {
                    // Try one more time by role for safety
                    const { data: adminRecord } = await supabase
                        .from("instructors")
                        .select("*")
                        .eq("user_id", user.id)
                        .eq("role", "admin")
                        .maybeSingle();

                    if (adminRecord) {
                        setInstructorId(adminRecord.id);
                        setPinCode(adminRecord.pin_code);
                        setPinEnabled(adminRecord.pin_enabled);
                        setIsKioskVisible(adminRecord.is_visible_on_kiosk);
                    } else {
                        // Create the admin record if it truly doesn't exist
                        const { data: newAdmin, error: createError } = await supabase
                            .from("instructors")
                            .insert({
                                user_id: user.id,
                                name: "System Admin",
                                role: "admin",
                                is_visible_on_kiosk: false
                            })
                            .select()
                            .single();

                        if (newAdmin) {
                            setInstructorId(newAdmin.id);
                            setPinCode(newAdmin.pin_code);
                            setPinEnabled(newAdmin.pin_enabled);
                            setIsKioskVisible(newAdmin.is_visible_on_kiosk);
                        } else if (createError) {
                            console.error("Failed to create admin record:", createError);
                            setMessage(`Critical Error: ${createError.message}`);
                        }
                    }
                    setLoadingProfile(false);
                    return;
                }

                if (instructor) {
                    setInstructorId(instructor.id);
                    setPinCode(instructor.pin_code);
                    setPinEnabled(instructor.pin_enabled);
                    setIsKioskVisible(instructor.is_visible_on_kiosk);
                    // Update name display to match the profile being edited
                    setFullName(instructor.name || user.user_metadata.full_name);
                } else if (fetchError) {
                    setMessage(`Error loading profile: ${fetchError.message}`);
                }
            }
            setLoadingProfile(false);
        };
        getUserAndInstructor();
    }, [supabase]);

    const handleUpdatePin = async (newPin: string | null) => {
        if (!instructorId) {
            setMessage("Error: Profile not resolved. Please try again.");
            return;
        }
        setLoading(true);
        const { error } = await supabase
            .from("instructors")
            .update({
                pin_code: newPin,
                pin_enabled: !!newPin
            })
            .eq("id", instructorId);

        if (!error) {
            setPinCode(newPin);
            setPinEnabled(!!newPin);
            setMessage(newPin ? "PIN created successfully!" : "PIN removed successfully!");
        } else {
            setMessage(`Error: ${error.message}`);
        }
        setLoading(false);
    };

    const handleToggleKiosk = async () => {
        if (!instructorId) {
            setMessage("Error: Profile not resolved. Please try again.");
            return;
        }
        setLoading(true);
        const { error } = await supabase
            .from("instructors")
            .update({ is_visible_on_kiosk: !isKioskVisible })
            .eq("id", instructorId);

        if (!error) {
            setIsKioskVisible(!isKioskVisible);
            setMessage(`Instructor is now ${!isKioskVisible ? 'visible' : 'hidden'} on kiosk.`);
        }
        setLoading(false);
    };

    const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        const formData = new FormData(e.currentTarget);
        const newName = formData.get("fullName") as string;
        const password = formData.get("password") as string;

        const updates: { data?: { full_name: string }, password?: string } = {};
        if (newName) updates.data = { full_name: newName };
        if (password) updates.password = password;

        const { error } = await supabase.auth.updateUser(updates);

        if (error) {
            setMessage(`Error: ${error.message}`);
        } else {
            setMessage("Profile updated successfully!");
            if (newName) setFullName(newName);
            (e.target as HTMLFormElement).reset();
            // Keep the name in the input but clear password
            window.location.reload();
        }
        setLoading(false);
    };

    return (
        <DashboardLayout>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">Account Settings</h1>

            <div className="max-w-xl">
                {/* Profile Indicator */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold">
                        {instructorId ? "✓" : "?"}
                    </div>
                    <div>
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Currently Editing Profile</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {instructorId ? (fullName || "Loading...") : "Resolving Profile..."}
                        </p>
                        <p className="text-xs text-gray-500 font-mono mt-1">{instructorId || "No ID"}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
                    <form onSubmit={handleUpdateProfile} className="space-y-6">

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Display Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    name="fullName"
                                    type="text"
                                    defaultValue={fullName}
                                    key={fullName} // Force re-render when name loads
                                    className="pl-10 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red"
                                    placeholder="Update your name"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    name="password"
                                    type="password"
                                    className="pl-10 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red"
                                    placeholder="Set a new password"
                                    minLength={6}
                                />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave blank to keep current password.</p>
                        </div>

                        {message && (
                            <div className={`p-3 rounded text-sm ${message.includes("Error") ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                                {message}
                            </div>
                        )}

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-nwu-red hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Security Section */}
                <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
                    <div className="flex items-center mb-6">
                        <ShieldCheck className="h-6 w-6 text-nwu-red mr-3" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Kiosk Security</h2>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Security PIN</h4>
                                <p className="text-xs text-gray-500 mt-1">
                                    {pinCode ? `Currently active: ****` : "No PIN set. Account is unprotected."}
                                </p>
                            </div>
                            <div className="flex space-x-2">
                                {pinCode ? (
                                    <button
                                        onClick={() => handleUpdatePin(null)}
                                        className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold hover:bg-gray-300 transition-colors"
                                    >
                                        REMOVE PIN
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            const p = prompt("Enter a 4-digit PIN:");
                                            if (p && /^\d{4}$/.test(p)) {
                                                handleUpdatePin(p);
                                            } else if (p) {
                                                alert("PIN must be exactly 4 digits.");
                                            }
                                        }}
                                        disabled={loading || loadingProfile}
                                        className="px-3 py-1.5 bg-nwu-red text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                                    >
                                        CREATE PIN
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Explicit PIN Toggle */}
                        {instructorId && pinCode && (
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Require PIN on Entry</h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Toggle whether your PIN is required to access the dashboard.
                                    </p>
                                </div>
                                <button
                                    onClick={async () => {
                                        setLoading(true);
                                        const newValue = !pinEnabled;
                                        const { error } = await supabase
                                            .from("instructors")
                                            .update({ pin_enabled: newValue })
                                            .eq("id", instructorId);

                                        if (!error) {
                                            setPinEnabled(newValue);
                                            setMessage(`PIN requirement turned ${newValue ? 'ON' : 'OFF'}`);
                                        } else {
                                            setMessage(`Error: ${error.message}`);
                                        }
                                        setLoading(false);
                                    }}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${pinEnabled ? 'bg-green-500' : 'bg-gray-200'}`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${pinEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>
                        )}

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Kiosk Visibility</h4>
                                <p className="text-xs text-gray-500 mt-1">Show your name on the ESP32 entrance screen</p>
                            </div>
                            <button
                                onClick={handleToggleKiosk}
                                disabled={loading || loadingProfile}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${isKioskVisible ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-200 text-gray-500'}`}
                            >
                                {isKioskVisible ? "VISIBLE" : "HIDDEN"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
