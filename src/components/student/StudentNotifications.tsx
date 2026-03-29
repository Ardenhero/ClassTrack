"use client";

import { useEffect, useState } from "react";
import { Bell, Info, CalendarOff, AlertTriangle, MessageSquare, Check } from "lucide-react";
import { getStudentNotifications } from "../../app/student/portal/actions";

interface StudentNotificationsProps {
    studentId: string | number;
    absentCount: number;
}

interface Notification {
    id: string;
    type: 'no_class' | 'low_attendance' | 'info' | 'message';
    title: string;
    message: string;
    created_at: string;
    read: boolean;
}

export function StudentNotifications({ studentId, absentCount }: StudentNotificationsProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchNotifications() {
            const result = await getStudentNotifications();
            setNotifications(result.notifications as Notification[]);
            setLoading(false);
        }
        fetchNotifications();
    }, [studentId]);

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl w-full" />
                <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-3xl w-full" />
            </div>
        );
    }

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="space-y-6">
            {/* Low Attendance Warning */}
            {absentCount >= 3 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl p-6 flex items-start gap-4 animate-in slide-in-from-top-4 duration-500 shadow-lg shadow-amber-100 dark:shadow-none">
                    <div className="h-12 w-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shrink-0">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-amber-900 dark:text-amber-100">Low Attendance Warning</h3>
                        <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                            You have accumulated <span className="font-bold underline">{absentCount} absences</span>. 
                            Please coordinate with your instructors to avoid potential failure due to absences.
                        </p>
                    </div>
                </div>
            )}

            {/* Notifications List */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Bell className="h-5 w-5 text-nwu-red" />
                        Recent Alerts
                        {unreadCount > 0 && (
                            <span className="bg-nwu-red text-white text-[10px] px-2 py-0.5 rounded-full">
                                {unreadCount} NEW
                            </span>
                        )}
                    </h2>
                </div>

                {notifications.length === 0 ? (
                    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-12 text-center">
                        <div className="h-16 w-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="h-8 w-8 text-gray-300" />
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">No new notifications</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1 uppercase tracking-widest font-bold">You&apos;re all caught up!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {notifications.map((n) => (
                            <div 
                                key={n.id}
                                className={`p-5 rounded-3xl border transition-all hover:scale-[1.01] ${
                                    !n.read 
                                    ? "bg-white dark:bg-gray-900 border-nwu-red/20 shadow-xl shadow-red-50 dark:shadow-none" 
                                    : "bg-gray-50/50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800"
                                }`}
                            >
                                <div className="flex gap-4">
                                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                                        n.type === 'no_class' ? "bg-amber-100 text-amber-600" :
                                        n.type === 'message' ? "bg-blue-100 text-blue-600" :
                                        "bg-gray-100 text-gray-600"
                                    }`}>
                                        {n.type === 'no_class' ? <CalendarOff className="h-5 w-5" /> :
                                         n.type === 'message' ? <MessageSquare className="h-5 w-5" /> :
                                         <Info className="h-5 w-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className={`font-bold text-sm truncate ${!n.read ? "text-gray-900 dark:text-white" : "text-gray-500"}`}>
                                                {n.title}
                                            </h4>
                                            <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                                {new Date(n.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className={`text-xs mt-1 leading-relaxed ${!n.read ? "text-gray-600 dark:text-gray-300" : "text-gray-400"}`}>
                                            {n.message}
                                        </p>
                                    </div>
                                    {!n.read && (
                                        <div className="h-2 w-2 rounded-full bg-nwu-red mt-2 shrink-0" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
