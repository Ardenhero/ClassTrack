import { createClient } from "../../../../utils/supabase/server";
import { getProfile } from "@/lib/auth-utils";
import RoomsClient from "./RoomsClient";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/ui/Skeleton";

export default async function RoomsManagementPage() {
    const supabase = createClient();
    const profile = await getProfile();

    if (!profile || (profile.role !== "admin" && !profile.is_super_admin)) {
        redirect("/dashboard");
    }

    // const isAdmin = profile?.role === "admin" || profile?.is_super_admin;
    const canManageRooms = profile?.is_super_admin;

    // Fetch initial data on the server
    const isSuperAdminUser = profile?.is_super_admin;
    const assignedRoomIds = profile?.assigned_room_ids as string[] | null;

    let roomsQuery = supabase
        .from("rooms")
        .select("*")
        .order("name");

    if (!isSuperAdminUser && assignedRoomIds) {
        roomsQuery = roomsQuery.in("id", assignedRoomIds);
    } else if (!isSuperAdminUser && !assignedRoomIds) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <p className="text-gray-500 dark:text-gray-400">No rooms assigned to your account.</p>
            </div>
        );
    }

    const { data: roomsData } = await roomsQuery;

    let devicesQuery = supabase
        .from("iot_devices")
        .select("id, name, type, room_id, online")
        .order("name");

    if (!isSuperAdminUser && assignedRoomIds) {
        devicesQuery = devicesQuery.in("room_id", assignedRoomIds);
    }
    const { data: devicesData } = await devicesQuery;

    let adminsData: { id: string, name: string, assigned_room_ids: string[] | null }[] = [];
    if (isSuperAdminUser) {
        const { data } = await supabase
            .from('instructors')
            .select('id, name, assigned_room_ids')
            .eq('role', 'admin')
            .neq('is_super_admin', true);
        adminsData = data || [];
    }

    return (
        <Suspense fallback={<TableSkeleton rows={5} cols={4} />}>
            <RoomsClient 
                initialRooms={roomsData || []} 
                initialDevices={devicesData || []} 
                initialAdmins={adminsData} 
                profile={profile}
                canManageRooms={!!canManageRooms}
            />
        </Suspense>
    );
}
