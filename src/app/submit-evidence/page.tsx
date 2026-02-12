"use client";

import { useState } from "react";
import Image from "next/image";
import { Upload, Search, Calendar, X, Plus, Loader2, CheckCircle, XCircle, ArrowLeft, FileText, AlertTriangle } from "lucide-react";

interface StudentInfo {
    id: number;
    name: string;
    sin: string;
    year_level: string;
}

interface ClassInfo {
    id: number;
    subject_name: string;
    section: string;
    year_level: string;
    instructor_name: string;
}

type Step = "lookup" | "form" | "success";

export default function SubmitEvidencePage() {
    const [step, setStep] = useState<Step>("lookup");
    const [sin, setSin] = useState("");
    const [searching, setSearching] = useState(false);
    const [lookupError, setLookupError] = useState("");

    const [student, setStudent] = useState<StudentInfo | null>(null);
    const [classes, setClasses] = useState<ClassInfo[]>([]);
    const [uploadsRemaining, setUploadsRemaining] = useState(5);

    const [selectedClass, setSelectedClass] = useState("");
    const [dates, setDates] = useState<string[]>([]);
    const [currentDate, setCurrentDate] = useState("");
    const [description, setDescription] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleLookup = async () => {
        if (!sin.trim()) return;
        setSearching(true);
        setLookupError("");

        try {
            const res = await fetch(`/api/evidence/public-upload?sin=${encodeURIComponent(sin.trim())}`);
            const data = await res.json();

            if (!res.ok) {
                setLookupError(data.error || "Student not found");
                return;
            }

            setStudent(data.student);
            setClasses(data.classes || []);
            setUploadsRemaining(data.uploads_remaining);

            if (data.uploads_remaining <= 0) {
                setLookupError("You have reached the maximum upload limit (5 documents). Please contact your instructor.");
                return;
            }

            setStep("form");
        } catch {
            setLookupError("Connection error. Please try again.");
        } finally {
            setSearching(false);
        }
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
        if (!student || !selectedClass || dates.length === 0 || files.length === 0) return;
        setUploading(true);
        setUploadMessage(null);

        const formData = new FormData();
        formData.append("sin", student.sin);
        formData.append("class_id", selectedClass);
        formData.append("dates", JSON.stringify(dates));
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
        setStep("lookup");
        setSin("");
        setStudent(null);
        setClasses([]);
        setSelectedClass("");
        setDates([]);
        setFiles([]);
        setDescription("");
        setUploadMessage(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* University Header */}
            <header className="bg-nwu-red w-full py-4 px-4 shadow-md">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex-shrink-0">
                        <Image src="/branding/nwu_seal.png" alt="Northwestern University Seal" width={80} height={80} className="h-16 w-16 md:h-20 md:w-20 object-contain rounded-full border-2 border-white bg-white" />
                    </div>
                    <div className="flex-grow text-center px-4">
                        <h1 className="text-white font-serif font-bold text-xl md:text-3xl tracking-wide uppercase drop-shadow-sm">Northwestern University</h1>
                        <p className="text-nwu-gold text-xs md:text-sm font-medium tracking-wider uppercase mt-1">Laoag City, Philippines</p>
                    </div>
                    <div className="flex-shrink-0">
                        <Image src="/branding/icpep_logo.png" alt="ICPEP Logo" width={80} height={80} className="h-16 w-16 md:h-20 md:w-20 object-contain rounded-full border-2 border-white bg-white/10" />
                    </div>
                </div>
            </header>

            <div className="flex-grow flex items-center justify-center p-4">
                <div className="max-w-lg w-full">

                    {/* Step 1: SIN Lookup */}
                    {step === "lookup" && (
                        <div className="bg-white rounded-xl shadow-xl border-t-4 border-nwu-gold p-8 space-y-6">
                            <div className="text-center">
                                <div className="mx-auto h-14 w-14 bg-nwu-red/10 rounded-full flex items-center justify-center mb-4">
                                    <FileText className="h-7 w-7 text-nwu-red" />
                                </div>
                                <h2 className="text-2xl font-extrabold text-gray-900">Submit an Excuse Letter</h2>
                                <p className="mt-2 text-sm text-gray-500">Enter your Student ID Number to get started</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID Number (SIN)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={sin}
                                        onChange={(e) => setSin(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                                        placeholder="e.g. 2024-00123"
                                        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-nwu-red focus:border-nwu-red text-sm"
                                    />
                                    <button
                                        onClick={handleLookup}
                                        disabled={!sin.trim() || searching}
                                        className="px-4 py-2.5 bg-nwu-red text-white font-bold rounded-lg hover:bg-[#5e0d0e] disabled:opacity-50 transition-colors flex items-center gap-2"
                                    >
                                        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                        Search
                                    </button>
                                </div>
                            </div>

                            {lookupError && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                                    <XCircle className="h-4 w-4 shrink-0" />
                                    {lookupError}
                                </div>
                            )}

                            <div className="text-center pt-2 border-t border-gray-200">
                                <a href="/login" className="text-sm text-gray-500 hover:text-nwu-red transition-colors flex items-center justify-center gap-1">
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                    Back to Login
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Upload Form */}
                    {step === "form" && student && (
                        <div className="bg-white rounded-xl shadow-xl border-t-4 border-nwu-gold overflow-hidden">
                            {/* Student Info Banner */}
                            <div className="bg-gradient-to-r from-nwu-red to-[#5e0d0e] p-5 text-white">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                                        {student.name[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{student.name}</h3>
                                        <p className="text-red-200 text-xs">{student.sin} • {student.year_level}</p>
                                    </div>
                                </div>
                                <div className="mt-3 bg-white/10 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                                    <AlertTriangle className="h-3.5 w-3.5 text-nwu-gold" />
                                    <span>Uploads remaining: <strong>{uploadsRemaining - files.length}/{uploadsRemaining}</strong></span>
                                </div>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Class Selection */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Select Class to Excuse From</label>
                                    <select
                                        value={selectedClass}
                                        onChange={(e) => setSelectedClass(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm focus:ring-nwu-red focus:border-nwu-red"
                                    >
                                        <option value="">Choose a class...</option>
                                        {classes.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.subject_name} ({c.section}) — {c.instructor_name}
                                            </option>
                                        ))}
                                    </select>
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
                                        <button onClick={addDate} disabled={!currentDate} className="px-3 py-2 bg-nwu-red text-white rounded-lg hover:bg-[#5e0d0e] disabled:opacity-50 transition-colors">
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                    {dates.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {dates.map((d) => (
                                                <span key={d} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-nwu-red rounded-md text-xs font-medium">
                                                    <Calendar className="h-3 w-3" />
                                                    {d}
                                                    <button onClick={() => setDates(dates.filter((x) => x !== d))} className="hover:text-red-900 ml-0.5">
                                                        <X className="h-3 w-3" />
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
                                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-nwu-red hover:file:bg-red-100"
                                    />
                                    {files.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {files.map((f, i) => (
                                                <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg text-sm">
                                                    <span className="flex items-center gap-2 text-gray-700 truncate">
                                                        <FileText className="h-3.5 w-3.5 text-gray-400" />
                                                        {f.name} <span className="text-gray-400">({(f.size / 1024 / 1024).toFixed(1)}MB)</span>
                                                    </span>
                                                    <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
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
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-nwu-red focus:border-nwu-red"
                                    />
                                </div>

                                {/* Messages */}
                                {uploadMessage && (
                                    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${uploadMessage.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                                        {uploadMessage.type === "error" ? <XCircle className="h-4 w-4 shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
                                        {uploadMessage.text}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button onClick={resetForm} className="px-4 py-2.5 border border-gray-300 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm">
                                        <ArrowLeft className="h-4 w-4 inline mr-1" />
                                        Back
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!selectedClass || dates.length === 0 || files.length === 0 || uploading}
                                        className="flex-1 py-2.5 bg-nwu-red text-white font-bold rounded-lg hover:bg-[#5e0d0e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm"
                                    >
                                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                        Submit Excuse Letter
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Success */}
                    {step === "success" && (
                        <div className="bg-white rounded-xl shadow-xl border-t-4 border-green-500 p-8 text-center space-y-6">
                            <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-extrabold text-gray-900">Submitted Successfully!</h2>
                                <p className="mt-2 text-sm text-gray-500">
                                    Your excuse letter has been submitted for review.<br />
                                    Your instructor will be notified and can approve or reject the submission.
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                                <p className="text-gray-600">Documents submitted: <strong className="text-gray-900">{files.length}</strong></p>
                                <p className="text-gray-600">Remaining uploads: <strong className="text-gray-900">{uploadsRemaining}</strong></p>
                            </div>
                            <div className="flex gap-3 justify-center">
                                <button onClick={resetForm} className="px-5 py-2.5 bg-nwu-red text-white font-bold rounded-lg hover:bg-[#5e0d0e] transition-colors text-sm">
                                    Submit Another
                                </button>
                                <a href="/login" className="px-5 py-2.5 border border-gray-300 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm">
                                    Back to Login
                                </a>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Footer */}
            <footer className="py-4 text-center text-xs text-gray-400">
                &copy; {new Date().getFullYear()} Northwestern University Attendance System. All rights reserved.
            </footer>
        </div>
    );
}
