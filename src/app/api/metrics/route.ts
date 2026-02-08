import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface QueryStats {
    query: string;
    calls: number;
    total_time: number;
    mean_time: number;
    rows: number;
}

interface TableStats {
    table_name: string;
    row_count: number;
    total_size: string;
    index_size: string;
    toast_size: string;
}

export async function GET() {
    const supabase = createClient();
    const start = Date.now();

    const metrics: {
        status: string;
        timestamp: string;
        database: {
            status: string;
            latency: number;
            connections?: number;
            slow_queries?: QueryStats[];
            table_stats?: TableStats[];
            cache_hit_ratio?: number;
        };
        uptime: number;
        environment: string;
    } = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: {
            status: "unknown",
            latency: 0,
        },
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
    };

    try {
        // 1. Basic connectivity check
        const connectStart = Date.now();
        const { error: pingError } = await supabase.from('students').select('id').limit(1);
        metrics.database.latency = Date.now() - connectStart;

        if (pingError) {
            metrics.database.status = "unhealthy";
            metrics.status = "degraded";
        } else {
            metrics.database.status = "healthy";
        }

        // 2. Get connection count (requires pg_stat_activity access)
        try {
            const { data: connData } = await supabase.rpc('get_connection_count');
            if (connData) {
                metrics.database.connections = connData;
            }
        } catch {
            // RPC might not exist, that's okay
        }

        // 3. Get table statistics
        try {
            const { data: tableData } = await supabase.rpc('get_table_stats');
            if (tableData) {
                metrics.database.table_stats = tableData;
            }
        } catch {
            // RPC might not exist
        }

        // 4. Cache hit ratio (indicates how well indexes are working)
        try {
            const { data: cacheData } = await supabase.rpc('get_cache_hit_ratio');
            if (cacheData) {
                metrics.database.cache_hit_ratio = parseFloat(cacheData);
            }
        } catch {
            // RPC might not exist
        }

    } catch (error) {
        console.error("Metrics collection error:", error);
        metrics.status = "unhealthy";
        metrics.database.status = "error";
    }

    const totalTime = Date.now() - start;

    // Determine HTTP status based on health
    const httpStatus = metrics.status === "healthy" ? 200 :
        metrics.status === "degraded" ? 200 : 503;

    return NextResponse.json({
        ...metrics,
        collection_time_ms: totalTime,
    }, {
        status: httpStatus,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
    });
}
