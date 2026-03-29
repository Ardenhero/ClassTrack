"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, X, Check, Lock, AlertCircle, Upload, FileSpreadsheet, CheckCircle, Trash2, Download, Link2 } from "lucide-react";
import { addStudent, getAssignableClasses, checkStudentBySIN, bulkImportStudents } from "./actions";
import { getInstructorList } from "../instructors/actions";
import { useRouter } from "next/navigation";
import { useProfile } from "../../context/ProfileContext";
import { cn } from "../../utils/cn";
import * as XLSX from "xlsx";
import { getActiveDepartments, type Department } from "../../lib/departments";

interface ClassItem {
    id: string;
    name: string;
    description?: string;
}

interface ParsedStudentRow {
    name: string;
    sin: string;
    year_level: string;
    department?: string;
}

interface BulkResult {
    success: number;
    linked: number;
    failed: { row: number; reason: string }[];
}

interface AddStudentDialogProps {
    trigger?: React.ReactNode;
}

export function AddStudentDialog({ trigger }: AddStudentDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [checkingSin, setCheckingSin] = useState(false);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [nameLength, setNameLength] = useState(0);
    const [existingStudent, setExistingStudent] = useState<{ name: string; year_level: string; department?: string } | null>(null);
    const [activeTab, setActiveTab] = useState<"manual" | "import">("manual");
    const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
    const [importResult, setImportResult] = useState<BulkResult | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [importClasses, setImportClasses] = useState<string[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [allDepartments, setAllDepartments] = useState<Department[]>([]);
    const [showAllDepartments, setShowAllDepartments] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const router = useRouter();
    const { profile } = useProfile();

    const isSuperAdmin = profile?.is_super_admin;
    const isSystemAdmin = profile?.role === 'admin' || isSuperAdmin;
    const profileId = profile?.id;

    const [instructors, setInstructors] = useState<{ id: string; name: string }[]>([]);
    const [selectedInstructor, setSelectedInstructor] = useState<string>("");

    useEffect(() => {
        if (isOpen) {
            getAssignableClasses().then(setClasses);

            // Instant department toggle fetch
            getActiveDepartments(profileId).then(setDepartments);
            if (!isSuperAdmin) {
                getActiveDepartments().then(setAllDepartments);
            }

            if (isSystemAdmin) {
                getInstructorList().then(setInstructors);
            }
        } else {
            // Reset state when closed
            setSelectedClasses([]);
            setExistingStudent(null);
            setNameLength(0);
            setActiveTab("manual");
            setShowAllDepartments(false);
            resetImportState();
        }
    }, [isOpen, isSystemAdmin, isSuperAdmin, profileId]);

    const resetImportState = () => {
        setParsedRows([]);
        setImportResult(null);
        setFileError(null);
        setImportClasses([]);
    };

    const handleClose = () => {
        setIsOpen(false);
        setActiveTab("manual");
        resetImportState();
        setExistingStudent(null);
        setSelectedClasses([]);
        setSelectedInstructor("");
    };

    // ─── Manual SIN Check (unchanged) ───────────────────────────────────────
    const handleSinBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
        const sin = e.target.value.trim();
        if (!sin || sin.length < 5) return;

        setCheckingSin(true);
        const result = await checkStudentBySIN(sin);
        setCheckingSin(false);

        if (result?.data) {
            const student = result.data as { id: string; name: string; year_level: string; department?: string };
            setExistingStudent(student);
        } else {
            setExistingStudent(null);
        }
    };

    // ─── Manual Submit (unchanged) ──────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // If classes are selected, ensure they are sent in the form data
        // (If none, we just let it proceed without them)

        // Instructor selection is now optional for Admins — students go to enrollment list

        setLoading(true);
        const formData = new FormData(e.currentTarget);
        formData.append("class_ids", JSON.stringify(selectedClasses));

        if (isSystemAdmin && selectedInstructor) {
            formData.append("instructor_id_override", selectedInstructor);
        }

        const result = await addStudent(formData);

        if (result?.error) {
            alert(result.error);
        } else {
            if (result?.message) {
                alert(result.message);
            }
            setIsOpen(false);
            (e.target as HTMLFormElement).reset();
            setSelectedClasses([]);
            setExistingStudent(null);
            router.refresh();
        }
        setLoading(false);
    };

    const toggleClass = (id: string) => {
        setSelectedClasses(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const toggleImportClass = (id: string) => {
        setImportClasses(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
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

                const rows: ParsedStudentRow[] = json.map((row) => {
                    const keys = Object.keys(row);
                    const find = (patterns: string[]) =>
                        keys.find((k) => patterns.some((p) => k.toLowerCase().replace(/[_\s]/g, '').includes(p))) || "";

                    return {
                        name: row[find(["fullname", "name", "studentname"])] || row[keys[0]] || "",
                        sin: String(row[find(["sin", "studentid", "id"])] || row[keys[1]] || "").trim(),
                        year_level: row[find(["yearlevel", "year", "level"])] || row[keys[2]] || "",
                        department: row[find(["department", "dept"])] || undefined,
                    };
                });

                setParsedRows(rows);
            } catch {
                setFileError("Failed to parse file. Please ensure it's a valid .csv or .xlsx file.");
            }
        };
        reader.readAsArrayBuffer(file);
    }, []);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const fakeEvent = {
                target: { files: e.dataTransfer.files }
            } as unknown as React.ChangeEvent<HTMLInputElement>;
            handleFileDrop(fakeEvent);
        }
    }, [handleFileDrop]);
    // ─── Bulk Import Submit ─────────────────────────────────────────────────
    const handleBulkImport = async () => {
        if (parsedRows.length === 0) {
            alert("Please load a file first.");
            return;
        }

        // Instructor selection is now optional for Admins — students go to enrollment list

        setLoading(true);
        setImportResult(null);

        try {
            const result = await bulkImportStudents(
                parsedRows,
                importClasses,
                isSystemAdmin ? selectedInstructor : undefined
            );
            setImportResult(result);
            if (result.success > 0 || result.linked > 0) {
                router.refresh();
            }
        } catch {
            setImportResult({ success: 0, linked: 0, failed: [{ row: 0, reason: "An unexpected error occurred." }] });
        }

        setLoading(false);
    };

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ["Name", "SIN", "Year Level", "Department"],
            ["John Doe", "22-00001", "1st Year", "BSIT"],
            ["Jane Smith", "23-12345", "2nd Year", "BSCS"],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");
        XLSX.writeFile(wb, "student_import_template.xlsx");
    };

    if (!isOpen) {
        return (
            <div onClick={() => setIsOpen(true)}>
                {trigger || (
                    <button
                        className="flex items-center px-4 py-2 bg-nwu-red text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                    >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Student
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200 lg:max-w-lg max-h-[90vh] overflow-y-auto">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    <X className="h-5 w-5" />
                </button>

                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Add New Student</h2>

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
                            Bulk Import
                        </button>
                    </div>
                )}

                {/* ─── MANUAL TAB (original form, untouched) ──────────────── */}
                {activeTab === "manual" && (
                    <>
                        {existingStudent && (
                            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-sm flex items-start">
                                <Lock className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                                <div>
                                    <span className="font-semibold block">Student Found in Registry</span>
                                    Name and year level are locked. Select your class(es) to enroll them.
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* System Admin: Optional Instructor Assignment */}
                            {isSystemAdmin && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Assign to Instructor <span className="text-gray-400 font-normal italic text-xs">(Optional)</span>
                                    </label>
                                    <select
                                        value={selectedInstructor}
                                        onChange={(e) => setSelectedInstructor(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="">Enrollment List (No Instructor)</option>
                                        {instructors.map((inst) => (
                                            <option key={inst.id} value={inst.id}>
                                                {inst.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Leave as &quot;Enrollment List&quot; to add students without assigning to an instructor.</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    SIN (Student ID)
                                    {checkingSin && <span className="ml-2 text-gray-400 text-xs">Checking...</span>}
                                </label>
                                <input
                                    id="sin"
                                    name="sin"
                                    type="text"
                                    required
                                    onBlur={handleSinBlur}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:text-white"
                                    placeholder="e.g. 22-00001"
                                />
                                <p className="text-xs text-gray-500 mt-1">Format: YY-XXXXX or YY-XXXXXX</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                                <input
                                    id="name"
                                    name="name"
                                    required
                                    maxLength={200}
                                    value={existingStudent ? existingStudent.name : undefined}
                                    readOnly={!!existingStudent}
                                    onChange={(e) => !existingStudent && setNameLength(e.target.value.length)}
                                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:text-white ${existingStudent ? 'bg-gray-100 dark:bg-gray-600 text-gray-500 cursor-not-allowed' : ''}`}
                                    placeholder="e.g. John Doe"
                                />
                                {!existingStudent && <p className="text-xs text-gray-500 mt-1">{nameLength}/200 characters</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year Level</label>
                                {existingStudent ? (
                                    <input
                                        id="year_level"
                                        name="year_level"
                                        readOnly
                                        value={existingStudent.year_level}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                                    />
                                ) : (
                                    <select
                                        id="year_level"
                                        name="year_level"
                                        required
                                        defaultValue="1st Year"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="1st Year">1st Year</option>
                                        <option value="2nd Year">2nd Year</option>
                                        <option value="3rd Year">3rd Year</option>
                                        <option value="4th Year">4th Year</option>
                                    </select>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department <span className="text-red-500">*</span></label>
                                {existingStudent ? (
                                    <input
                                        id="department"
                                        name="department"
                                        readOnly
                                        value={existingStudent.department || "Unknown"}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                                        title="Department is locked because this student already exists."
                                    />
                                ) : (
                                    <>
                                        <select
                                            name="department"
                                            required
                                            defaultValue=""
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:text-white"
                                        >
                                            <option value="" disabled>Select Department</option>
                                            {(showAllDepartments && !isSuperAdmin
                                                ? allDepartments.filter(allDept => !departments.some(d => d.id === allDept.id))
                                                : departments
                                            ).map(dept => (
                                                <option key={dept.id} value={dept.code}>{dept.code} — {dept.name}</option>
                                            ))}
                                        </select>

                                        {!isSuperAdmin && (
                                            <label className="flex items-center mt-2 space-x-2 text-xs text-gray-600 dark:text-gray-400 select-none cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={showAllDepartments}
                                                    onChange={(e) => setShowAllDepartments(e.target.checked)}
                                                    className="rounded border-gray-300 text-nwu-red focus:ring-nwu-red bg-white dark:bg-gray-700 dark:border-gray-600"
                                                />
                                                <span>Assign to another department</span>
                                            </label>
                                        )}
                                    </>
                                )}
                            </div>



                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Assign Classes <span className="text-gray-400 font-normal italic text-xs">(Optional)</span>
                                </label>
                                <div className="border border-gray-200 dark:border-gray-600 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                                    {classes.length === 0 ? (
                                        <p className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">No classes found.</p>
                                    ) : (
                                        classes.map(c => (
                                            <div
                                                key={c.id}
                                                className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selectedClasses.includes(c.id) ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                                onClick={() => toggleClass(c.id)}
                                            >
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                                                    {c.description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.description}</p>}
                                                </div>
                                                <div className={`h-5 w-5 rounded border flex items-center justify-center ${selectedClasses.includes(c.id) ? 'bg-nwu-red border-nwu-red text-white' : 'border-gray-300 dark:border-gray-500'}`}>
                                                    {selectedClasses.includes(c.id) && <Check className="h-3 w-3" />}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <p className="text-xs text-gray-500">{selectedClasses.length} class(es) selected</p>
                                </div>
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
                                    disabled={loading || checkingSin}
                                    className="px-4 py-2 bg-nwu-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? "Saving..." : (existingStudent ? "Enroll Student" : "Save Student")}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                {/* ─── BULK IMPORT TAB ────────────────────────────────────── */}
                {activeTab === "import" && (
                    <div className="space-y-4">
                        {/* System Admin: Optional Instructor Assignment */}
                        {isSystemAdmin && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Assign to Instructor <span className="text-gray-400 font-normal italic text-xs">(Optional)</span>
                                </label>
                                <select
                                    value={selectedInstructor}
                                    onChange={(e) => setSelectedInstructor(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:text-white"
                                >
                                    <option value="">Enrollment List (No Instructor)</option>
                                    {instructors.map((inst) => (
                                        <option key={inst.id} value={inst.id}>
                                            {inst.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Leave as &quot;Enrollment List&quot; to add students without assigning to an instructor.</p>
                            </div>
                        )}

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
                            <div
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                className={cn(
                                    "flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl transition-colors relative",
                                    dragActive ? "border-nwu-red bg-red-50 dark:bg-red-900/10" : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500",
                                )}
                            >
                                <input
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-xl"
                                    onChange={handleFileDrop}
                                />
                                <div className="pointer-events-none flex flex-col items-center justify-center text-center px-4">
                                    <FileSpreadsheet className={cn(
                                        "h-10 w-10 mb-2 transition-colors",
                                        dragActive ? "text-nwu-red" : "text-gray-300 dark:text-gray-500"
                                    )} />
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                        Drag & drop or click to upload
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Accepts <span className="text-nwu-red">.csv</span> or <span className="text-nwu-red">.xlsx</span>
                                    </p>
                                </div>
                            </div>
                        )}

                        {fileError && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center">
                                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                                {fileError}
                            </div>
                        )}

                        {/* Preview Table */}
                        {parsedRows.length > 0 && !importResult && (
                            <>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                            Preview ({parsedRows.length} student{parsedRows.length !== 1 ? "s" : ""})
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
                                    <div className="border dark:border-gray-600 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                                <tr>
                                                    <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">#</th>
                                                    <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">Name</th>
                                                    <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">SIN</th>
                                                    <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">Year</th>
                                                    <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">Dept</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {parsedRows.map((row, i) => (
                                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                                                        <td className="px-2 py-1.5 text-gray-900 dark:text-white font-medium truncate max-w-[120px]">{row.name}</td>
                                                        <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400 font-mono">{row.sin}</td>
                                                        <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400">{row.year_level}</td>
                                                        <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400">{row.department || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Class Selector for Import */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Enroll into Classes <span className="text-gray-400 font-normal italic text-xs">(Optional)</span>
                                    </label>
                                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg max-h-32 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                                        {classes.length === 0 ? (
                                            <p className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">No classes found.</p>
                                        ) : (
                                            classes.map(c => (
                                                <div
                                                    key={c.id}
                                                    className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${importClasses.includes(c.id) ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                                    onClick={() => toggleImportClass(c.id)}
                                                >
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                                                    <div className={`h-5 w-5 rounded border flex items-center justify-center flex-shrink-0 ${importClasses.includes(c.id) ? 'bg-nwu-red border-nwu-red text-white' : 'border-gray-300 dark:border-gray-500'}`}>
                                                        {importClasses.includes(c.id) && <Check className="h-3 w-3" />}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{importClasses.length} class(es) selected</p>
                                </div>
                            </>
                        )}

                        {/* Import Result */}
                        {importResult && (
                            <div className="space-y-3">
                                {(importResult.success > 0 || importResult.linked > 0) && (
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm space-y-1">
                                        {importResult.success > 0 && (
                                            <p className="flex items-center">
                                                <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                                                {importResult.success} new student{importResult.success !== 1 ? "s" : ""} created & enrolled.
                                            </p>
                                        )}
                                        {importResult.linked > 0 && (
                                            <p className="flex items-center">
                                                <Link2 className="h-4 w-4 mr-2 flex-shrink-0" />
                                                {importResult.linked} existing student{importResult.linked !== 1 ? "s" : ""} linked to your class(es).
                                            </p>
                                        )}
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
                                    onClick={resetImportState}
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
                                    className="px-4 py-2 bg-nwu-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    {loading ? "Importing..." : `Import ${parsedRows.length} Student${parsedRows.length !== 1 ? "s" : ""}`}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
