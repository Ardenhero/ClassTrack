import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { controlDevice } from "../../../../lib/tuya";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const ControlSchema = z.object({
    device_id: z.string().optional(),
    code: z.string().optional(),
    value: z.boolean(),
    source: z.string().optional(),
    class_id: z.string().uuid().or(z.string()).optional(),
    profile_id: z.string().uuid().optional(),
    group_id: z.string().uuid().or(z.string()).optional(),
});

export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get("email");

        let rawBody: unknown;
        try {
            rawBody = await request.json();
        } catch {
            return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
        }

        const result = ControlSchema.safeParse(rawBody);
        if (!result.success) {
            return NextResponse.json({ 
                error: "Invalid Request", 
                details: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`) 
            }, { status: 400 });
        }

        const body = result.data;
        const { device_id, code, value, source, class_id, profile_id, group_id } = body;

        // --- AUTH & PERMISSION CHECK ---
        let instructor: { id: string, name: string, can_activate_room: boolean, is_super_admin: boolean, assigned_room_ids: string[] | null } | null = null;
        if (profile_id) {
            const { data } = await supabase.from('instructors').select('id, name, can_activate_room, is_super_admin, assigned_room_ids').eq('id', profile_id).single();
            instructor = data;
        } else if (email) {
            const { data } = await supabase.from('instructors').select('id, name, can_activate_room, is_super_admin, assigned_room_ids').eq('email', email).single();
            instructor = data;
        }

        // --- SCOPED PERMISSION: Ensure instructor is authorized for this room/group ---
        if (instructor && !instructor.is_super_admin) {
            const roomIds = Array.isArray(instructor.assigned_room_ids) ? instructor.assigned_room_ids : [];
            
            if (device_id) {
                const { data: device } = await supabase.from('iot_devices').select('room_id').eq('id', device_id).single();
                if (device?.room_id && !roomIds.includes(device.room_id)) {
                    console.warn(`[SECURITY] Unauthorized IoT access attempt: ${instructor.name} -> ${device_id}`);
                    return NextResponse.json({ error: "unauthorized_room_access" }, { status: 403 });
                }
            } else if (group_id) {
                const { data: group } = await supabase.from('iot_device_groups').select('room_id').eq('id', group_id).single();
                if (group?.room_id && !roomIds.includes(group.room_id)) {
                    return NextResponse.json({ error: "unauthorized_group_access" }, { status: 403 });
                }
            }
        }

        // --- BATCH CONTROL (Virtual Group) ---
        if (group_id) {
            console.log(`[IoT Control] Batch POST: Group=${group_id}, Value=${value}`);
            const { data: members, error: groupErr } = await supabase
                .from('iot_group_members')
                .select('device_id, dp_code')
                .eq('group_id', group_id);

            if (groupErr || !members) {
                return NextResponse.json({ error: "Failed to fetch group members" }, { status: 404 });
            }

            const results = await Promise.all(members.map(async (member) => {
                const realDeviceId = member.device_id.replace(/_ch\d+$/, '');
                const res = await controlDevice(realDeviceId, member.dp_code, value);

                if (res.success) {
                    await supabase.from('iot_devices').update({ current_state: value, updated_at: new Date().toISOString() }).eq('id', member.device_id);
                    await supabase.from('iot_device_logs').insert({
                        device_id: member.device_id,
                        code: member.dp_code,
                        value,
                        source: source || 'web_group',
                        triggered_by: instructor?.id || null,
                        class_id: class_id || null,
                    });
                }
                return { device_id: member.device_id, success: res.success };
            }));

            return NextResponse.json({ success: true, group_id, value, results });
        }

        if (!device_id || !code) {
            return NextResponse.json({ error: "Missing device_id or code" }, { status: 400 });
        }

        // ===== v3.2 GRACE BUFFER: Prevent auto-off if room still occupied or class recently ended =====
        if (value === false && source === 'auto') {
            try {
                const { data: device } = await supabase.from('iot_devices').select('room_id').eq('id', device_id).single();
                if (device?.room_id) {
                    const { data: occupancy } = await supabase.from('room_occupancy').select('current_count').eq('room_id', device.room_id).single();
                    if (occupancy && occupancy.current_count > 0) {
                        return NextResponse.json({
                            error: 'grace_buffer_active',
                            message: `Room still has ${occupancy.current_count} occupant(s). Auto-off blocked.`,
                        }, { status: 409 });
                    }

                    const now = new Date();
                    const nowStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour12: false });
                    const getMinutes = (t: string) => { const p = t.split(':').map(Number); return p[0] * 60 + p[1]; };
                    const currentMin = getMinutes(nowStr);

                    const { data: roomClasses } = await supabase.from('classes').select('end_time').eq('room_id', device.room_id).not('end_time', 'is', null).order('end_time', { ascending: false }).limit(1);
                    if (roomClasses && roomClasses.length > 0 && roomClasses[0].end_time) {
                        const endMin = getMinutes(roomClasses[0].end_time);
                        const elapsed = currentMin - endMin;
                        if (elapsed < 15 && elapsed >= 0) {
                            return NextResponse.json({
                                error: 'grace_buffer_active',
                                message: `Class ended ${elapsed}m ago. 15-minute grace buffer active.`,
                            }, { status: 409 });
                        }
                    }
                }
            } catch (graceErr) {
                console.warn('[IoT] Grace buffer check error (non-fatal):', graceErr);
            }
        }

        console.log(`[IoT Control] POST: Device=${device_id}, Code=${code}, Value=${value}, Source=${source}, User=${instructor?.name || 'Unknown'}`);

        const realDeviceId = device_id.replace(/_ch\d+$/, '');
        const resultCommand = await controlDevice(realDeviceId, code, value);

        if (!resultCommand.success) {
            return NextResponse.json({ error: "Tuya command failed", details: resultCommand.msg }, { status: 502 });
        }

        await supabase.from('iot_devices').update({ current_state: value, updated_at: new Date().toISOString() }).eq('id', device_id);
        await supabase.from('iot_device_logs').insert({
            device_id,
            code,
            value,
            source: source || 'web',
            triggered_by: instructor?.id || null,
            class_id: class_id || null,
        });

        return NextResponse.json({ success: true, device_id, code, value });

    } catch (err) {
        console.error("[IoT Control] Error:", err);
        return NextResponse.json({ error: "Internal server error", details: String(err) }, { status: 500 });
    }
}

// GET /api/iot/control — Get current status of IoT devices (Scoped)
export async function GET(request: Request) {
    const { cookies } = await import("next/headers");
    const { createServerClient } = await import("@supabase/ssr");

    const cookieStore = cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch { }
                },
            },
        }
    );

    try {
        const { data: { user } } = await supabase.auth.getUser();

        // Check for legacy admin-profile cookie or Super Admin
        const profileId = cookieStore.get("sc_profile_id")?.value;
        const isLegacyAdmin = profileId === 'admin-profile';

        let departmentId: string | null = null;
        let isSuperAdmin = isLegacyAdmin;
        let instructor: { id: string; department_id: string | null; is_super_admin: boolean; assigned_room_ids?: string[] | null } | null | undefined = null;

        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        if (user) {
            // Check for explicit profile selection from frontend (e.g., Department Admin impersonating an Instructor)
            const headerProfileId = request.headers.get("X-Profile-ID");

            if (headerProfileId) {
                const { data: explicitProfile } = await adminClient
                    .from('instructors')
                    .select('id, department_id, is_super_admin, assigned_room_ids')
                    .eq('id', headerProfileId)
                    .single();

                if (explicitProfile) {
                    instructor = explicitProfile;
                }
            }

            // Fallback: If no explicit profile ID or it wasn't found, try lookup by auth_user_id
            if (!instructor) {
                const { data: instructors } = await adminClient
                    .from('instructors')
                    .select('id, department_id, is_super_admin, assigned_room_ids')
                    .eq('auth_user_id', user.id);

                if (instructors && instructors.length > 0) {
                    // Prioritize the profile that has a department assigned
                    instructor = instructors.find(i => i.department_id) || instructors[0];
                }
            }

            if (instructor) {
                departmentId = instructor.department_id;
                isSuperAdmin = isSuperAdmin || instructor.is_super_admin;

                // ===== HIERARCHICAL SYNC: Refine instructor rooms based on Dept Admin access =====
                if (!instructor.is_super_admin && departmentId) {
                    // Fetch the Dept Admin for this department
                    const { data: deptAdmin } = await adminClient
                        .from('instructors')
                        .select('assigned_room_ids')
                        .eq('department_id', departmentId)
                        .eq('role', 'admin') // Correct role name
                        .maybeSingle();

                    if (deptAdmin && Array.isArray(deptAdmin.assigned_room_ids)) {
                        const adminRooms = deptAdmin.assigned_room_ids;
                        // Filter instructor's assigned rooms to only those the Dept Admin also has
                        if (Array.isArray(instructor.assigned_room_ids)) {
                            instructor.assigned_room_ids = instructor.assigned_room_ids.filter(
                                roomId => adminRooms.includes(roomId)
                            );
                        }
                    } else if (!deptAdmin) {
                        // If no dept admin found, or dept admin has no rooms, instructor gets nothing for safety
                        // unless it's a global room (handled by fallback)
                        instructor.assigned_room_ids = [];
                    }
                }
            }
        } else if (!isLegacyAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch devices using service role to bypass RLS, joining with rooms for accurate grouping
        const { data: allDevices, error } = await adminClient
            .from('iot_devices')
            .select('*, rooms(name)')
            .order('name');

        if (error) {
            console.error("[IoT Control] Query Error:", error);
            throw error;
        }

        interface DeviceWithAssignments {
            id: string;
            name: string;
            room: string;
            room_id: string | null;
            department_id: string | null;
            assigned_instructor_ids: string[] | string | null;
            rooms?: { name: string } | null;
            online?: boolean;
            updated_at?: string;
        }

        // Apply Visibility Rules in Memory
        const devices = (allDevices as unknown as DeviceWithAssignments[] || []).filter((device) => {
            if (isSuperAdmin) return true;

            // 1. Room-based Assignment Logic (NEW: High Priority)
            if (instructor && Array.isArray(instructor.assigned_room_ids) && instructor.assigned_room_ids.length > 0) {
                // Match by UUID room_id
                if (device.room_id && instructor.assigned_room_ids.includes(device.room_id)) {
                    return true;
                }

                // Fallback: Match by room name string ONLY IF no room_id is set (Legacy support, but stricter)
                const roomName = device.rooms?.name;
                if (!device.room_id && roomName && instructor.assigned_room_ids.some(idOrName =>
                    idOrName.toLowerCase() === roomName.toLowerCase()
                )) {
                    return true;
                }
            }

            // 2. Explicit Assignment Logic (Legacy)
            let assignedIds: string[] = [];
            if (Array.isArray(device.assigned_instructor_ids)) {
                assignedIds = device.assigned_instructor_ids;
            } else if (typeof device.assigned_instructor_ids === 'string') {
                try {
                    assignedIds = JSON.parse(device.assigned_instructor_ids);
                } catch {
                    // Ignore parsing error
                }
            }

            if (assignedIds.length > 0) {
                // If explicitly assigned to this instructor, allow access
                if (instructor && assignedIds.includes(instructor.id)) return true;

                // If it's explicitly assigned to OTHER instructors, and we didn't match via room above,
                // then we shouldn't see it (Strict mode for direct assignments)
                return false;
            }

            // 3. Fallback: Department Match (Only for devices with NO specific assignments)
            if (device.department_id) {
                return departmentId && device.department_id === departmentId;
            }

            // 4. Global Devices (no dept and no instructor) -> Hidden by default
            return false;
        });

        // Fetch rooms for the dropdown selector
        let roomsQuery = adminClient.from('rooms').select('id, name').order('name');

        if (!isSuperAdmin && instructor) {
            if (instructor.assigned_room_ids && instructor.assigned_room_ids.length > 0) {
                // If assigned via UUIDs, use those
                roomsQuery = roomsQuery.in('id', instructor.assigned_room_ids);
            } else if (departmentId) {
                // Fallback: match rooms by department
                roomsQuery = roomsQuery.eq('department_id', departmentId);
            } else {
                // No access
                roomsQuery = roomsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
            }
        }

        const { data: roomsData } = await roomsQuery;
        const allRooms = roomsData;

        // Return devices directly from DB (Supabase as Source of Truth)
        const enriched = (devices as DeviceWithAssignments[]).map((device) => {
            // Use joined rooms.name if available (from rooms table), otherwise truly "Unassigned"
            const roomName = device.rooms?.name || "Unassigned";

            return {
                ...device,
                room: roomName,
                live: false, // Indicates this is cached state
                online: device.online ?? false // Use actual DB status
            };
        });

        // Fetch Virtual Groups
        let groupsQuery = adminClient
            .from('iot_device_groups')
            .select('*, members:iot_group_members(device_id, dp_code)');

        if (!isSuperAdmin && instructor) {
            if (instructor.assigned_room_ids && instructor.assigned_room_ids.length > 0) {
                groupsQuery = groupsQuery.in('room_id', instructor.assigned_room_ids);
            } else {
                groupsQuery = groupsQuery.eq('room_id', '00000000-0000-0000-0000-000000000000');
            }
        }

        const { data: groupsData } = await groupsQuery;

        return NextResponse.json({
            devices: enriched,
            rooms: allRooms || [],
            groups: groupsData || []
        });

    } catch (err) {
        console.error("[IoT Control GET] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}
