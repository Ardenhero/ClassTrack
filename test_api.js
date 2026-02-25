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

  // Test valid UUID that doesn't exist
  const dummyUUID = '00000000-0000-0000-0000-000000000000';
  const { data: classRef, error: classRefError } = await supabase
    .from('classes')
    .select('id, instructor_id, start_time, end_time')
    .eq('id', dummyUUID)
    .single();

  console.log("Missing UUID result:", classRef ? "found" : "null", "Error:", classRefError);

  // Test empty UUID string
  const emptyUUID = '';
  const { data: c2, error: e2 } = await supabase
    .from('classes')
    .select('id, instructor_id, start_time, end_time')
    .eq('id', emptyUUID)
    .single();

  console.log("Empty string result:", c2 ? "found" : "null", "Error:", e2);

  // Test null
  const nullUUID = null;
  const { data: c3, error: e3 } = await supabase
    .from('classes')
    .select('id, instructor_id, start_time, end_time')
    .eq('id', nullUUID)
    .single();

  console.log("Null result:", c3 ? "found" : "null", "Error:", e3);
}

test().catch(console.error);
