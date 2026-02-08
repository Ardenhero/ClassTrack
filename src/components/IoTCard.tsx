"use client";

import { Power, Zap } from "lucide-react";
import { cn } from "@/utils/cn";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface IoTCardProps {
    id?: string; // Add ID for DB update
    title: string;
    // deviceType: "light" | "ac" | "fan"; // Remove strict type if we want flexible icons
    icon?: React.ElementType;
    wattage: number;
    initialStatus: boolean;
    color?: string; // Allow color prop
}

export function IoTCard({ id, title, icon: Icon, wattage, initialStatus, color }: IoTCardProps) {
    const [isOn, setIsOn] = useState(initialStatus);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    const toggleDevice = async () => {
        setLoading(true);
        const newStatus = !isOn;

        try {
            // Optimistic update
            setIsOn(newStatus);

            // DB Update
            const { error } = await supabase
                .from('iot_logs') // For now updating iot_logs directly as 'state' but usually this would be a 'devices' table.
                // Wait, the schema has `iot_logs` which seems like a log. 
                // Usually we'd have a `devices` table and `iot_logs` for history.
                // Assuming `iot_logs` tracks current state of "devices" for this MVP based on user prompt 'IoT Logs Table: id... device_name, status'.
                // I'll assume entries in iot_logs represent the devices for now, or I create a new log entry?
                // "IoT Command Center: Remote control toggles... with live power consumption graphs."
                // "IoT Logs Table: id... device_name... status... wattage". 
                // This schema suggests it's a log. But to toggle "A device", we need a stable device record.
                // I will assume for MVP we are updating the LATEST log entry for that device or just inserting a new log?
                // Or maybe `iot_logs` acts as the device state. I'll Update the record by ID.
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

        } catch (e) {
            console.error("Toggle failed", e);
            setIsOn(!newStatus); // Revert
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
                <div className={`p-3 rounded-lg ${color === 'blue' ? 'bg-blue-50' : 'bg-purple-50'}`}>
                    {Icon ? <Icon className={`h-6 w-6 ${color === 'blue' ? 'text-blue-600' : 'text-udemy-purple'}`} /> : <Zap className="h-6 w-6 text-udemy-purple" />}
                </div>
                <button
                    onClick={toggleDevice}
                    disabled={loading}
                    className={cn(
                        "p-2 rounded-full transition-colors duration-200",
                        isOn
                            ? "bg-green-100 text-green-600 hover:bg-green-200"
                            : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    )}
                >
                    <Power className="h-5 w-5" />
                </button>
            </div>

            <div className="mt-4">
                <h4 className="font-semibold text-gray-900">{title}</h4>
                <div className="flex justify-between items-end mt-2">
                    <p className="text-2xl font-bold font-mono text-udemy-indigo">
                        {isOn ? wattage : 0} <span className="text-sm font-sans text-gray-400">W</span>
                    </p>
                    <span className={cn(
                        "text-xs font-medium px-2 py-1 rounded-full",
                        isOn ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    )}>
                        {isOn ? "Active" : "Offline"}
                    </span>
                </div>
            </div>
        </div>
    );
}
