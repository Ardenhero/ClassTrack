import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * POST /api/kiosk/sync
 *
 * Zero-Touch onboarding endpoint.
 * - If device_id is unknown → auto-create with status='pending'
 * - If pending → return restricted payload
 * - If approved + no room → return empty data
 * - If approved + bound → return room-scoped schedule + students
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const body = await request.json();
        const device_id = body.device_id as string | undefined;

        if (!device_id) {
            return NextResponse.json(
                { error: "device_id is required" },
                { status: 400 }
            );
        }

        // ── Step 1: Lookup or auto-register ──
        const { data: existing } = await supabase
            .from('kiosk_devices')
            .select('device_serial, status, room_id, department_id, label, pending_command')
            .eq('device_serial', device_id)
            .maybeSingle();

        if (!existing) {
            // Auto-register as pending
            const { error: insertError } = await supabase
                .from('kiosk_devices')
                .insert({
                    device_serial: device_id,
                    status: 'pending',
                    is_online: true,
                    last_heartbeat: new Date().toISOString(),
                });

            if (insertError) {
                console.error("[Kiosk Sync] Auto-register error:", insertError);
                return NextResponse.json({ error: insertError.message }, { status: 500 });
            }

            return NextResponse.json({
                provisioned: false,
                status: "pending",
                message: "Device registered. Awaiting admin approval.",
            });
        }

        // ── Step 2: Check provisioning status ──
        if (existing.status === 'pending') {
            return NextResponse.json({
                provisioned: false,
                status: "pending",
                message: "Device is pending admin approval.",
                pending_command: existing.pending_command || null,
            });
        }

        if (existing.status === 'rejected') {
            return NextResponse.json({
                provisioned: false,
                status: "rejected",
                message: "Device has been rejected by admin.",
            });
        }

        // ── Step 3: Device is approved ──

        // Update heartbeat timestamp
        await supabase
            .from('kiosk_devices')
            .update({ last_heartbeat: new Date().toISOString(), is_online: true })
            .eq('device_serial', device_id);

        // Consume pending command (one-shot delivery)
        const pendingCommand = existing.pending_command || null;
        if (pendingCommand) {
            await supabase
                .from('kiosk_devices')
                .update({ pending_command: null })
                .eq('device_serial', device_id);
        }

        const roomId = existing.room_id;

        if (!roomId) {
            return NextResponse.json({
                provisioned: true,
                status: "approved",
                room_id: null,
                label: existing.label,
                message: "Approved but not bound to a room yet.",
                pending_command: pendingCommand,
                classes: [],
                students: [],
            });
        }

        // ── Step 4: Fetch room-scoped data ──

        // Get today's day abbreviation in Manila time
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const now = new Date();
        const manilaOffset = 8 * 60;
        const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
        const manilaDate = new Date(utcMs + manilaOffset * 60000);
        const todayDay = days[manilaDate.getDay()];

        // Current time for recommendation
        const nowManila = manilaDate.toLocaleTimeString('en-US', { hour12: false });
        const currentMinutes = (() => {
            const parts = nowManila.split(':').map(Number);
            return parts[0] * 60 + parts[1];
        })();

        // Fetch classes for this room
        const { data: classes } = await supabase
            .from('classes')
            .select('id, name, start_time, end_time, year_level, instructor_id, day_of_week, instructors!classes_instructor_id_fkey(name)')
            .eq('room_id', roomId)
            .order('start_time');

        const getMinutes = (timeStr: string | null) => {
            if (!timeStr) return 0;
            const parts = timeStr.split(':').map(Number);
            return parts[0] * 60 + parts[1];
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const todayClasses = (classes || [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((c: any) => {
                if (!c.day_of_week) return false;
                const daysStr = c.day_of_week.replace(/[\[\]'"\s]/g, '');
                return daysStr.split(',').some((d: string) => d.trim() === todayDay);
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((c: any) => {
                const startMin = getMinutes(c.start_time);
                const endMin = getMinutes(c.end_time);
                const isRecommended = currentMinutes >= (startMin - 15) && currentMinutes <= endMin;

                return {
                    id: c.id,
                    name: c.name,
                    start_time: c.start_time,
                    end_time: c.end_time,
                    year_level: c.year_level,
                    instructor_id: c.instructor_id,
                    instructor_name: Array.isArray(c.instructors) ? c.instructors[0]?.name : c.instructors?.name || 'Unknown',
                    recommended: isRecommended,
                };
            });

        // Fetch all enrolled students for today's classes
        const classIds = todayClasses.map((c: { id: string }) => c.id);
        let students: { id: string; name: string; year_level: string | null; class_id: string }[] = [];

        if (classIds.length > 0) {
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('class_id, student_id, students(id, name, year_level)')
                .in('class_id', classIds);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            students = (enrollments || [])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((e: any) => e.students)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((e: any) => ({
                    id: e.students.id,
                    name: e.students.name,
                    year_level: e.students.year_level,
                    class_id: e.class_id,
                }));
        }

        // Get room info
        const { data: room } = await supabase
            .from('rooms')
            .select('name, building')
            .eq('id', roomId)
            .single();

        return NextResponse.json({
            provisioned: true,
            status: "approved",
            room_id: roomId,
            room_name: room?.name || null,
            room_building: room?.building || null,
            label: existing.label,
            day: todayDay,
            current_time: nowManila,
            pending_command: pendingCommand,
            classes: todayClasses,
            students,
        });

    } catch (err) {
        console.error("[Kiosk Sync] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
