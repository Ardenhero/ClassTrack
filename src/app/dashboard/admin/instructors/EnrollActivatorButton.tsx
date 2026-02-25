"use client";

import { useState } from "react";
import { Fingerprint, X, Loader2 } from "lucide-react";

interface Props {
    instructorId: string;
    instructorName: string;
}

export function EnrollActivatorButton({ instructorId, instructorName }: Props) {
    const [showModal, setShowModal] = useState(false);
    const [deviceSerial, setDeviceSerial] = useState("ESP32-LCD7-MAIN");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleEnroll = async () => {
        setLoading(true);
        setResult(null);

        try {
            const res = await fetch("/api/kiosk/enroll-activator", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instructor_id: instructorId,
                    device_serial: deviceSerial,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setResult({ success: true, message: data.message });
            } else {
                setResult({ success: false, message: data.error || "Failed to send enrollment command" });
            }
        } catch {
            setResult({ success: false, message: "Network error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => { setShowModal(true); setResult(null); }}
                className="text-[10px] px-2 py-1 rounded border bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 transition-all flex items-center gap-1"
                title={`Enroll fingerprint for ${instructorName}`}
            >
                <Fingerprint className="h-3 w-3" /> Enroll
            </button>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Enroll Fingerprint</h3>
                                <p className="text-xs text-gray-500 mt-0.5">For {instructorName}</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Target Kiosk</label>
                            <input
                                type="text"
                                value={deviceSerial}
                                onChange={(e) => setDeviceSerial(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-900"
                                placeholder="e.g. ESP32-LCD7-MAIN"
                            />
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4 text-xs text-amber-700 dark:text-amber-400">
                            <strong>How it works:</strong> The kiosk will prompt {instructorName} to place their finger on the next sync cycle (~30s). The fingerprint will be linked to their instructor account for room activation.
                        </div>

                        {result && (
                            <div className={`mb-4 p-3 rounded-xl text-xs font-medium ${result.success
                                ? "bg-green-50 border border-green-200 text-green-700"
                                : "bg-red-50 border border-red-200 text-red-700"
                                }`}>
                                {result.message}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEnroll}
                                disabled={loading || !deviceSerial.trim()}
                                className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                                ) : (
                                    <><Fingerprint className="h-4 w-4" /> Start Enrollment</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
