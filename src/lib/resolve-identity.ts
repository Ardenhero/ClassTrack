import { createClient as createServerClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

/**
 * Resolve the caller's identity from their Supabase auth session.
 * Returns { instructor_id, department_id } or null if unauthenticated.
 *
 * Use this in ALL API routes that need to know WHO is calling,
 * instead of trusting client-supplied instructor_id.
 */
export async function resolveWebIdentity(): Promise<{
    instructor_id: string;
    department_id: string;
    auth_user_id: string;
} | null> {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return null;

        // Use service role to look up instructor record
        const adminClient = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: instructor } = await adminClient
            .from("instructors")
            .select("id, department_id")
            .eq("auth_user_id", user.id)
            .single();

        if (!instructor) return null;

        return {
            instructor_id: instructor.id,
            department_id: instructor.department_id,
            auth_user_id: user.id,
        };
    } catch {
        return null;
    }
}

/**
 * Verify that a device belongs to the given department.
 * Returns true if the device exists and matches the department.
 */
export async function verifyDeviceDepartment(
    deviceId: string,
    departmentId: string
): Promise<boolean> {
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data } = await supabase
        .from("iot_devices")
        .select("id")
        .eq("id", deviceId)
        .eq("department_id", departmentId)
        .maybeSingle();

    return !!data;
}

/**
 * Verify that a room belongs to the given department.
 */
export async function verifyRoomDepartment(
    roomId: string,
    departmentId: string
): Promise<boolean> {
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data } = await supabase
        .from("rooms")
        .select("id")
        .eq("id", roomId)
        .eq("department_id", departmentId)
        .maybeSingle();

    return !!data;
}

/**
 * Authenticate a device using a token.
 * 
 * Rules:
 * 1. If device has a specific `device_token` in DB, request MUST match it. Global secret rejected.
 * 2. If device has NO `device_token`, Global `API_SECRET` is accepted (Migration/Legacy mode).
 * 
 * @param claimedDeviceId - Optional. If provided, verifies token against this device. If null, attempts to identify device by token.
 */
export async function authenticateDevice(token: string | null, claimedDeviceId: string | null): Promise<{
    type: 'specific' | 'global';
    device?: { id: string; room_id: string; department_id: string };
} | null> {
    if (!token) return null;

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (claimedDeviceId) {
        // Mode A: Claimed Identity Verification
        const { data: device } = await supabase
            .from("iot_devices")
            .select("id, room_id, department_id, device_token")
            .eq("id", claimedDeviceId)
            .maybeSingle();

        if (!device) return null;

        if (device.device_token) {
            // Specific Token Enforced
            return token === device.device_token ? { type: 'specific', device } : null;
        }

        // Global Fallback
        const secret = process.env.API_SECRET;
        if (secret && token === secret) {
            return { type: 'global', device };
        }
    } else {
        // Mode B: Token Lookup (Identify Device by Token)
        const { data: device } = await supabase
            .from("iot_devices")
            .select("id, room_id, department_id, device_token")
            .eq("device_token", token)
            .maybeSingle();

        if (device) {
            return { type: 'specific', device };
        }

        // If not found by specific token, check if it's the Global Secret
        const secret = process.env.API_SECRET;
        if (secret && token === secret) {
            return { type: 'global' }; // Device unknown
        }
    }

    return null;
}

/**
 * Verify if the request contains a valid device token (synchronous check for global secret).
 * @deprecated Use authenticateDevice for robust checks.
 */
export function verifyDeviceToken(token: string | null): boolean {
    const secret = process.env.API_SECRET;
    if (!secret || !token) return false;
    return token === secret;
}
