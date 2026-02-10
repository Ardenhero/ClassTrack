"use client";

import { useState, useCallback } from "react";
import { Plus, X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Trash2, Download } from "lucide-react";
import { addClass, bulkImportClasses } from "./actions";
import { useRouter } from "next/navigation";
import { useProfile } from "@/context/ProfileContext";
import { cn } from "@/utils/cn";
import * as XLSX from "xlsx";

interface AddClassDialogProps {
    trigger?: React.ReactNode;
}

interface ParsedClassRow {
    name: string;
    start_time: string;
    end_time: string;
    year_level: string;
    description: string;
}

interface ImportResult {
    success: number;
    failed: { row: number; reason: string }[];
}

export function AddClassDialog({ trigger }: AddClassDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [nameLength, setNameLength] = useState(0);
    const [descLength, setDescLength] = useState(0);
    const [activeTab, setActiveTab] = useState<"manual" | "import">("manual");
    const [parsedRows, setParsedRows] = useState<ParsedClassRow[]>([]);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const router = useRouter();
    const { profile } = useProfile();

    const isSuperAdmin = profile?.is_super_admin;

    const resetImportState = () => {
        setParsedRows([]);
        setImportResult(null);
        setFileError(null);
    };

    const handleClose = () => {
        setIsOpen(false);
        setActiveTab("manual");
        resetImportState();
        setNameLength(0);
        setDescLength(0);
    };

    // ─── Manual Submit (unchanged logic) ────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const result = await addClass(formData);

        if (result?.error) {
            alert(result.error);
        } else {
            handleClose();
            router.refresh();
        }
        setLoading(false);
    };

    // ─── File Parsing ───────────────────────────────────────────────────────
    const handleFileDrop = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFileError(null);
        setImportResult(null);
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

                if (json.length === 0) {
                    setFileError("The file appears to be empty.");
                    return;
                }

                // Map headers flexibly
                const rows: ParsedClassRow[] = json.map((row) => {
                    const keys = Object.keys(row);
                    const find = (patterns: string[]) =>
                        keys.find((k) => patterns.some((p) => k.toLowerCase().replace(/[_\s]/g, '').includes(p))) || "";

                    return {
                        name: row[find(["classname", "name", "class"])] || row[keys[0]] || "",
                        start_time: row[find(["starttime", "start", "timein"])] || row[keys[1]] || "",
                        end_time: row[find(["endtime", "end", "timeout"])] || row[keys[2]] || "",
                        year_level: row[find(["yearlevel", "year", "level"])] || row[keys[3]] || "",
                        description: row[find(["description", "desc", "schedule", "sched"])] || row[keys[4]] || "",
                    };
                });

                setParsedRows(rows);
            } catch {
                setFileError("Failed to parse file. Please ensure it's a valid .csv or .xlsx file.");
            }
        };
        reader.readAsArrayBuffer(file);
    }, []);

    // ─── Bulk Import Submit ─────────────────────────────────────────────────
    const handleBulkImport = async () => {
        if (parsedRows.length === 0) return;
        setLoading(true);
        setImportResult(null);

        try {
            const result = await bulkImportClasses(parsedRows);
            setImportResult(result);
            if (result.success > 0) {
                router.refresh();
            }
        } catch {
            setImportResult({ success: 0, failed: [{ row: 0, reason: "An unexpected error occurred." }] });
        }

        setLoading(false);
    };

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ["Class Name", "Start Time", "End Time", "Year Level", "Description"],
            ["Science 101", "08:00", "09:30", "1st Year", "MWF Room 3B"],
            ["Math 201", "10:00", "11:30", "2nd Year", "TTH Room 4A"],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Classes");
        XLSX.writeFile(wb, "class_import_template.xlsx");
    };

    if (!isOpen) {
        return (
            <div onClick={() => setIsOpen(true)}>
                {trigger || (
                    <button
                        className="flex items-center px-4 py-2 bg-nwu-red text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Class
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    <X className="h-5 w-5" />
                </button>

                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create New Class</h2>

                {/* ─── Tab Switcher (hidden for Super Admin) ──────────────── */}
                {!isSuperAdmin && (
                    <div className="flex mb-5 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <button
                            type="button"
                            onClick={() => { setActiveTab("manual"); resetImportState(); }}
                            className={cn(
                                "flex-1 py-2 text-sm font-semibold rounded-md transition-all",
                                activeTab === "manual"
                                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            )}
                        >
                            Manual
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("import")}
                            className={cn(
                                "flex-1 py-2 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-1.5",
                                activeTab === "import"
                                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            )}
                        >
                            <Upload className="h-3.5 w-3.5" />
                            Import File
                        </button>
                    </div>
                )}

                {/* ─── MANUAL TAB (original form, untouched) ──────────────── */}
                {activeTab === "manual" && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class Name</label>
                            <input
                                name="name"
                                required
                                maxLength={200}
                                onChange={(e) => setNameLength(e.target.value.length)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:text-white"
                                placeholder="e.g. Science 101"
                            />
                            <p className="text-xs text-gray-500 mt-1">{nameLength}/200 characters</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Start Time
                                </label>
                                <input
                                    name="start_time"
                                    type="time"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    End Time
                                </label>
                                <input
                                    name="end_time"
                                    type="time"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Year Level
                            </label>
                            <select
                                name="year_level"
                                required
                                defaultValue="1st Year"
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                <option value="1st Year">1st Year</option>
                                <option value="2nd Year">2nd Year</option>
                                <option value="3rd Year">3rd Year</option>
                                <option value="4th Year">4th Year</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description/Schedule</label>
                            <textarea
                                name="description"
                                maxLength={500}
                                onChange={(e) => setDescLength(e.target.value.length)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:text-white"
                                placeholder="e.g. Mon/Wed 10am - Room 3B"
                                rows={3}
                            />
                            <p className="text-xs text-gray-500 mt-1">{descLength}/500 characters</p>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 bg-nwu-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {loading ? "Creating..." : "Create Class"}
                            </button>
                        </div>
                    </form>
                )}

                {/* ─── IMPORT TAB ─────────────────────────────────────────── */}
                {activeTab === "import" && (
                    <div className="space-y-4">
                        {/* Template Download */}
                        <button
                            type="button"
                            onClick={downloadTemplate}
                            className="flex items-center text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            <Download className="h-3 w-3 mr-1" />
                            Download template (.xlsx)
                        </button>

                        {/* File Drop Zone */}
                        {parsedRows.length === 0 && !importResult && (
                            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-nwu-red hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors group">
                                <FileSpreadsheet className="h-10 w-10 text-gray-300 dark:text-gray-500 group-hover:text-nwu-red transition-colors mb-2" />
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                    Click to upload <span className="text-nwu-red">.csv</span> or <span className="text-nwu-red">.xlsx</span>
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    Columns: Class Name, Start Time, End Time, Year Level, Description
                                </p>
                                <input
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    className="hidden"
                                    onChange={handleFileDrop}
                                />
                            </label>
                        )}

                        {fileError && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center">
                                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                                {fileError}
                            </div>
                        )}

                        {/* Preview Table */}
                        {parsedRows.length > 0 && !importResult && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Preview ({parsedRows.length} class{parsedRows.length !== 1 ? "es" : ""})
                                    </p>
                                    <button
                                        type="button"
                                        onClick={resetImportState}
                                        className="text-xs text-red-500 hover:text-red-700 flex items-center"
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Clear
                                    </button>
                                </div>
                                <div className="border dark:border-gray-600 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                            <tr>
                                                <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">#</th>
                                                <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">Name</th>
                                                <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">Start</th>
                                                <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">End</th>
                                                <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">Year</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {parsedRows.map((row, i) => (
                                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                    <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                                                    <td className="px-2 py-1.5 text-gray-900 dark:text-white font-medium truncate max-w-[120px]">{row.name}</td>
                                                    <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400 font-mono">{row.start_time}</td>
                                                    <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400 font-mono">{row.end_time}</td>
                                                    <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400">{row.year_level}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Import Result */}
                        {importResult && (
                            <div className="space-y-3">
                                {importResult.success > 0 && (
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm flex items-center">
                                        <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                                        Successfully imported {importResult.success} class{importResult.success !== 1 ? "es" : ""}.
                                    </div>
                                )}
                                {importResult.failed.length > 0 && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                        <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center">
                                            <AlertCircle className="h-4 w-4 mr-1.5" />
                                            {importResult.failed.length} row(s) failed:
                                        </p>
                                        <ul className="text-xs text-red-500 dark:text-red-400 space-y-1 max-h-24 overflow-y-auto">
                                            {importResult.failed.map((f, i) => (
                                                <li key={i}>Row {f.row}: {f.reason}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => { resetImportState(); }}
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    Import another file
                                </button>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex justify-end space-x-3 mt-4">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                Cancel
                            </button>
                            {parsedRows.length > 0 && !importResult && (
                                <button
                                    type="button"
                                    onClick={handleBulkImport}
                                    disabled={loading}
                                    className="px-4 py-2 bg-nwu-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    {loading ? "Importing..." : `Import ${parsedRows.length} Class${parsedRows.length !== 1 ? "es" : ""}`}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
