"use client";

import { useState, useEffect } from "react";
import { Lightbulb, Fan, Snowflake } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export function IoTSwitches() {
    const supabase = createClient();
    const [devices, setDevices] = useState({
        lights: false,
        fans: false,
        ac: false // Changed default to false to avoid flash if offline
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data } = await supabase
                    .from('room_settings')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (data) {
                    setDevices({
                        lights: data.lights,
                        fans: data.fans,
                        ac: data.ac
                    });
                } else {
                    // Create default settings if none exist
                    const { error: insertError } = await supabase
                        .from('room_settings')
                        .insert({
                            user_id: user.id,
                            lights: false,
                            fans: false,
                            ac: false
                        });

                    if (!insertError) {
                        setDevices({
                            lights: false,
                            fans: false,
                            ac: false
                        });
                    }
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleDevice = async (device: keyof typeof devices) => {
        const newState = !devices[device];

        // Optimistic update
        setDevices(prev => ({
            ...prev,
            [device]: newState
        }));

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('room_settings')
                .upsert({
                    user_id: user.id,
                    ...devices,
                    [device]: newState,
                    updated_at: new Date().toISOString()
                });

            if (error) {
                console.error('Error saving setting:', error);
                // Revert on error
                setDevices(prev => ({
                    ...prev,
                    [device]: !newState
                }));
            }
        } catch (error) {
            console.error('Error in toggleDevice:', error);
            // Revert on error
            setDevices(prev => ({
                ...prev,
                [device]: !newState
            }));
        }
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
                <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                    <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                    <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Room Controls</h3>
                <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Connected</span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Lights */}
                <button
                    onClick={() => toggleDevice('lights')}
                    className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center space-y-3 ${devices.lights
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/50'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600'
                        }`}
                >
                    <div className={`p-3 rounded-full ${devices.lights ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-200 dark:shadow-none' : 'bg-gray-200 dark:bg-gray-600 text-gray-400'}`}>
                        <Lightbulb className="h-6 w-6" />
                    </div>
                    <div className="text-center">
                        <span className="block font-medium text-gray-900 dark:text-gray-100">Lights</span>
                        <span className={`text-xs ${devices.lights ? 'text-yellow-600 dark:text-yellow-400 font-bold' : 'text-gray-400'}`}>
                            {devices.lights ? 'ON' : 'OFF'}
                        </span>
                    </div>
                </button>

                {/* Fans */}
                <button
                    onClick={() => toggleDevice('fans')}
                    className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center space-y-3 ${devices.fans
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600'
                        }`}
                >
                    <div className={`p-3 rounded-full ${devices.fans ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 dark:shadow-none' : 'bg-gray-200 dark:bg-gray-600 text-gray-400'}`}>
                        <Fan className={`h-6 w-6 ${devices.fans ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                    </div>
                    <div className="text-center">
                        <span className="block font-medium text-gray-900 dark:text-gray-100">Fans</span>
                        <span className={`text-xs ${devices.fans ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-400'}`}>
                            {devices.fans ? 'ON' : 'OFF'}
                        </span>
                    </div>
                </button>

                {/* AC */}
                <button
                    onClick={() => toggleDevice('ac')}
                    className={`relative p-4 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center space-y-3 overflow-hidden ${devices.ac
                        ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-700/50'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600'
                        }`}
                >
                    {/* Snow Effect Overlay */}
                    {devices.ac && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            <Snowflake className="absolute -top-3 left-1/4 h-3 w-3 text-cyan-200 animate-snowfall" style={{ animationDuration: '2.5s', animationDelay: '0s' }} />
                            <Snowflake className="absolute -top-3 right-1/4 h-2 w-2 text-cyan-300 animate-snowfall" style={{ animationDuration: '3s', animationDelay: '1s' }} />
                            <Snowflake className="absolute -top-3 left-1/2 h-2.5 w-2.5 text-cyan-100 animate-snowfall" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                        </div>
                    )}

                    <div className={`p-3 rounded-full relative z-10 ${devices.ac ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-200 dark:shadow-none' : 'bg-gray-200 dark:bg-gray-600 text-gray-400'}`}>
                        <Snowflake className={`h-6 w-6 ${devices.ac ? 'animate-pulse' : ''}`} />
                    </div>
                    <div className="text-center relative z-10">
                        <span className="block font-medium text-gray-900 dark:text-gray-100">A/C</span>
                        <div className="flex items-center justify-center space-x-1">
                            <span className={`text-xs ${devices.ac ? 'text-cyan-600 dark:text-cyan-400 font-bold' : 'text-gray-400'}`}>
                                {devices.ac ? 'ON' : 'OFF'}
                            </span>
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
}
