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
  
  // Try to insert an attendance log with null user_id
  const classIdInput = '934e985f-248e-48cb-af43-987c0a188e4e'; 
  const studentInfoId = '18';
  
  const { data, error } = await supabase.from('attendance_logs').insert({
      student_id: studentInfoId,
      class_id: classIdInput,
      user_id: null,
      status: 'Present',
      timestamp: new Date().toISOString(),
      entry_method: 'biometric'
  });
  console.log("Insert with null user_id:", error ? error : "Success!");
}

test().catch(console.error);
