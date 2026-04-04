import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ClassRow {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    day_of_week: string | null;
    schedule_days: string | null;
    room_id: string | null;
}

export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const instructor_id = searchParams.get('instructor_id') || searchParams.get('instructorId') || searchParams.get('id');
    const room_id = searchParams.get('room_id');

    if (!instructor_id && !room_id) {
        return NextResponse.json({ error: "Either instructor_id or room_id is required" }, { status: 400 });
    }

    try {
        // 1. Fetch the Active Academic Term
        const { data: activeTerm } = await supabase
            .from('academic_terms')
            .select('id')
            .eq('is_active', true)
            .single();

        // 2. Query classes
        let query = supabase
            .from('classes')
            .select('id, name, start_time, end_time, day_of_week, schedule_days, room_id, term_id')
            .or('is_archived.is.null,is_archived.eq.false');

        // Resolve room_id if it's a name (e.g. "STC102") rather than a UUID
        let effectiveRoomId = room_id;
        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        if (room_id && !isUUID(room_id)) {
            const { data: roomData } = await supabase
                .from('rooms')
                .select('id')
                .ilike('name', room_id.trim())
                .maybeSingle();

            if (roomData) {
                effectiveRoomId = roomData.id;
            } else {
                // If room name not found, nullify it to avoid DB error and potentially fallback to instructor
                effectiveRoomId = null;
            }
        }

        if (effectiveRoomId) {
            query = query.eq('room_id', effectiveRoomId);
        } else if (instructor_id) {
            query = query.eq('instructor_id', instructor_id);
        }

        // 3. Filter by terminal's active term if one exists
        if (activeTerm) {
            query = query.eq('term_id', activeTerm.id);
        }

        const { data: classes, error } = await query.order('start_time', { ascending: true });

        if (error) {
            console.error("Error fetching classes:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Use Intl.DateTimeFormat for reliable Manila day/time (works on Vercel/Cloud)
        const manilaFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            weekday: 'short',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        });

        const parts = manilaFormatter.formatToParts(new Date());
        const todayDay = parts.find(p => p.type === 'weekday')?.value || ""; // "Fri"
        const hour = parseInt(parts.find(p => p.type === 'hour')?.value || "0");
        const minute = parseInt(parts.find(p => p.type === 'minute')?.value || "0");
        const currentMinutes = hour * 60 + minute;

        const getMinutes = (timeStr: string | null) => {
            if (!timeStr) return 0;
            const parts = timeStr.split(':').map(Number);
            return parts[0] * 60 + parts[1];
        };


        const filteredClasses = (classes as unknown as ClassRow[] || [])
            .filter((c: ClassRow) => {
                const classDays = c.schedule_days || c.day_of_week || "";
                // Use .includes() directly as in QR session logic (short day match)
                return classDays.includes(todayDay) && todayDay !== "";
            })
            .map((c: ClassRow) => {
                const startMin = getMinutes(c.start_time);
                const endMin = getMinutes(c.end_time);

                // Recommended if current time is in window
                const isRecommended = currentMinutes >= (startMin - 15) && currentMinutes <= endMin;

                return {
                    id: c.id,
                    name: c.name,
                    start_time: c.start_time,
                    end_time: c.end_time,
                    recommended: isRecommended
                };
            });

        return NextResponse.json(filteredClasses);
    } catch (err) {
        console.error("API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
