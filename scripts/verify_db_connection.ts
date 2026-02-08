
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const readline = require('readline');

async function getCredentials() {
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && key) return { url, key };

    console.log("⚠️  Environment variables not found. Running in interactive mode.");
    console.log("    (Credentials will NOT be saved to any file)");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const ask = (q: string) => new Promise<string>(r => rl.question(q, r));

    try {
        if (!url) url = (await ask('Enter NEXT_PUBLIC_SUPABASE_URL: ')).trim();
        if (!key) key = (await ask('Enter NEXT_PUBLIC_SUPABASE_ANON_KEY: ')).trim();
    } finally {
        rl.close();
    }

    return { url, key };
}

async function verify() {
    const creds = await getCredentials();
    if (!creds.url || !creds.key) {
        console.error("❌ Missing Credentials");
        process.exit(1);
    }

    const supabase = createClient(creds.url, creds.key);

    console.log("\n🔍 Verifying ClassTrack Database State...");

    // 1. Check Connection & Students Table (with Admin privileges simulation)
    // Note: ANON key is subject to RLS. If RLS is broken for Anon, this will fail (which is good).
    // But we want to simulate an Authenticated user usually.
    // For now, let's just check if we can query *anything* publicly or if we get a specific RLS error.

    // LOGIN as ADMIN (You'll need to provide credentials or we can just try a public health check if exists)
    // Actually, let's try to fetch instructors to see if we can find the admin profile.
    // RLS usually allows reading own profile, but maybe public read on instructors? 
    // IF NOT, this script might be limited without a service role key.

    // USER REPORTED: "Failed to load students"
    // This implies the specific 'admin-profile' logic or RLS is failing for their user.

    console.log("--> checking students table (as anon)...");
    const { data: students, error: studentError } = await supabase.from('students').select('*').limit(1);

    if (studentError) {
        console.error("❌ Student Query Failed:", studentError.message, studentError.code);
    } else {
        console.log("✅ Student Query Success (Anon):", students?.length);
    }

    // 2. Check RPC "get_student_by_sin_secure" (Should be callable by anon or authenticated)
    console.log("--> checking RPC get_student_by_sin_secure...");
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_student_by_sin_secure', { p_sin: '00-00000' });
    if (rpcError) {
        console.error("❌ RPC Failed:", rpcError.message, rpcError.code);
    } else {
        console.log("✅ RPC Success:", rpcData);
    }

    console.log("Done.");
}

verify();
