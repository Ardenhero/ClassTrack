const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log("Starting Migration from KIOSK-STC102 to KIOSK-1020BA727EF4...");

    // 1. Move students.device_id
    const { error: err1 } = await supabase
        .from('students')
        .update({ device_id: 'KIOSK-1020BA727EF4' })
        .eq('device_id', 'KIOSK-STC102');
    if (err1) console.error("Error updating students:", err1);
    else console.log("Migrated students.");

    // 2. Move instructors.activator_device_serial
    const { error: err2 } = await supabase
        .from('instructors')
        .update({ activator_device_serial: 'KIOSK-1020BA727EF4' })
        .eq('activator_device_serial', 'KIOSK-STC102');
    if (err2) console.error("Error updating instructors:", err2);
    else console.log("Migrated instructors.");

    // 3. Move fingerprint_device_links
    const { error: err3 } = await supabase
        .from('fingerprint_device_links')
        .update({ device_serial: 'KIOSK-1020BA727EF4' })
        .eq('device_serial', 'KIOSK-STC102');
    if (err3) console.error("Error updating links:", err3);
    else console.log("Migrated fingerprint links.");

    // 4. Update the new KIOSK-1020BA727EF4 to be approved and bind to Room
    const { data: oldKiosk } = await supabase
        .from('kiosk_devices')
        .select('*')
        .eq('device_serial', 'KIOSK-STC102')
        .single();

    if (oldKiosk) {
        const { error: err4 } = await supabase
            .from('kiosk_devices')
            .update({
                status: 'approved',
                room_id: oldKiosk.room_id,
                label: oldKiosk.label,
                assigned_admin_id: oldKiosk.assigned_admin_id,
                approved_at: new Date().toISOString()
            })
            .eq('device_serial', 'KIOSK-1020BA727EF4');
        if (err4) console.error("Error approving new kiosk:", err4);
        else console.log("Approved and inherited room mapping to KIOSK-1020BA727EF4.");

        // Delete the old KIOSK-STC102
        await supabase.from('kiosk_devices').delete().eq('device_serial', 'KIOSK-STC102');
        console.log("Deleted old KIOSK-STC102 entity.");
    }

    console.log("Migration Complete!");
}

migrate();
