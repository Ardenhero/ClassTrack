
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1]] = match[2].trim();
    }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedStudents() {
    const students = [];
    const yearLevel = "4th Year";

    // Generate 50 students
    for (let i = 1; i <= 50; i++) {
        // Start Fingerprint IDs from 2000 to avoid conflicts with existing ones
        const fingerprintId = 2000 + i;

        // Generate SIN like 22-00001, 22-00002, etc.
        const sin = `22-${String(i).padStart(5, '0')}`;

        students.push({
            name: `Student ${i}`,
            year_level: yearLevel,
            fingerprint_id: fingerprintId,
            sin: sin
        });
    }

    console.log(`Preparing to insert ${students.length} students...`);

    const { data, error } = await supabase
        .from('students')
        .insert(students)
        .select();

    if (error) {
        console.error("Error inserting students:", error);
    } else {
        console.log(`Successfully added ${data.length} students!`);
    }
}

seedStudents();
