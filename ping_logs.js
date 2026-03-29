require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRecent() {
    console.log("--- Biometric Audit Logs ---");
    const { data: logs, error } = await supabase.from('biometric_audit_logs').select('*').order('timestamp', { ascending: false }).limit(5);
    console.log(logs);
    if (error) console.error(error);
}
checkRecent();
