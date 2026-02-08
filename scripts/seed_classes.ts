import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seedClasses() {
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const instructor = users[0]; // Use first user

    if (!instructor) {
        console.error('No users found. Login first.');
        process.exit(1);
    }

    // Calculate times
    const now = new Date();

    // 1. Future Class (in 1 hour)
    const futureDate = new Date(now.getTime() + 60 * 60 * 1000);
    const futureTime = futureDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    // 2. Past Class (1 hour ago)
    const pastDate = new Date(now.getTime() - 60 * 60 * 1000);
    const pastTime = pastDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    console.log(`Seeding Classes for Instructor: ${instructor.id}`);
    console.log(`Future Class Time: ${futureTime}`);
    console.log(`Past Class Time: ${pastTime}`);

    const classes = [
        {
            user_id: instructor.id,
            name: 'QA Future Class',
            room: 'Room 101',
            schedule: 'Mon/Tue/Wed/Thu/Fri/Sat/Sun', // Every day to ensure it hits today
            time: futureTime,
            section: 'QA-1',
            academic_year: '2025-2026'
        },
        {
            user_id: instructor.id,
            name: 'QA Past Class',
            room: 'Room 102',
            schedule: 'Mon/Tue/Wed/Thu/Fri/Sat/Sun',
            time: pastTime,
            section: 'QA-2',
            academic_year: '2025-2026'
        }
    ];

    const { error } = await supabase.from('classes').insert(classes);
    if (error) console.error(error);
    else console.log('Classes seeded successfully.');
}

seedClasses();
