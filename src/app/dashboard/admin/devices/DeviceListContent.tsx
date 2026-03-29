import { createAdminClient } from "@/utils/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/auth-utils";
import { DeviceTableClient } from "./DeviceTableClient";

export default async function DeviceListContent({
    instructor,
}: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instructor: any;
}) {
    const adminSupabase = createAdminClient();

    // 3. Define the query based on Role, using ADMIN client to bypass RLS
    // Devices are now Global, so we fetch all devices regardless of department.
    const query = adminSupabase
        .from("iot_devices")
        .select(`*, rooms(name)`)
        .order("name");

    const isGlobalSuperAdmin = await checkIsSuperAdmin();
    const isSuperAdmin = isGlobalSuperAdmin || instructor?.is_super_admin;
    
    // RULE: Super Admins see EVERYTHING. 
    // Regular Admins see devices as well (Global access as requested).
    
    // Execute the query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: devices } = await query as { data: any[] | null, error: any };

    // Fetch all rooms for the virtual group manager
    const { data: rooms } = await adminSupabase.from("rooms").select("id, name").order("name");

    return (
        <DeviceTableClient
            initialDevices={devices || []}
            rooms={rooms || []}
            isSuperAdmin={Boolean(isSuperAdmin)}
        />
    );
}
