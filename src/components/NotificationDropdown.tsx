"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, Info, AlertTriangle, CheckCircle, Clock, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { markAllAsRead, deleteNotification } from "@/app/notifications/actions";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";

export type NotificationType = "info" | "warning" | "success" | "neutral" | "error";

export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    created_at: string;
    type: NotificationType;
    read: boolean;
}

interface NotificationDropdownProps {
    notifications?: NotificationItem[];
}

export function NotificationDropdown({ notifications: initialNotifications = [] }: NotificationDropdownProps) {
    const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { profile } = useProfile();

    // Sync props to state if they change (e.g. revalidation from other sources)
    useEffect(() => {
        setNotifications(initialNotifications);
    }, [initialNotifications]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Live polling: fetch new notifications every 10 seconds
    const pollNotifications = useCallback(async () => {
        if (!profile?.id) return;
        const supabase = createClient();
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('instructor_id', profile.id)
            .gte('created_at', oneDayAgo)
            .order('created_at', { ascending: false })
            .limit(20);

        if (data && data.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setNotifications(data.map((n: any) => ({
                ...n,
                timestamp: n.created_at
            })));
        }
    }, [profile?.id]);

    useEffect(() => {
        const interval = setInterval(pollNotifications, 10000);
        return () => clearInterval(interval);
    }, [pollNotifications]);

    const handleMarkAllRead = async () => {
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        await markAllAsRead();
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        // Optimistic update
        setNotifications(prev => prev.filter(n => n.id !== id));
        await deleteNotification(id);
    };

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case "warning": return AlertTriangle;
            case "success": return CheckCircle;
            case "info": return Info;
            default: return Clock;
        }
    };

    const getColor = (type: NotificationType) => {
        switch (type) {
            case "warning": return "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400";
            case "success": return "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400";
            case "info": return "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
            default: return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
        }
    };

    // Filter unread for badge count
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm text-gray-500 dark:text-gray-400 hover:text-nwu-red transition-colors relative"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-5 w-5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 text-[9px] text-white font-bold flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100">Notifications</h3>
                        {unreadCount > 0 && (
                            <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{unreadCount} New</span>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                                No new notifications
                            </div>
                        ) : (
                            notifications.map((notif) => {
                                const Icon = getIcon(notif.type);
                                return (
                                    <div key={notif.id} className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-start space-x-4 border-b border-gray-50 dark:border-gray-800/50 last:border-none group ${!notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${getColor(notif.type)}`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{notif.title}</p>
                                                <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.message}</p>
                                        </div>
                                        <button
                                            onClick={(e) => handleDelete(e, notif.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="p-3 text-center border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                        <button
                            onClick={handleMarkAllRead}
                            className="text-xs font-semibold text-nwu-red hover:text-red-700 transition-colors"
                        >
                            Mark all as read
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
