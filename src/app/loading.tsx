export default function Loading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="flex flex-col items-center">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-nwu-red border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">
                    Loading Attendance System...
                </p>
            </div>
        </div>
    );
}
