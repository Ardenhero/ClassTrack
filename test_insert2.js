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
  
  // 1. Get a class
  const classIdInput = '934e985f-248e-48cb-af43-987c0a188e4e'; // Using the one from previous test
  const { data: classRef, error: classRefError } = await supabase
      .from('classes')
      .select('id, instructor_id, start_time, end_time, instructors!classes_instructor_id_fkey(user_id)')
      .eq('id', classIdInput)
      .single();
      
  console.log("classRef details:", JSON.stringify(classRef, null, 2));
  
  const targetOwnerId = Array.isArray(classRef.instructors)
      ? classRef.instructors[0]?.user_id
      : (classRef.instructors?.user_id || classRef.instructor_id);
      
  console.log("Resolved targetOwnerId:", targetOwnerId);
}

test().catch(console.error);
