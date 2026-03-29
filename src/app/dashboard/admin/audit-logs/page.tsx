import { ShieldAlert, Filter } from "lucide-react";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/ui/Skeleton";
import AuditLogsList from "./AuditLogsList";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage({
    searchParams,
}: {
    searchParams?: {
        actor?: string;
        action?: string;
    };
}) {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                        <ShieldAlert className="mr-2 h-6 w-6 text-nwu-red" aria-hidden="true" />
                        Master Audit Trail
                    </h1>
                    <p className="text-sm text-gray-500">Forensic log of all administrative actions</p>
                </div>
            </div>

            {/* Forensic Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-center transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:hover:shadow-[0_4px_20px_rgb(255,255,255,0.05)]">
                <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest mr-2">
                    <Filter className="h-3 w-3 mr-1" aria-hidden="true" /> Filters
                </div>
                <form className="flex gap-4">
                    <div className="relative">
                        <input
                            id="action-search"
                            name="action"
                            placeholder="Search action (e.g. DELETE)..."
                            defaultValue={searchParams?.action}
                            className="px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-nwu-red/20 outline-none w-full sm:w-64"
                            aria-label="Search action type"
                        />
                    </div>
                    <button type="submit" className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-all">
                        Apply Filters
                    </button>
                </form>
            </div>

            {/* Audit Table with Suspense */}
            <Suspense fallback={<TableSkeleton rows={10} cols={5} />}>
                <AuditLogsList searchParams={searchParams} />
            </Suspense>
        </div>
    );
}
