require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function resetStudent() {
    console.log("Resetting student 135 (Arden Hero Damaso)...");

    // 1. Update students table
    const { error: err1 } = await supabase
        .from('students')
        .update({ fingerprint_slot_id: null, device_id: null })
        .eq('id', 135);

    if (err1) console.error("Error updating students:", err1);
    else console.log("Student record reset.");

    // 2. Delete from fingerprint_slots for the old device
    const { error: err2 } = await supabase
        .from('fingerprint_slots')
        .delete()
        .eq('student_id', 135);

    if (err2) console.error("Error deleting from fingerprint_slots:", err2);
    else console.log("Deleted old fingerprint_slots entries.");

    // 3. Delete from fingerprint_device_links
    const { error: err3 } = await supabase
        .from('fingerprint_device_links')
        .delete()
        .eq('student_id', 135);

    if (err3) console.error("Error deleting links:", err3);
    else console.log("Deleted old device links.");
}

resetStudent();
