import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
    const supabase = createClient();
    const start = Date.now();
    let dbStatus = "unknown";

    try {
        const { error } = await supabase.from('students').select('id').limit(1);
        if (error) throw error;
        dbStatus = "healthy";
    } catch (e) {
        dbStatus = "unhealthy";
        console.error("Health Check DB Error:", e);
    }

    const duration = Date.now() - start;

    if (dbStatus === "unhealthy") {
        return NextResponse.json(
            { status: "unhealthy", database: dbStatus, latency: duration },
            { status: 503 }
        );
    }

    return NextResponse.json(
        {
            status: "healthy",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: dbStatus,
            latency: `${duration}ms`,
            env: process.env.NODE_ENV
        },
        { status: 200 }
    );
}
