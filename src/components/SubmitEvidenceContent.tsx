"use client";

import { useState, useEffect } from "react";
import { Upload, X, CheckCircle, XCircle, Loader2, Calendar, FileText, Plus, UserCheck, Info } from "lucide-react";

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
    const [loadingData, setLoadingData] = useState(true);

    const [student, setStudent] = useState<StudentInfo | null>(null);
    const [allClasses, setAllClasses] = useState<ClassInfo[]>([]);
    const [instructors, setInstructors] = useState<InstructorInfo[]>([]);

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
            setLoadingData(true);
            const res = await fetch(`/api/evidence/public-upload?sin=${encodeURIComponent(sinToLookup.trim())}`);
            const data = await res.json();

            // Fallback: If not ok, we just return. No setLookupError since it's removed.
            if (!res.ok) {
                return;
            }

            setStudent(data.student);
            setAllClasses(data.classes || []);
            setInstructors(data.instructors || []);
        } catch {
            // connection error handled silently
        } finally {
            setLoadingData(false);
        }
    };

    // Auto-lookup since sin is always provided by the Portal
    useEffect(() => {
        if (sin && (!student || student.sin !== sin)) {
            handleLookup(sin);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sin, student]);

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
        setFiles([...files, ...selected]);
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
        // Ensure lookup is re-triggered
        setLoadingData(true);
    };

    return (
        <div className="flex flex-col h-full p-2">
            <div className="flex-grow flex items-center justify-center">
                <div className="w-full">
                    {/* Wait for initial data load */}
                    {loadingData && (
                        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100">
                            <Loader2 className="h-8 w-8 text-nwu-red animate-spin" />
                            <p className="text-sm font-medium text-gray-500 mt-4">Loading form data...</p>
                        </div>
                    )}

                    {/* Step 2: Upload Form */}
                    {step === "form" && student && !loadingData && (
                        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-12">
                            {/* Instructor Selection */}
                            <div className="space-y-4">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center border border-red-100 dark:border-red-800">
                                        <UserCheck className="h-4 w-4 text-nwu-red" />
                                    </div>
                                    Select Instructor
                                </label>
                                <select
                                    value={selectedInstructor}
                                    onChange={(e) => handleInstructorChange(e.target.value)}
                                    className="w-full px-6 py-4 bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm border border-gray-100 dark:border-gray-800 rounded-2xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red outline-none transition-all shadow-sm"
                                >
                                    <option value="">Choose your instructor...</option>
                                    {instructors.map((inst) => (
                                        <option key={inst.id} value={inst.id}>
                                            {inst.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Class Selection */}
                            <div className="space-y-4">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center border border-red-100 dark:border-red-800">
                                        <FileText className="h-4 w-4 text-nwu-red" />
                                    </div>
                                    Select Class(es) to Excuse From
                                </label>

                                {!selectedInstructor ? (
                                    <div className="text-sm text-gray-400 italic p-12 bg-white/20 dark:bg-gray-900/20 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800 text-center backdrop-blur-sm">
                                        Select an instructor above to see their classes
                                    </div>
                                ) : filteredClasses.length === 0 ? (
                                    <div className="p-6 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex items-center gap-4 backdrop-blur-sm">
                                        <Info className="h-5 w-5 text-amber-500" />
                                        <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">No active classes found for this instructor.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {filteredClasses.map((c) => (
                                            <label
                                                key={c.id}
                                                className={`flex items-start gap-4 p-5 rounded-[2rem] border-2 cursor-pointer transition-all duration-300 ${selectedClass.includes(String(c.id))
                                                    ? "bg-red-50/50 dark:bg-red-900/20 border-nwu-red shadow-xl shadow-red-100/20 ring-4 ring-red-500/5"
                                                    : "bg-white/40 dark:bg-gray-900/40 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 hover:bg-white/60 dark:hover:bg-gray-900/60"
                                                    }`}
                                            >
                                                <div className={`mt-1 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedClass.includes(String(c.id)) ? "bg-nwu-red border-nwu-red" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}>
                                                    {selectedClass.includes(String(c.id)) && <CheckCircle className="h-4 w-4 text-white" />}
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
                                                        className="hidden"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-black text-gray-900 dark:text-white tracking-tight leading-tight">{c.subject_name}</div>
                                                    <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">{c.section} • {c.year_level}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Date Selection */}
                            <div className="space-y-4">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center border border-red-100 dark:border-red-800">
                                        <Calendar className="h-4 w-4 text-nwu-red" />
                                    </div>
                                    Absence Date(s)
                                </label>
                                <div className="flex gap-4">
                                    <input
                                        type="date"
                                        value={currentDate}
                                        onChange={(e) => setCurrentDate(e.target.value)}
                                        className="flex-1 px-6 py-4 bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm border border-gray-100 dark:border-gray-800 rounded-2xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red outline-none transition-all shadow-sm"
                                    />
                                    <button 
                                        onClick={addDate} 
                                        disabled={!currentDate} 
                                        className="h-14 w-14 flex items-center justify-center bg-red-100/50 dark:bg-red-900/30 text-nwu-red rounded-2xl hover:bg-nwu-red hover:text-white disabled:opacity-30 transition-all shadow-lg active:scale-90"
                                    >
                                        <Plus className="h-7 w-7" />
                                    </button>
                                </div>
                                {dates.length > 0 && (
                                    <div className="flex flex-wrap gap-3 mt-4">
                                        {dates.map((d) => (
                                            <span key={d} className="inline-flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 text-nwu-red border border-red-50 dark:border-red-900/30 rounded-2xl text-xs font-black shadow-md animate-in zoom-in-90">
                                                {d}
                                                <button onClick={() => setDates(dates.filter((x) => x !== d))} className="hover:text-red-900 p-1 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-full transition-colors">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* File Upload */}
                            <div className="space-y-4">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center border border-red-100 dark:border-red-800">
                                        <Upload className="h-4 w-4 text-nwu-red" />
                                    </div>
                                    Upload Documents (Images/PDF/DOC)
                                </label>
                                <div className="space-y-4">
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="file-upload"
                                            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                                            multiple
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                        <div className="flex items-center gap-4">
                                            <label htmlFor="file-upload" className="flex items-center gap-3 px-8 py-4 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-nwu-red rounded-2xl font-black text-xs cursor-pointer transition-all border border-red-100 dark:border-red-800 shadow-md active:scale-95 w-fit">
                                                <Upload className="h-5 w-5" />
                                                CHOOSE FILES
                                            </label>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
                                                {files.length === 0 ? "Choose your files" : `${files.length} selected`}
                                            </span>
                                        </div>
                                    </div>

                                    {files.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {files.map((f, i) => (
                                                <div key={i} className="flex items-center justify-between px-5 py-4 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border border-gray-100 dark:border-gray-800 rounded-[1.5rem] shadow-sm">
                                                    <span className="flex items-center gap-4 text-gray-700 dark:text-gray-300 truncate font-black text-[11px] uppercase tracking-wide">
                                                        <FileText className="h-4 w-4 text-nwu-red" />
                                                        {f.name}
                                                    </span>
                                                    <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-4">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">Description (optional)</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={4}
                                    placeholder="e.g. Medical certificate for illness on Feb 10"
                                    className="w-full px-6 py-5 bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm border border-gray-100 dark:border-gray-800 rounded-3xl text-gray-900 dark:text-white text-sm resize-none focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red outline-none transition-all shadow-sm"
                                />
                            </div>

                            {/* Messages */}
                            {uploadMessage && (
                                <div className={`flex items-center gap-4 p-6 rounded-[2rem] text-sm font-black animate-in slide-in-from-top-2 duration-300 border backdrop-blur-md ${uploadMessage.type === "error" ? "bg-red-50/80 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900" : "bg-green-50/80 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900"}`}>
                                    {uploadMessage.type === "error" ? <XCircle className="h-6 w-6 shrink-0" /> : <CheckCircle className="h-6 w-6 shrink-0" />}
                                    {uploadMessage.text}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-8">
                                <button
                                    onClick={handleSubmit}
                                    disabled={!selectedClass || dates.length === 0 || files.length === 0 || uploading}
                                    className="w-full py-4 bg-nwu-red hover:bg-red-800 text-white font-black rounded-[2rem] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl shadow-red-200 dark:shadow-none flex items-center justify-center gap-3 text-sm tracking-[0.15em] active:scale-95 group uppercase"
                                >
                                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 transition-transform group-hover:-translate-y-1" />}
                                    Submit Excuse Letter
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Success */}
                    {step === "success" && (
                        <div className="max-w-2xl mx-auto py-20 animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-12 text-center flex flex-col items-center">
                            <div className="h-24 w-24 bg-green-500/10 dark:bg-green-500/20 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-900 shadow-2xl animate-bounce">
                                <CheckCircle className="h-12 w-12 text-green-500" />
                            </div>
                            
                            <div className="space-y-4">
                                <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Submitted Successfully!</h2>
                                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed text-lg font-medium">
                                    Your excuse letter has been submitted. Your instructor will be notified to review your documents.
                                </p>
                            </div>

                            <div className="flex flex-col items-center gap-6 w-full max-w-xs">
                                <div className="px-8 py-4 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md border border-gray-100 dark:border-gray-800 rounded-3xl w-full">
                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Documents attached</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{files.length}</p>
                                </div>
                                
                                <button 
                                    onClick={resetForm} 
                                    className="w-full py-4 bg-nwu-red hover:bg-red-800 text-white font-black rounded-[2rem] transition-all shadow-xl shadow-red-200 dark:shadow-none text-sm tracking-[0.15em] active:scale-95 uppercase"
                                >
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
