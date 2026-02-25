const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function test() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  let url = '';
  let key = '';
  envContent.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
  });
  
  const supabase = createClient(url, key);
  
  // What columns exist in attendance_logs?
  const { data: logs, error: logsErr } = await supabase.from('attendance_logs').select('*').limit(1);
  console.log("attendance_logs columns:", Object.keys(logs[0] || {}));
}

test().catch(console.error);
