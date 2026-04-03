import { createClient } from "@/utils/supabase/server";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { AuditLogsTable } from "./AuditLogsTable";

export default async function AuditLogsList({
    searchParams,
}: {
    searchParams?: {
        actor?: string;
        action?: string;
        offset?: string;
    };
}) {
    const supabase = createClient();
    const limit = 20;
    const offset = parseInt(searchParams?.offset || "0");
    
    // Use standard cookies import
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    const { data: profile } = await supabase
        .from('instructors')
        .select('is_super_admin')
        .eq('id', profileId)
        .maybeSingle();

    const isSuperAdmin = profile?.is_super_admin || false;

    let query = supabase
        .from("audit_logs")
        .select(`
            *,
            actor:instructors(name)
        `)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (searchParams?.actor) {
        query = query.eq("actor_id", searchParams.actor);
    }
    if (searchParams?.action) {
        query = query.ilike("action", `%${searchParams.action}%`);
    }

    const { data: logs } = await query;

    // Fetch name maps for resolving IDs in details (Historical data fix)
    const { data: depts } = await supabase.from('departments').select('id, name');
    const { data: instructors } = await supabase.from('instructors').select('id, auth_user_id, name');

    const idToNameMap: Record<string, string> = {};
    depts?.forEach(d => idToNameMap[d.id] = d.name);
    instructors?.forEach(i => {
        idToNameMap[i.id] = i.name;
        if (i.auth_user_id) idToNameMap[i.auth_user_id] = i.name;
    });

    // ── EXTRA PASS: Resolve names of DELETED entities ──
    // For accounts that were deleted, we search the logs themselves for provision/archive names
    const targetIds = logs?.map(l => l.target_id).filter(id => id && !idToNameMap[id]) as string[];
    
    if (targetIds && targetIds.length > 0) {
        // Query the logs for any previous provision/archive actions for these specific IDs
        const { data: pastLogs } = await supabase
            .from('audit_logs')
            .select('target_id, details')
            .in('target_id', targetIds)
            .or('action.eq.PROVISION_ADMIN,action.eq.student_archived,action.eq.class_archived');

        pastLogs?.forEach(pl => {
            if (!pl.target_id) return;
            const details = pl.details as any;
            const name = details?.name || details?.admin_name || details?.student_name;
            if (name && !idToNameMap[pl.target_id]) {
                idToNameMap[pl.target_id] = name;
            }
        });
    }

    return (
        <div className="space-y-4">
            <AuditLogsTable 
                logs={logs as any} 
                isSuperAdmin={isSuperAdmin} 
                idToNameMap={idToNameMap}
            />

            {/* Link-based Pagination (Performance Optimized) */}
            {logs && logs.length === limit && (
                <div className="flex justify-center pt-4">
                    <Link
                        href={`/dashboard/admin/audit-logs?offset=${offset + limit}${searchParams?.action ? `&action=${searchParams.action}` : ""}`}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-gray-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-black dark:hover:bg-gray-600 transition-all shadow-lg active:scale-95"
                    >
                        Load More Entries
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>
            )}
        </div>
    );
}
