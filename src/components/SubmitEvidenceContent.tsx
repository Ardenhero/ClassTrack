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
    const [loadingData, setLoadingData] = useState(true);

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
            setUploadsRemaining(data.uploads_remaining);

            if (data.uploads_remaining <= 0) {
                return;
            }
        } catch {
            // connection error handled silently
        } finally {
            setLoadingData(false);
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
                    {/* Wait for initial data load */}
                    {loadingData && (
                        <div className="flex flex-col items-center justify-center p-12 glass-card rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] border-t border-t-white/10">
                            <Loader2 className="h-8 w-8 text-nu-400 animate-spin shadow-[0_0_15px_rgba(176,42,42,0.6)] rounded-full" />
                            <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mt-4">Loading form data...</p>
                        </div>
                    )}

                    {/* Step 2: Upload Form */}
                    {step === "form" && student && !loadingData && (
                        <div className="glass-card rounded-3xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] border-t border-t-white/10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-nu-500/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none group-hover:bg-nu-500/20 transition-colors duration-700"></div>

                            <div className="relative z-10 space-y-6">
                                {/* Instructor Selection (FIRST) */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <UserCheck className="h-3.5 w-3.5 text-gray-500 drop-shadow-sm" />
                                        Select Instructor
                                    </label>
                                    <select
                                        value={selectedInstructor}
                                        onChange={(e) => handleInstructorChange(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-dark-bg border border-white/10 rounded-xl text-white text-sm focus:ring-1 focus:ring-nu-500/50 focus:border-nu-400 shadow-inner appearance-none transition-colors"
                                    >
                                        <option value="" className="bg-dark-surface text-gray-400">Choose your instructor...</option>
                                        {instructors.map((inst) => (
                                            <option key={inst.id} value={inst.id} className="bg-dark-surface text-white">
                                                {inst.name}
                                            </option>
                                        ))}
                                    </select>
                                    {instructors.length === 0 && (
                                        <p className="text-xs text-orange-400 mt-2 font-medium tracking-wide">No instructors found. You may not be enrolled in any classes.</p>
                                    )}
                                </div>

                                {/* Class Selection (filtered by instructor) - MULTI SELECT */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Select Class(es) to Excuse From</label>

                                    {!selectedInstructor ? (
                                        <div className="text-xs font-bold tracking-widest uppercase text-gray-500 p-4 glass-panel rounded-xl text-center shadow-inner">
                                            Select an instructor above to see their classes
                                        </div>
                                    ) : filteredClasses.length === 0 ? (
                                        <p className="text-xs text-orange-400 mt-2 font-medium tracking-wide">No classes found for this instructor.</p>
                                    ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                            {filteredClasses.map((c) => (
                                                <label
                                                    key={c.id}
                                                    className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-300 group ${selectedClass.includes(String(c.id))
                                                        ? "bg-nu-500/10 border-nu-500/40 shadow-[0_0_15px_rgba(176,42,42,0.1)]"
                                                        : "glass-panel hover:bg-white/5 hover:border-white/20"
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
                                                        className="mt-1 h-4 w-4 text-nu-500 bg-dark-bg border border-white/20 rounded focus:ring-nu-500/50 focus:ring-offset-dark-surface"
                                                    />
                                                    <div>
                                                        <div className={`font-bold text-sm tracking-wide transition-colors ${selectedClass.includes(String(c.id)) ? "text-white drop-shadow-sm" : "text-gray-300 group-hover:text-white"}`}>{c.subject_name}</div>
                                                        <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mt-1">{c.section} • {c.year_level}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                    {selectedInstructor && (selectedClass.split(',').filter(Boolean).length > 0) && (
                                        <p className="text-[10px] text-nu-400 mt-3 text-right font-bold uppercase tracking-widest">
                                            {selectedClass.split(',').filter(Boolean).length} class(es) selected
                                        </p>
                                    )}
                                </div>

                                {/* Date Selection */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Absence Date(s)</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="date"
                                            value={currentDate}
                                            onChange={(e) => setCurrentDate(e.target.value)}
                                            className="flex-1 px-4 py-3 glass-input rounded-xl text-white text-sm focus:border-nu-400 shadow-inner [color-scheme:dark]"
                                        />
                                        <button onClick={addDate} disabled={!currentDate} className="px-5 py-3 bg-nu-500 text-white rounded-xl hover:bg-nu-400 disabled:opacity-50 disabled:hover:bg-nu-500 transition-colors shadow-glow-red hover:shadow-[0_0_15px_rgba(176,42,42,0.6)]">
                                            <Plus className="h-5 w-5 drop-shadow-md" />
                                        </button>
                                    </div>
                                    {dates.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {dates.map((d) => (
                                                <span key={d} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nu-500/10 text-nu-400 border border-nu-500/30 rounded-lg text-xs font-bold tracking-widest shadow-sm">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {d}
                                                    <button onClick={() => setDates(dates.filter((x) => x !== d))} className="hover:text-red-400 ml-1 transition-colors">
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* File Upload */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 leading-relaxed">
                                        Upload Documents <span className="text-gray-500 ml-1">(JPG/PNG, max 5MB each, up to {Math.min(5, uploadsRemaining)} files)</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept=".jpg,.jpeg,.png"
                                            multiple
                                            onChange={handleFileSelect}
                                            className="w-full text-xs text-gray-400 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:tracking-widest file:uppercase file:bg-white/10 file:text-white hover:file:bg-white/20 hover:file:shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-all cursor-pointer glass-input rounded-xl file:cursor-pointer"
                                        />
                                    </div>
                                    {files.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {files.map((f, i) => (
                                                <div key={i} className="flex items-center justify-between px-4 py-3 glass-panel border border-white/10 rounded-xl text-sm hover:border-white/20 transition-colors group">
                                                    <span className="flex items-center gap-3 text-gray-300 truncate font-medium tracking-wide">
                                                        <FileText className="h-4 w-4 text-gray-500 group-hover:text-nu-400 transition-colors" />
                                                        {f.name} <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px] ml-1">({(f.size / 1024 / 1024).toFixed(1)}MB)</span>
                                                    </span>
                                                    <button onClick={() => removeFile(i)} className="text-gray-500 hover:text-red-400 transition-colors bg-white/5 hover:bg-red-500/10 p-1.5 rounded-lg">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Description <span className="text-gray-500 normal-case tracking-normal text-xs">(optional)</span></label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        placeholder="e.g. Medical certificate for illness on Feb 10"
                                        className="w-full px-4 py-3 glass-input rounded-xl text-white text-sm resize-none focus:border-nu-400 shadow-inner placeholder-gray-600"
                                    />
                                </div>

                                {/* Messages */}
                                {uploadMessage && (
                                    <div className={`flex items-center gap-3 p-4 rounded-xl text-sm font-bold tracking-wide shadow-inner border ${uploadMessage.type === "error" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"}`}>
                                        {uploadMessage.type === "error" ? <XCircle className="h-5 w-5 shrink-0 drop-shadow-md" /> : <CheckCircle className="h-5 w-5 shrink-0 drop-shadow-md" />}
                                        {uploadMessage.text}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-4 pt-2">
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!selectedClass || dates.length === 0 || files.length === 0 || uploading}
                                        className="w-full py-4 text-sm tracking-widest font-bold text-white uppercase bg-nu-500 hover:bg-nu-400 rounded-xl transition-all duration-300 shadow-glow-red hover:shadow-[0_0_25px_rgba(176,42,42,0.6)] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed hover:-translate-y-0.5 flex items-center justify-center gap-3"
                                    >
                                        {uploading ? <Loader2 className="h-5 w-5 animate-spin drop-shadow-md" /> : <Upload className="h-5 w-5 drop-shadow-md" />}
                                        <span className="drop-shadow-sm">{uploading ? "Uploading Evidence..." : "Submit Excuse Letter"}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Success */}
                    {step === "success" && (
                        <div className="glass-card rounded-3xl p-10 text-center space-y-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] border-t border-t-green-500/50 relative overflow-hidden group">
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-500/10 rounded-full blur-[80px] pointer-events-none transition-colors duration-700"></div>

                            <div className="mx-auto h-20 w-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center shadow-[inset_0_1px_10px_rgba(74,222,128,0.2)] drop-shadow-[0_0_15px_rgba(74,222,128,0.3)] relative z-10">
                                <CheckCircle className="h-10 w-10 text-green-400" />
                            </div>
                            <div className="relative z-10">
                                <h2 className="text-2xl font-black text-white tracking-wide drop-shadow-sm">Submitted Successfully!</h2>
                                <p className="mt-3 text-sm text-gray-400 font-medium leading-relaxed">
                                    Your excuse letter has been submitted for review.<br />
                                    Your instructor will be notified and can approve or reject the submission.
                                </p>
                            </div>
                            <div className="glass-panel border-white/5 rounded-2xl p-6 text-sm space-y-3 text-left shadow-inner relative z-10">
                                <p className="text-gray-400 flex justify-between font-bold uppercase tracking-widest text-[10px]"><span>Documents submitted:</span> <strong className="text-white text-sm font-black drop-shadow-sm">{files.length}</strong></p>
                                <p className="text-gray-400 flex justify-between font-bold uppercase tracking-widest text-[10px]"><span>Remaining uploads:</span> <strong className="text-white text-sm font-black drop-shadow-sm">{uploadsRemaining}</strong></p>
                            </div>
                            <div className="pt-4 relative z-10">
                                <button onClick={resetForm} className="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 text-white font-bold tracking-widest uppercase rounded-xl shadow-sm transition-all focus:ring-1 focus:ring-white/30">
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
