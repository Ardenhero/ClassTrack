const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const email = 'testadmin@playwright.test';
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === email);

  if (!user) {
    console.log("No user found!");
    return;
  }

  const { data: authInstructors } = await supabase
    .from('instructors')
    .select('id, name, owner_id, auth_user_id, department_id, is_super_admin')
    .eq('auth_user_id', user.id);

  console.log("By auth_user_id:", authInstructors);

  const { data: ownerInstructors } = await supabase
    .from('instructors')
    .select('id, name, owner_id, auth_user_id, department_id, is_super_admin')
    .eq('owner_id', user.id);

  console.log("By owner_id:", ownerInstructors);

  if (ownerInstructors.length === 0 && authInstructors.length > 0) {
    console.log("Updating owner_id...");
    await supabase.from('instructors').update({ owner_id: user.id }).eq('id', authInstructors[0].id);
    console.log("Updated!");
  } else if (authInstructors.length === 0) {
    console.log("User does not even exist in instructors! We must make one.");
    await supabase.from('instructors').insert([{
      owner_id: user.id,
      auth_user_id: user.id,
      name: 'Test Admin',
      role: 'admin',
      is_super_admin: true
    }]);
    console.log("Super admin created.");
  } else {
    console.log("Looks fine.");
  }
}

main();
