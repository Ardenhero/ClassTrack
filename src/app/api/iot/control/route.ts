import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { controlDevice } from "../../../../lib/tuya";

export const dynamic = 'force-dynamic';

/**
 * POST /api/iot/control — Send ON/OFF command to a Tuya device.
 * Body: { device_id, code, value, source? }
 * Auth: email query param (ESP32 compatible) or service-level trust.
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get("email");
        const userAgent = request.headers.get("user-agent") || "";
        const isHardware = userAgent.includes("ESP") || userAgent.includes("Arduino") || !request.headers.get("accept")?.includes("text/html");

        // TIERED AUTHENTICATION: Non-Breaking Production Hardening
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            // WEB MODE: Do not trust URL params. Use the actual session email.
            if (email && email.toLowerCase() !== user.email?.toLowerCase()) {
                console.warn(`[SECURITY] IOT Identity Spoof Blocked: User ${user.email} attempted to control as ${email}`);
                return NextResponse.json({ error: "Identity mismatch: Browser sessions cannot spoof legacy emails." }, { status: 403 });
            }
        } else if (!isHardware) {
            // ANONYMOUS BROWSER: Block legacy ?email= access to prevent easy URL spoofing
            if (email) {
                console.warn(`[SECURITY] Blocked anonymous browser attempt to use legacy IOT ?email= auth.`);
                return NextResponse.json({ error: "Unauthorized: Please log in to control devices." }, { status: 401 });
            }
        }

        const body = await request.json();
        const { device_id, code, value, source, class_id, profile_id, group_id } = body;

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
                const result = await controlDevice(realDeviceId, member.dp_code, value);

                if (result.success) {
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
                return { device_id: member.device_id, success: result.success };
            }));

            return NextResponse.json({ success: true, group_id, value, results });
        }

        if (!device_id || !code || value === undefined || value === null) {
            return NextResponse.json(
                { error: "Missing required fields: device_id, code, value" },
                { status: 400 }
            );
        }

        // ===== v3.2 GRACE BUFFER: Prevent auto-off if room still occupied or class recently ended =====
        if (value === false && source === 'auto') {
            try {
                // Get the device's room_id
                const { data: device } = await supabase
                    .from('iot_devices')
                    .select('room_id')
                    .eq('id', device_id)
                    .single();

                if (device?.room_id) {
                    // Check room occupancy
                    const { data: occupancy } = await supabase
                        .from('room_occupancy')
                        .select('current_count')
                        .eq('room_id', device.room_id)
                        .single();

                    if (occupancy && occupancy.current_count > 0) {
                        return NextResponse.json({
                            error: 'grace_buffer_active',
                            message: `Room still has ${occupancy.current_count} occupant(s). Auto-off blocked.`,
                        }, { status: 409 });
                    }

                    // Check if latest class in this room ended within last 15 minutes
                    const now = new Date();
                    const manilaOffset = 8 * 60;
                    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
                    const manilaDate = new Date(utcMs + manilaOffset * 60000);
                    const nowStr = manilaDate.toLocaleTimeString('en-US', { hour12: false });
                    const getMinutes = (t: string) => { const p = t.split(':').map(Number); return p[0] * 60 + p[1]; };
                    const currentMin = getMinutes(nowStr);

                    const { data: roomClasses } = await supabase
                        .from('classes')
                        .select('end_time')
                        .eq('room_id', device.room_id)
                        .not('end_time', 'is', null)
                        .order('end_time', { ascending: false })
                        .limit(1);

                    if (roomClasses && roomClasses.length > 0 && roomClasses[0].end_time) {
                        const endMin = getMinutes(roomClasses[0].end_time);
                        const elapsed = currentMin - endMin;
                        if (elapsed < 15 && elapsed >= 0) {
                            return NextResponse.json({
                                error: 'grace_buffer_active',
                                message: `Class ended ${elapsed}m ago. 15-minute grace buffer active.`,
                                minutes_remaining: 15 - elapsed,
                            }, { status: 409 });
                        }
                    }
                }
            } catch (graceErr) {
                // Non-fatal: if grace buffer check fails, allow the command through
                console.warn('[IoT] Grace buffer check error (non-fatal):', graceErr);
            }
        }

        // Resolve instructor_id from email (for ESP32 requests) or profile_id (for web requests)
        let triggeredBy: string | null = profile_id || null;
        let instructor: { id: string; can_activate_room: boolean; name: string; is_super_admin: boolean } | null = null;

        if (profile_id) {
            const { data } = await supabase.from('instructors').select('id, name, can_activate_room, is_super_admin').eq('id', profile_id).single();
            instructor = data;
        } else if (email) {
            const { data } = await supabase.from('instructors').select('id, name, can_activate_room, is_super_admin').eq('email', email).single();
            instructor = data;
        }

        // 1. Resolve Device Identity (v3.2 Standard)
        const { data: deviceInfo } = await supabase
            .from('iot_devices')
            .select('id, name')
            .eq('id', device_id)
            .maybeSingle();

        // SCHOOL-GUARD: Strict hardware verification for production deployment
        if (isHardware && !deviceInfo && device_id) {
            console.warn(`[SECURITY] REJECTED: Unregistered IOT device attempt: ${device_id}`);
            return NextResponse.json({ error: "Unauthorized: Unregistered hardware device." }, { status: 403 });
        }

        triggeredBy = instructor?.id || null;

        console.log(`[IoT Control] POST: Device=${device_id}, Code=${code}, Value=${value}, Source=${source}, User=${instructor?.name || 'Unknown'}`);

        // Permission Check (Advisory)
        if (instructor && !instructor.is_super_admin && !instructor.can_activate_room) {
            console.warn(`[IoT Control] Advisory: ${instructor.name} does not have can_activate_room permission, but allowing toggle.`);
        }

        // Send command to Tuya
        // For multi-channel devices, DB id may have a suffix like "_ch2"
        // Strip it to get the real Tuya device ID
        const realDeviceId = device_id.replace(/_ch\d+$/, '');
        const result = await controlDevice(realDeviceId, code, value);

        if (!result.success) {
            return NextResponse.json(
                { error: "Tuya command failed", details: result.msg },
                { status: 502 }
            );
        }

        // Update device state in DB
        await supabase
            .from('iot_devices')
            .update({ current_state: value, updated_at: new Date().toISOString() })
            .eq('id', device_id);

        // Log the command
        await supabase
            .from('iot_device_logs')
            .insert({
                device_id,
                code,
                value,
                source: source || 'web',
                triggered_by: triggeredBy,
                class_id: class_id || null,
            });

        return NextResponse.json({ success: true, device_id, code, value });

    } catch (err) {
        console.error("[IoT Control] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
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
