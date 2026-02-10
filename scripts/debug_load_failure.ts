
import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (q: string) => new Promise<string>(r => rl.question(q, r));

async function main() {
    console.log("🔍 DIAGNOSTIC: Debugging 'Failed to Load Students' Error");

    // 1. Get Credentials
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.log("⚠️  Credentials not in env. Please enter them:");
        url = (await ask('Supabase URL: ')).trim();
        key = (await ask('Supabase Anon Key: ')).trim();
    }

    if (!url || !key) {
        console.error("❌ Missing credentials");
        process.exit(1);
    }

    const supabase = createClient(url, key);

    // 2. Fetch a valid Instructor ID to test with
    console.log("\n1️⃣  Fetching an Instructor ID...");
    const { data: instructors, error: instError } = await supabase
        .from('instructors')
        .select('id, name')
        .limit(1);

    if (instError) {
        console.error("❌ Failed to fetch instructors:", instError);
        process.exit(1);
    }

    if (!instructors || instructors.length === 0) {
        console.error("❌ No instructors found. Can't test RPC.");
    } else {
        const instructor = instructors[0];
        console.log(`✅ Found Instructor: ${instructor.name} (${instructor.id})`);

        // 3. Test RPC: get_my_students
        console.log("\n2️⃣  Testing RPC 'get_my_students'...");
        const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_my_students', {
                p_instructor_id: instructor.id,
                p_search_query: ''
            });

        if (rpcError) {
            console.error("❌ RPC FAILED!");
            console.error(JSON.stringify(rpcError, null, 2));
        } else {
            console.log(`✅ RPC Success! Returned ${rpcData.length} students.`);
            if (rpcData.length > 0) {
                console.log("Sample Data:", rpcData[0]);
            }
        }
    }

    // 4. Test Direct Select (Admin Path)
    console.log("\n3️⃣  Testing Direct Select (Admin Path)...");
    const { data: selectData, error: selectError } = await supabase
        .from('students')
        .select('id, name, sin, year_level')
        .limit(5);

    if (selectError) {
        console.error("❌ Direct Select FAILED!");
        console.error(JSON.stringify(selectError, null, 2));
    } else {
        console.log(`✅ Direct Select Success! Returned ${selectData?.length} students.`);
    }

    rl.close();
}

main();
