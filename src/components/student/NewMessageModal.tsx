"use client";

import { useState } from "react";
import { 
    MessageSquare, 
    Megaphone, 
    ChevronRight, 
    ArrowRight,
    Sparkles
} from "lucide-react";
import { markNotificationAsRead } from "@/app/student/portal/actions";

interface Notification {
    id: string;
    type: 'no_class' | 'low_attendance' | 'info' | 'message';
    title: string;
    message: string;
    created_at: string;
    read: boolean;
}

interface NewMessageModalProps {
    notifications: Notification[];
    onClose: () => void;
}

export function NewMessageModal({ notifications, onClose }: NewMessageModalProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    
    const unreadMessages = notifications.filter(n => !n.read && (n.type === 'message' || n.type === 'no_class'));
    
    // Safety check: if no messages, or index out of bounds, don't render
    if (unreadMessages.length === 0 || !unreadMessages[currentIndex]) return null;
    
    const currentMsg = unreadMessages[currentIndex];

    const handleNext = async () => {
        if (!currentMsg) return;

        // Mark as read in background
        await markNotificationAsRead(currentMsg.id);
        
        if (currentIndex < unreadMessages.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            handleClose();
        }
    };

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            onClose();
        }, 300);
    };

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-md transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
            <div className={`bg-white dark:bg-gray-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 dark:border-gray-800 transition-all duration-500 transform ${isExiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
                {/* Visual Header */}
                <div className="relative h-32 bg-gradient-to-br from-nwu-red to-red-900 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-10 left-10 h-20 w-20 rounded-full bg-white blur-2xl animate-pulse" />
                        <div className="absolute bottom-10 right-10 h-32 w-32 rounded-full bg-white blur-3xl animate-pulse delay-700" />
                    </div>
                    <div className="relative z-10 h-20 w-20 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center border border-white/20 rotate-6 shadow-2xl">
                        {currentMsg?.type === 'no_class' ? (
                            <Megaphone className="h-10 w-10 text-white" />
                        ) : (
                            <MessageSquare className="h-10 w-10 text-white" />
                        )}
                    </div>
                    <div className="absolute top-4 right-4 text-white/50 text-[10px] font-black uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full">
                        New Alert {currentIndex + 1} of {unreadMessages.length}
                    </div>
                </div>

                <div className="p-10 space-y-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-nwu-red font-black text-[10px] uppercase tracking-[0.2em]">
                            <Sparkles className="h-3 w-3" />
                            Priority Announcement
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white leading-tight">
                            {currentMsg.title}
                        </h2>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700">
                        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed font-medium">
                            {currentMsg.message}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                            onClick={handleNext}
                            className="flex-1 bg-nwu-red hover:bg-[#801012] text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-red-200 dark:shadow-none"
                        >
                            {currentIndex < unreadMessages.length - 1 ? (
                                <>
                                    Next Message <ChevronRight className="h-4 w-4" />
                                </>
                            ) : (
                                <>
                                    Got it, thanks! <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
