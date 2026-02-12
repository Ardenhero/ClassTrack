"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Upload, FileText, Calendar, Loader2, CheckCircle, XCircle, Clock, Plus, X } from "lucide-react";

interface EvidenceDoc {
    id: string;
    file_name: string;
    file_url: string;
    description: string | null;
    status: string;
    created_at: string;
    evidence_date_links: { absence_date: string }[];
}

interface StudentOption {
    id: number;
    name: string;
    sin: string;
}

export default function EvidencePage() {
    const supabase = createClient();
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [selectedStudent, setSelectedStudent] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [dates, setDates] = useState<string[]>([]);
    const [currentDate, setCurrentDate] = useState("");
    const [description, setDescription] = useState("");
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [history, setHistory] = useState<EvidenceDoc[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        async function loadStudents() {
            const { data } = await supabase
                .from("students")
                .select("id, name, sin")
                .order("name");
            if (data) setStudents(data);
        }
        loadStudents();
    }, [supabase]);

    const loadHistory = async (studentId: string) => {
        if (!studentId) return;
        setLoadingHistory(true);
        const { data } = await supabase
            .from("evidence_documents")
            .select("id, file_name, file_url, description, status, created_at, evidence_date_links(absence_date)")
            .eq("student_id", parseInt(studentId))
            .order("created_at", { ascending: false });
        if (data) setHistory(data as unknown as EvidenceDoc[]);
        setLoadingHistory(false);
    };

    useEffect(() => {
        if (selectedStudent) loadHistory(selectedStudent);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStudent]);

    const addDate = () => {
        if (currentDate && !dates.includes(currentDate)) {
            setDates([...dates, currentDate]);
            setCurrentDate("");
        }
    };

    const removeDate = (d: string) => {
        setDates(dates.filter((x) => x !== d));
    };

    const handleUpload = async () => {
        if (!file || !selectedStudent || dates.length === 0) return;
        setUploading(true);
        setMessage(null);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("student_id", selectedStudent);
        formData.append("dates", JSON.stringify(dates));
        if (description) formData.append("description", description);

        try {
            const res = await fetch("/api/evidence/upload", { method: "POST", body: formData });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: `Evidence uploaded and linked to ${data.dates_linked} date(s).` });
                setFile(null);
                setDates([]);
                setDescription("");
                loadHistory(selectedStudent);
            } else {
                setMessage({ type: "error", text: data.error });
            }
        } catch {
            setMessage({ type: "error", text: "Upload failed" });
        } finally {
            setUploading(false);
        }
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case "approved":
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3" />Approved</span>;
            case "rejected":
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><XCircle className="h-3 w-3" />Rejected</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"><Clock className="h-3 w-3" />Pending</span>;
        }
    };

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="h-7 w-7 text-nwu-red" />
                    Evidence Portal
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Upload medical certificates or excuse letters for absence justification</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upload Card */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-5 text-white">
                        <div className="flex items-center gap-3">
                            <Upload className="h-6 w-6" />
                            <h2 className="text-lg font-bold">Upload Evidence</h2>
                        </div>
                    </div>
                    <div className="p-5 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Student</label>
                            <select
                                value={selectedStudent}
                                onChange={(e) => setSelectedStudent(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                            >
                                <option value="">Select student...</option>
                                {students.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.sin})</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">File (JPG/PNG/PDF, max 5MB)</label>
                            <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Link Absence Dates</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={currentDate}
                                    onChange={(e) => setCurrentDate(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                                />
                                <button
                                    onClick={addDate}
                                    disabled={!currentDate}
                                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                            {dates.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {dates.map((d) => (
                                        <span key={d} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md text-xs font-medium">
                                            <Calendar className="h-3 w-3" />
                                            {d}
                                            <button onClick={() => removeDate(d)} className="hover:text-red-500 ml-1"><X className="h-3 w-3" /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Description (optional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                placeholder="e.g. Medical certificate for flu"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm resize-none"
                            />
                        </div>

                        {message && (
                            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                                {message.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                                {message.text}
                            </div>
                        )}

                        <button
                            onClick={handleUpload}
                            disabled={!file || !selectedStudent || dates.length === 0 || uploading}
                            className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Upload & Submit
                        </button>
                    </div>
                </div>

                {/* Submission History */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-600 to-gray-700 p-5 text-white">
                        <h2 className="text-lg font-bold">Submission History</h2>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {loadingHistory ? (
                            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
                        ) : history.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                {selectedStudent ? "No evidence submitted yet" : "Select a student to view history"}
                            </div>
                        ) : (
                            history.map((doc) => (
                                <div key={doc.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate">
                                                    {doc.file_name}
                                                </a>
                                                {statusBadge(doc.status)}
                                            </div>
                                            {doc.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{doc.description}</p>}
                                            <div className="flex flex-wrap gap-1">
                                                {doc.evidence_date_links?.map((l) => (
                                                    <span key={l.absence_date} className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                                                        {l.absence_date}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-400 shrink-0">
                                            {new Date(doc.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
