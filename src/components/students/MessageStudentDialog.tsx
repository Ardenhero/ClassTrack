"use client";

import { useState } from "react";
import { MessageSquare, Send, Loader2, X, CheckCircle2 } from "lucide-react";
import { sendStudentMessage } from "../../app/notifications/actions";
import { useProfile } from "@/context/ProfileContext";

interface MessageStudentDialogProps {
    isOpen: boolean;
    onClose: () => void;
    studentId: string | number;
    studentName: string;
}

export function MessageStudentDialog({ isOpen, onClose, studentId, studentName }: MessageStudentDialogProps) {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const { profile } = useProfile();

    if (!isOpen) return null;

    const handleSend = async () => {
        if (!message.trim()) return;

        setLoading(true);
        try {
            const result = await sendStudentMessage({
                studentId,
                message,
                instructorName: profile?.name || "Instructor"
            });

            if (result.error) {
                alert(result.error);
            } else {
                setSuccess(true);
                setMessage("");
                setTimeout(() => {
                    onClose();
                    setSuccess(false);
                }, 2000);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                {success ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
                        <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-500">
                            <CheckCircle2 className="h-12 w-12" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">Message Sent!</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">The student will see your alert in their portal.</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="px-6 py-5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/40 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center text-white">
                                    <MessageSquare className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Message Student</h3>
                                    <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">To: {studentName}</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-full transition-colors font-bold text-blue-900 dark:text-amber-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Your Message</label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type your message here... (e.g., 'Please see me after class' or 'Submission received')"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-[120px] resize-none"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-4 px-4 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={loading || !message.trim()}
                                    className="flex-[2] py-4 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-200 dark:shadow-none"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                    {loading ? "Sending..." : "Send Notification"}
                                </button>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 text-[10px] text-center text-gray-400 font-medium">
                            This message will appear in the student&apos;s portal notifications.
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
