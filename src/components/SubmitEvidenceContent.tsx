"use client";

import { useState, useEffect } from "react";
import { Upload, Calendar, X, Plus, Loader2, CheckCircle, XCircle, FileText, UserCheck } from "lucide-react";

interface StudentInfo {
    id: number;
    name: string;
    sin: string;
    year_level: string;
}

interface InstructorInfo {
    id: string;
    name: string;
}

interface ClassInfo {
    id: number;
    subject_name: string;
    section: string;
    year_level: string;
    instructor_id: string;
    instructor_name: string;
}

type Step = "lookup" | "form" | "success";

export function SubmitEvidenceContent({ sin }: { sin: string }) {
    const [step, setStep] = useState<Step>("form");

    const [student, setStudent] = useState<StudentInfo | null>(null);
    const [allClasses, setAllClasses] = useState<ClassInfo[]>([]);
    const [instructors, setInstructors] = useState<InstructorInfo[]>([]);
    const [uploadsRemaining, setUploadsRemaining] = useState(5);

    const [selectedInstructor, setSelectedInstructor] = useState("");
    const [selectedClass, setSelectedClass] = useState("");
    const [dates, setDates] = useState<string[]>([]);
    const [currentDate, setCurrentDate] = useState("");
    const [description, setDescription] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Filter classes by selected instructor
    const filteredClasses = selectedInstructor
        ? allClasses.filter((c) => String(c.instructor_id) === selectedInstructor)
        : [];

    const handleLookup = async (sinToLookup: string) => {
        try {
            const res = await fetch(`/api/evidence/public-upload?sin=${encodeURIComponent(sinToLookup.trim())}`);
            const data = await res.json();

            // Fallback: If not ok, we just return. No setLookupError since it's removed.
            if (!res.ok) {
                return;
            }

            setStudent(data.student);
            setAllClasses(data.classes || []);
            setInstructors(data.instructors || []);
            setUploadsRemaining(data.uploads_remaining);

            if (data.uploads_remaining <= 0) {
                return;
            }
        } catch {
            // connection error handled silently
        }
    };

    // Auto-lookup since sin is always provided by the Portal
    useEffect(() => {
        if (sin && !student) {
            handleLookup(sin);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sin]);

    const handleInstructorChange = (instructorId: string) => {
        setSelectedInstructor(instructorId);
        setSelectedClass(""); // Reset class when instructor changes
    };

    const addDate = () => {
        if (currentDate && !dates.includes(currentDate)) {
            setDates([...dates, currentDate]);
            setCurrentDate("");
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || []);
        const combined = [...files, ...selected].slice(0, Math.min(5, uploadsRemaining));
        setFiles(combined);
    };

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        // Allow submission if dates array has items OR if there is a pending currentDate
        const effectiveDates = [...dates];
        if (currentDate && !effectiveDates.includes(currentDate)) {
            effectiveDates.push(currentDate);
        }

        if (!student || !selectedClass || effectiveDates.length === 0 || files.length === 0) return;

        setUploading(true);
        setUploadMessage(null);

        const formData = new FormData();
        formData.append("sin", student.sin);
        formData.append("class_id", selectedClass);
        formData.append("dates", JSON.stringify(effectiveDates));
        if (description) formData.append("description", description);
        files.forEach((f, i) => formData.append(`file${i}`, f));

        try {
            const res = await fetch("/api/evidence/public-upload", { method: "POST", body: formData });
            const data = await res.json();

            if (res.ok) {
                setStep("success");
                setUploadsRemaining(data.remaining_uploads);
            } else {
                setUploadMessage({ type: "error", text: data.error });
            }
        } catch {
            setUploadMessage({ type: "error", text: "Upload failed. Please try again." });
        } finally {
            setUploading(false);
        }
    };

    const resetForm = () => {
        setStep("form");
        setStudent(null);
        setAllClasses([]);
        setInstructors([]);
        setSelectedInstructor("");
        setSelectedClass("");
        setDates([]);
        setFiles([]);
        setDescription("");
        setUploadMessage(null);
    };

    return (
        <div className="flex flex-col h-full p-2">
            <div className="flex-grow flex items-center justify-center">
                <div className="w-full">
                    {/* Step 2: Upload Form */}
                    {step === "form" && student && (
                        <div className="bg-white rounded-xl shadow-xl border-t-4 border-nwu-gold overflow-hidden">
                            <div className="p-6 space-y-5">
                                {/* Instructor Selection (FIRST) */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                        <UserCheck className="h-3.5 w-3.5" />
                                        Select Instructor
                                    </label>
                                    <select
                                        value={selectedInstructor}
                                        onChange={(e) => handleInstructorChange(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm focus:ring-nwu-red focus:border-nwu-red"
                                    >
                                        <option value="">Choose your instructor...</option>
                                        {instructors.map((inst) => (
                                            <option key={inst.id} value={inst.id}>
                                                {inst.name}
                                            </option>
                                        ))}
                                    </select>
                                    {instructors.length === 0 && (
                                        <p className="text-xs text-amber-600 mt-1">No instructors found. You may not be enrolled in any classes.</p>
                                    )}
                                </div>

                                {/* Class Selection (filtered by instructor) - MULTI SELECT */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Select Class(es) to Excuse From</label>

                                    {!selectedInstructor ? (
                                        <div className="text-sm text-gray-400 italic p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
                                            Select an instructor above to see their classes
                                        </div>
                                    ) : filteredClasses.length === 0 ? (
                                        <p className="text-xs text-amber-600 mt-1">No classes found for this instructor.</p>
                                    ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                                            {filteredClasses.map((c) => (
                                                <label
                                                    key={c.id}
                                                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedClass.includes(String(c.id))
                                                        ? "bg-red-50 border-nwu-red shadow-sm"
                                                        : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        value={c.id}
                                                        checked={selectedClass.includes(String(c.id))}
                                                        onChange={(e) => {
                                                            const id = String(c.id);
                                                            const current = selectedClass ? selectedClass.split(',') : [];
                                                            let newSelection;
                                                            if (e.target.checked) {
                                                                newSelection = [...current, id];
                                                            } else {
                                                                newSelection = current.filter(cid => cid !== id);
                                                            }
                                                            setSelectedClass(newSelection.join(','));
                                                        }}
                                                        className="mt-1 h-4 w-4 text-nwu-red border-gray-300 rounded focus:ring-nwu-red"
                                                    />
                                                    <div>
                                                        <div className="font-medium text-sm text-gray-900">{c.subject_name}</div>
                                                        <div className="text-xs text-gray-500">{c.section} • {c.year_level}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                    {selectedInstructor && (selectedClass.split(',').filter(Boolean).length > 0) && (
                                        <p className="text-xs text-gray-500 mt-2 text-right font-medium">
                                            {selectedClass.split(',').filter(Boolean).length} class(es) selected
                                        </p>
                                    )}
                                </div>

                                {/* Date Selection */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Absence Date(s)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            value={currentDate}
                                            onChange={(e) => setCurrentDate(e.target.value)}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-nwu-red focus:border-nwu-red"
                                        />
                                        <button onClick={addDate} disabled={!currentDate} className="px-3 py-2 bg-nwu-red text-white rounded-lg hover:bg-[#5e0d0e] disabled:opacity-50 transition-colors shadow-sm">
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                    {dates.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {dates.map((d) => (
                                                <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-nwu-red border border-red-100 rounded-md text-xs font-medium">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {d}
                                                    <button onClick={() => setDates(dates.filter((x) => x !== d))} className="hover:text-red-900 ml-1 transition-colors">
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* File Upload */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                                        Upload Documents (JPG/PNG, max 5MB each, up to {Math.min(5, uploadsRemaining)} files)
                                    </label>
                                    <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png"
                                        multiple
                                        onChange={handleFileSelect}
                                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-nwu-red hover:file:bg-red-100 transition-colors"
                                    />
                                    {files.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {files.map((f, i) => (
                                                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                                                    <span className="flex items-center gap-2 text-gray-700 truncate font-medium">
                                                        <FileText className="h-4 w-4 text-gray-400" />
                                                        {f.name} <span className="text-gray-400 font-normal">({(f.size / 1024 / 1024).toFixed(1)}MB)</span>
                                                    </span>
                                                    <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description (optional)</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={2}
                                        placeholder="e.g. Medical certificate for illness on Feb 10"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-nwu-red focus:border-nwu-red shadow-sm"
                                    />
                                </div>

                                {/* Messages */}
                                {uploadMessage && (
                                    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${uploadMessage.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                                        {uploadMessage.type === "error" ? <XCircle className="h-4 w-4 shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
                                        {uploadMessage.text}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!selectedClass || dates.length === 0 || files.length === 0 || uploading}
                                        className="flex-1 py-3 bg-nwu-red text-white font-bold rounded-lg hover:bg-[#5e0d0e] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
                                    >
                                        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                                        Submit Excuse Letter
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Success */}
                    {step === "success" && (
                        <div className="bg-white rounded-xl shadow-xl border-t-4 border-green-500 p-8 text-center space-y-6">
                            <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center shadow-inner">
                                <CheckCircle className="h-8 w-8 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-extrabold text-gray-900">Submitted Successfully!</h2>
                                <p className="mt-2 text-sm text-gray-500">
                                    Your excuse letter has been submitted for review.<br />
                                    Your instructor will be notified and can approve or reject the submission.
                                </p>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-sm space-y-2 text-left shadow-sm">
                                <p className="text-gray-600 flex justify-between"><span>Documents submitted:</span> <strong className="text-gray-900 text-base">{files.length}</strong></p>
                                <p className="text-gray-600 flex justify-between"><span>Remaining uploads:</span> <strong className="text-gray-900 text-base">{uploadsRemaining}</strong></p>
                            </div>
                            <div className="pt-2">
                                <button onClick={resetForm} className="w-full py-3 bg-nwu-red text-white font-bold rounded-lg hover:bg-[#5e0d0e] shadow-sm transition-all text-sm">
                                    Submit Another
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
