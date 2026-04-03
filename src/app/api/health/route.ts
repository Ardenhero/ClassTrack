import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Standard Production Health Check
 * Monitors:
 * 1. API Connectivity
 * 2. Database (Supabase) Connectivity
 * 3. Environment Variable Integrity
 */
export async function GET() {
    const startTime = Date.now();
    const supabase = createClient();
    
    try {
        // 1. Check Database
        const { error: dbError } = await supabase.from('departments').select('id').limit(1);
        if (dbError) throw new Error(`Database check failed: ${dbError.message}`);
        
        // 2. Check Essential Secrets
        const essentials = [
            'NEXT_PUBLIC_SUPABASE_URL',
            'SUPABASE_SERVICE_ROLE_KEY',
            'IOT_SIGNING_SECRET',
            'GOOGLE_GENERATIVE_AI_API_KEY'
        ];
        
        const missing = essentials.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            return NextResponse.json({
                status: 'degraded',
                uptime: `${process.uptime()}s`,
                error: `Missing configuration: ${missing.join(', ')}`,
                latency: `${Date.now() - startTime}ms`
            }, { status: 503 });
        }

        return NextResponse.json({
            status: 'healthy',
            uptime: `${process.uptime()}s`,
            database: 'connected',
            version: '1.0.0-hardened',
            latency: `${Date.now() - startTime}ms`,
            timestamp: new Date().toISOString()
        });

    } catch (err: unknown) {
        console.error("[HEALTH CHECK] Failure:", err);
        return NextResponse.json({
            status: 'unhealthy',
            error: err instanceof Error ? err.message : String(err),
            latency: `${Date.now() - startTime}ms`
        }, { status: 500 });
    }
}
