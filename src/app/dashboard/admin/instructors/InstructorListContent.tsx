import { createClient } from "@/utils/supabase/server";
import { Key, ShieldCheck } from "lucide-react";
import { DeleteInstructorButton } from "./DeleteInstructorButton";
import { EnrollActivatorButton } from "./EnrollActivatorButton";

export default async function InstructorListContent({
    isSuperAdmin,
    userId
}: {
    isSuperAdmin: boolean;
    userId: string | undefined;
}) {
    const supabase = createClient();

    let query = supabase
        .from("instructors")
        .select(`
      id,
      name,
      role,
      pin_code,
      department_id,
      can_activate_room,
      departments (
        name,
        code
      )
    `)
        .order("name");

    // If NOT Super Admin, filter by their owned instructors
    if (!isSuperAdmin) {
        query = query.eq("owner_id", userId ?? "");
    }

    const { data: instructors } = await query;

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
                        <div className="h-10 w-10 rounded-full bg-nwu-red/10 flex items-center justify-center text-nwu-red font-bold text-sm">
                            {inst.name[0]}
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">{inst.name}</p>
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
                                                className="px-1 py-0.5 border border-gray-200 rounded bg-transparent focus:ring-1 focus:ring-nwu-red outline-none transition-all text-[10px] font-medium w-32"
                                            >
                                                <option value="">(No Dept)</option>
                                                {departments?.map((d) => (
                                                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                                                ))}
                                            </select>
                                            <button
                                                type="submit"
                                                className="ml-1 p-1 bg-gray-100 text-gray-400 rounded hover:bg-nwu-red hover:text-white transition-all"
                                                title="Save Department"
                                            >
                                                <Key className="h-3 w-3" />
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">
                                            {/* @ts-expect-error: Supabase sometimes infers relations as arrays */}
                                            {inst.departments?.code || "No Dept"}
                                        </span>
                                    )}
                                </form>
                                {inst.role === "admin" && (
                                    <span className="px-2 py-0.5 bg-nwu-gold/20 text-nwu-red rounded-full font-bold">Admin</span>
                                )}
                                {inst.pin_code && (
                                    <span className="flex items-center gap-1 text-amber-600">
                                        <Key className="h-3 w-3" /> PIN
                                    </span>
                                )}
                                {inst.can_activate_room && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold">
                                        <ShieldCheck className="h-3 w-3" /> Room Activator
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Permission Toggles — visible on hover */}
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <form action={async (formData: FormData) => {
                                "use server";
                                const { toggleRoomActivation } = await import("./instructorActions");
                                const currentVal = formData.get("can_activate_room") === "true";
                                await toggleRoomActivation(inst.id, !currentVal);
                            }}>
                                <input type="hidden" name="can_activate_room" value={String(!!inst.can_activate_room)} />
                                <button
                                    type="submit"
                                    className={`text-[10px] px-2 py-1 rounded border transition-all ${inst.can_activate_room
                                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                                        : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
                                        }`}
                                    title={inst.can_activate_room ? "Revoke Room Activation" : "Grant Room Activation"}
                                >
                                    {inst.can_activate_room ? "✓ Room" : "Room"}
                                </button>
                            </form>
                        </div>
                        {inst.can_activate_room && (
                            <EnrollActivatorButton instructorId={inst.id} instructorName={inst.name} />
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
