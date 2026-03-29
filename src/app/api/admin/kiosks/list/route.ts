import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const departmentId = searchParams.get("departmentId");

        console.log(`[Kiosk List API] Fetching for departmentId: ${departmentId}`);

        // Fetch all approved kiosks joined with room data
        const { data: allKiosks, error } = await supabase
            .from('kiosk_devices')
            .select('device_serial, label, status, department_id, room_id, rooms(name, department_id)')
            .eq('status', 'approved')
            .order('label', { ascending: true });

        if (error) {
            console.error("[Kiosk List API] Database Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        let filteredKiosks = allKiosks || [];

        // Apply filtering in JS for reliability across joins
        if (departmentId && departmentId !== 'null' && departmentId !== 'undefined' && departmentId !== '') {
            filteredKiosks = allKiosks.filter(k =>
                k.department_id === departmentId ||
                (k.rooms as unknown as { department_id: string } | null)?.department_id === departmentId
            );
            console.log(`[Kiosk List API] Filtered ${allKiosks.length} down to ${filteredKiosks.length} for dept ${departmentId}`);
        } else {
            console.log(`[Kiosk List API] No departmentId provided, returning all ${allKiosks.length} approved kiosks`);
        }

        return NextResponse.json({
            kiosks: filteredKiosks.map(k => ({
                device_serial: k.device_serial,
                label: k.label || k.device_serial,
                room_name: (k.rooms as unknown as { name: string } | null)?.name || null
            }))
        });

    } catch (err) {
        console.error("[Kiosk List API] Internal Error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
