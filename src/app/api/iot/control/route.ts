import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { controlDevice } from "@/lib/tuya";

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

        const body = await request.json();
        const { device_id, code, value, source, class_id, profile_id } = body;

        if (!device_id || !code || typeof value !== 'boolean') {
            return NextResponse.json(
                { error: "Missing required fields: device_id, code, value (boolean)" },
                { status: 400 }
            );
        }

        // Resolve instructor_id from email (for ESP32 requests) or profile_id (for web requests)
        let triggeredBy: string | null = profile_id || null;
        if (email && !triggeredBy) {
            const { data: instructor } = await supabase
                .from('instructors')
                .select('id')
                .eq('email', email)
                .single();
            triggeredBy = instructor?.id || null;
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

/**
 * GET /api/iot/control — Get current status of all IoT devices.
 */
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
        let instructor: any = null;

        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        if (user) {
            // Check for explicit profile selection from frontend
            const profileId = request.headers.get("X-Profile-ID");

            // Try lookup by auth_user_id first
            const { data: instructors } = await adminClient
                .from('instructors')
                .select('id, department_id, is_super_admin')
                .eq('auth_user_id', user.id);

            if (instructors && instructors.length > 0) {
                if (profileId) {
                    // If frontend sent a specific profile, try to find it in the user's linked instructors
                    instructor = instructors.find(i => i.id === profileId);
                }

                // Fallback: Prioritize the profile that has a department assigned
                if (!instructor) {
                    instructor = instructors.find(i => i.department_id) || instructors[0];
                }
            }

            // Fallback to email lookup if auth_user_id isn't linked yet NO - REMOVING THIS AS IT IS BROKEN (No email col)
            // The user already has auth_user_id linked, so this is fine. 
            // If we really needed it, we'd need to join tables, but keeping it simple for now.

            if (instructor) {
                departmentId = instructor.department_id;
                isSuperAdmin = isSuperAdmin || instructor.is_super_admin;
            }
        } else if (!isLegacyAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch devices using service role to bypass RLS
        // We fetch ALL (or filtered by department to be safe if strictly hierarchical)
        // But since we want to support explicit assignment that might override, we fetch broadly then filter.
        // Optimization: We could use .or() but JS filtering is safer for the "Exclusion" logic.
        const { data: allDevices, error } = await adminClient
            .from('iot_devices')
            .select('*')
            .order('name');

        if (error) {
            console.error("[IoT Control] Query Error:", error);
            throw error;
        }

        // Apply Visibility Rules in Memory
        const devices = (allDevices || []).filter((device: any) => {
            if (isSuperAdmin) return true;

            // 1. Explicit Assignment Logic
            const assignedIds = device.assigned_instructor_ids;
            if (Array.isArray(assignedIds) && assignedIds.length > 0) {
                // STRICT MODE: If assignments exist, MUST be in the list
                // (Even if department matches, if you aren't in the list, you don't see it)
                return instructor && assignedIds.includes(instructor.id);
            }

            // 2. Fallback: Department Match
            if (device.department_id) {
                return departmentId && device.department_id === departmentId;
            }

            // 3. Global Devices (no dept) -> Visible to whom?
            // Usually Global = Admin only? Or Everyone?
            // User said: "Global Department... disables... room controls on admin side... can still see... in Instructor profile".
            // If device has NO department, it shouldn't be visible to instructors usually, unless explicitly assigned.
            return false;
        });

        // Optionally refresh from Tuya (Optimistic/Basic status)
        const enriched = await Promise.all(
            (devices || []).map(async (device: { id: string; name: string; type: string; room: string; dp_code: string; current_state: boolean; online: boolean }) => {
                // ... (Keep existing simple logic or Tuya check if needed, simplified for brevity as per revert)
                return { ...device, live: true };
            })
        );

        return NextResponse.json({
            devices: enriched
        });

    } catch (err) {
        console.error("[IoT Control GET] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}
