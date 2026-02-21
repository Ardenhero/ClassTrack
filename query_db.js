const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('kiosk_devices').select('device_serial, room_id, rooms(name)').then(({data, error}) => {
    console.log(data, error);
});
