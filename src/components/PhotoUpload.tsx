"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Loader2, X, User, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useProfile } from "@/context/ProfileContext";
import { uploadPhotoAction, deletePhotoAction } from "@/app/settings/actions";

interface PhotoUploadProps {
    currentImageUrl?: string | null;
    onUploadComplete?: (newUrl: string) => void;
    onDelete?: () => void;
    uploadPath: string; // e.g., 'students/id.jpg' or 'instructors/id.jpg'
    tableName: 'students' | 'instructors';
    recordId: string;
    size?: "sm" | "md" | "lg";
    readOnly?: boolean;
    hideInstructions?: boolean;
}

export function PhotoUpload({
    currentImageUrl,
    onUploadComplete,
    onDelete,
    uploadPath,
    tableName,
    recordId,
    size = "md",
    readOnly = false,
    hideInstructions = false
}: PhotoUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
    const [showConfirm, setShowConfirm] = useState<{ type: 'upload' | 'delete', file?: File } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { refreshProfile } = useProfile();
    const router = useRouter();

    const [showPhotoMenu, setShowPhotoMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setPreviewUrl(currentImageUrl || null);
    }, [currentImageUrl]);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowPhotoMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const sizeClasses = {
        sm: "h-12 w-12 text-xs",
        md: "h-20 w-20 text-sm",
        lg: "h-32 w-32 text-lg"
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            alert('File size must be less than 2MB.');
            return;
        }

        if (previewUrl) {
            setShowConfirm({ type: 'upload', file });
        } else {
            executeUpload(file);
        }
    };

    const executeUpload = async (file: File) => {
        try {
            setUploading(true);
            setShowConfirm(null);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('uploadPath', uploadPath);
            formData.append('tableName', tableName);
            formData.append('recordId', recordId);

            const result = await uploadPhotoAction(formData);

            if (result.error) throw new Error(result.error);

            const publicUrl = result.publicUrl!;
            setPreviewUrl(publicUrl);
            if (onUploadComplete) onUploadComplete(publicUrl);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await refreshProfile();
            router.refresh();
        } catch (error) {
            console.error('Error uploading photo:', error);
            alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const executeDelete = async () => {
        try {
            setUploading(true);
            setShowConfirm(null);

            const result = await deletePhotoAction(tableName, recordId);

            if (result.error) throw new Error(result.error);

            setPreviewUrl(null);
            if (onDelete) onDelete();
            if (onUploadComplete) onUploadComplete("");
            await refreshProfile();
            router.refresh();
        } catch (error) {
            console.error('Error removing photo:', error);
            alert(`Failed to remove photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col items-center">
            <div className="relative group">
            <div className={`${sizeClasses[size]} rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative shadow-sm ${!previewUrl ? "border-2 border-dashed border-gray-300 dark:border-gray-700" : ""}`}>
                {previewUrl ? (
                    <Image
                        src={previewUrl}
                        alt="Profile"
                        fill
                        className="object-cover"
                    />
                ) : (
                    <div className="text-gray-400 flex flex-col items-center">
                        <User className={size === 'lg' ? "h-12 w-12" : "h-6 w-6"} />
                        {size === 'lg' && <span className="mt-2 font-medium">{readOnly ? "No Photo" : "Add Photo"}</span>}
                    </div>
                )}

                {/* Loading Overlay */}
                {uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 backdrop-blur-[2px]">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                )}

                {/* Success Overlay */}
                {success && !uploading && (
                    <div className="absolute inset-0 bg-green-500/40 flex flex-col items-center justify-center z-10 animate-in fade-in duration-300">
                        <div className="bg-white rounded-full p-1 shadow-lg">
                            <span className="text-green-600 font-bold block">✓</span>
                        </div>
                        <span className="text-white text-[10px] font-bold mt-1">SAVED</span>
                    </div>
                )}

                {/* Hover Action Overlay */}
                {!uploading && !readOnly && (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center cursor-pointer transition-all duration-200"
                    >
                        <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                )}
            </div>

                {/* Action Button (Pencil) */}
                {!uploading && !readOnly && (
                    <div className="absolute -bottom-2 -right-2 z-30">
                        <button
                            onClick={() => setShowPhotoMenu(!showPhotoMenu)}
                            className="h-9 w-9 bg-nwu-red text-white rounded-full flex items-center justify-center shadow-xl hover:bg-red-700 transition-all active:scale-90 border-2 border-white dark:border-gray-900"
                            title="Edit Photo"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {showPhotoMenu && (
                            <div 
                                ref={menuRef}
                                className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-2 animate-in fade-in slide-in-from-top-2 duration-200"
                            >
                                <button
                                    onClick={() => {
                                        setShowPhotoMenu(false);
                                        fileInputRef.current?.click();
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors"
                                >
                                    <Camera className="h-4 w-4 text-nwu-red" />
                                    Change Photo
                                </button>
                                {previewUrl && (
                                    <button
                                        onClick={() => {
                                            setShowPhotoMenu(false);
                                            setShowConfirm({ type: 'delete' });
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-xs font-bold text-red-600 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Remove Photo
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

            {!readOnly && (
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                />
            )}

            {size === 'lg' && !readOnly && !hideInstructions && (
                <div className="mt-2 text-center">
                    <p className="text-xs text-gray-400">
                        JPG or PNG, max 2MB
                    </p>
                    <p className="text-[10px] text-gray-300 italic mt-1 font-medium italic">
                        Changes are saved automatically
                    </p>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-4 ${showConfirm.type === 'delete' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                            {showConfirm.type === 'delete' ? <X className="h-6 w-6 text-red-500" /> : <Camera className="h-6 w-6 text-blue-500" />}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                            {showConfirm.type === 'delete' ? 'Remove Photo?' : 'Change Photo?'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                            {showConfirm.type === 'delete'
                                ? 'Are you sure you want to remove your profile photo? This action cannot be undone.'
                                : 'You already have a profile photo. Do you want to replace it with the new one?'}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm(null)}
                                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => showConfirm.type === 'delete' ? executeDelete() : executeUpload(showConfirm.file!)}
                                className={`flex-1 px-4 py-2 text-white rounded-xl font-bold transition-all shadow-md active:scale-95 ${showConfirm.type === 'delete' ? 'bg-red-500 hover:bg-red-600 shadow-red-200 dark:shadow-none' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200 dark:shadow-none'}`}
                            >
                                {showConfirm.type === 'delete' ? 'Delete' : 'Replace'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
    );
}
