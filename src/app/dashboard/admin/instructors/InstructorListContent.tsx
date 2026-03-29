import { createClient } from "@/utils/supabase/server";
import { Key, User } from "lucide-react";
import { DeleteInstructorButton } from "./DeleteInstructorButton";
import { RoomAssignmentModal } from "./RoomAssignmentModal";
import Image from "next/image";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

export default async function InstructorListContent({
    isSuperAdmin,
    userId,
    profileId
}: {
    isSuperAdmin: boolean;
    userId: string | undefined;
    profileId: string | undefined;
}) {
    noStore();
    const supabase = createClient();

    let query = supabase
        .from("instructors")
        .select(`
      id,
      name,
      role,
      pin_code,
      image_url,
      department_id,
      assigned_room_ids,
      can_activate_room,
      activator_fingerprint_slot,
      is_visible_on_kiosk,
      departments (
        name,
        code
      )
    `)
        .order("name");

    // Revert to original working logic: Filter by owner_id if not super admin
    if (!isSuperAdmin) {
        query = query.eq("owner_id", userId ?? "");
    }

    const { data: instructors } = await query;

    // Fetch rooms for assignment
    let roomsQuery = supabase
        .from("rooms")
        .select("id, name, building, department_id")
        .order("name");

    // Filter rooms by admin assignments
    if (!isSuperAdmin && (profileId || userId)) {
        let adminQuery = supabase
            .from("instructors")
            .select("assigned_room_ids");
            
        if (profileId && profileId !== 'admin-profile') {
            adminQuery = adminQuery.eq("id", profileId);
        } else {
            adminQuery = adminQuery.eq("auth_user_id", userId || "");
        }

        const { data: adminProfile } = await adminQuery.maybeSingle();
        
        if (adminProfile?.assigned_room_ids && adminProfile.assigned_room_ids.length > 0) {
            roomsQuery = roomsQuery.in("id", adminProfile.assigned_room_ids);
        } else {
            // No rooms assigned = no rooms visible to assign to instructors
            roomsQuery = roomsQuery.eq("id", "00000000-0000-0000-0000-000000000000"); // UUID that won't exist
        }
    }

    const { data: allRooms } = await roomsQuery;

    // Fetch departments for the dropdown
    const { data: departments } = await supabase
        .from("departments")
        .select("id, name, code")
        .order("name");

    return (
        <div className="divide-y">
            {instructors?.map((inst) => (
                <div key={inst.id} className="flex items-center justify-between py-4 group">
                    <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 rounded-full bg-nwu-red/10 flex items-center justify-center text-nwu-red font-bold text-sm overflow-hidden relative border border-gray-100 dark:border-gray-700">
                            {inst.image_url ? (
                                <Image
                                    src={inst.image_url}
                                    alt={inst.name}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                inst.name[0] || <User className="h-5 w-5" />
                            )}
                        </div>
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">{inst.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                                <form action={async (formData: FormData) => {
                                    "use server";
                                    const { updateInstructorDepartment } = await import("./instructorActions");
                                    const deptId = formData.get("department_id") as string;
                                    await updateInstructorDepartment(inst.id, deptId === "" ? null : deptId);
                                }}>
                                    {isSuperAdmin ? (
                                        <>
                                            <select
                                                name="department_id"
                                                defaultValue={inst.department_id || ""}
                                                className="px-1 py-0.5 border border-gray-200 dark:border-gray-600 rounded bg-transparent dark:text-white focus:ring-1 focus:ring-nwu-red outline-none transition-all text-[10px] font-medium w-32"
                                                aria-label={`Change department for ${inst.name}`}
                                            >
                                                <option value="">(No Dept)</option>
                                                {departments?.map((d) => (
                                                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                                                ))}
                                            </select>
                                            <button
                                                type="submit"
                                                className="ml-1 p-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded hover:bg-nwu-red dark:hover:bg-nwu-red hover:text-white transition-all"
                                                title="Save Department"
                                                aria-label={`Save department for ${inst.name}`}
                                            >
                                                <Key className="h-3 w-3" aria-hidden="true" />
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                                            {/* @ts-expect-error: Supabase sometimes infers relations as arrays */}
                                            {inst.departments?.code || "No Dept"}
                                        </span>
                                    )}
                                </form>
                                {inst.role === "admin" && (
                                    <span className="px-2 py-0.5 bg-amber-400 text-amber-950 rounded-full font-bold shadow-sm">Admin</span>
                                )}
                                {inst.pin_code && (
                                    <span className="flex items-center gap-1 text-amber-600">
                                        <Key className="h-3 w-3" /> PIN
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Only show room assignment for regular instructors, not for Dept Admins */}
                        {inst.role !== 'admin' && (
                            <RoomAssignmentModal 
                                instructorId={inst.id} 
                                instructorName={inst.name} 
                                initialRoomIds={inst.assigned_room_ids || []} 
                                availableRooms={allRooms || []} 
                            />
                        )}
                        <DeleteInstructorButton instructorId={inst.id} instructorName={inst.name} />
                    </div>
                </div>
            ))}
            {(!instructors || instructors.length === 0) && (
                <p className="text-sm text-gray-400 py-4 text-center">No instructors yet. Add one above.</p>
            )}
        </div>
    );
}
