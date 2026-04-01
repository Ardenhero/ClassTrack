"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function ExportCsvButton({ profileId, isSuperAdmin, isAdmin }: { profileId: string; isSuperAdmin: boolean; isAdmin: boolean }) {
    const [exportLoading, setExportLoading] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportDays, setExportDays] = useState(30);

    const handleExportCsv = async () => {
        if (!profileId) return;
        setExportLoading(true);
        try {
            const scope = isSuperAdmin ? "super_admin" : isAdmin ? "admin" : "instructor";

            const params = new URLSearchParams({
                profile_id: profileId,
                scope,
                days: exportDays.toString()
            });

            const response = await fetch(`/api/reports/export-csv?${params}`);
            if (!response.ok) throw new Error("Export failed");

            // Trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.setAttribute('href', url);
            a.setAttribute('download', `ClassTrack_Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setShowExportModal(false);
        } catch (error) {
            console.error("CSV Export error:", error);
            alert("Failed to export attendance report. Please try again or check server logs.");
        } finally {
            setExportLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center px-4 py-2 bg-nwu-red text-white rounded-xl hover:bg-red-700 transition-colors shadow-sm text-sm font-medium"
            >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
            </button>

            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-700 transform transition-all">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center">
                                    <Download className="h-5 w-5" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Export Department Data</h2>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                                You are about to export a CSV containing all attendance logs for classes under your jurisdiction. Please select the time range to include:
                            </p>

                            <div className="space-y-3 mb-8">
                                {[7, 14, 30, 90, 365].map(days => (
                                    <label key={days} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${exportDays === days ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'}`}>
                                        <input
                                            type="radio"
                                            name="exportDays"
                                            value={days}
                                            checked={exportDays === days}
                                            onChange={() => setExportDays(days)}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                        />
                                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                                            Last {days} Days {days === 365 && '(Full Year)'}
                                        </span>
                                    </label>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowExportModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleExportCsv}
                                    disabled={exportLoading}
                                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                                >
                                    {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    {exportLoading ? 'Generating...' : 'Confirm Export'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
