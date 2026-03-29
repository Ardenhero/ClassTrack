import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createSSRClient } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/poll
 * Returns recent notifications for the current user's instructor profile.
 * Uses service role to bypass RLS.
 */
export async function GET() {
    try {
        const userClient = createSSRClient();
        const { data: { user } } = await userClient.auth.getUser();

        if (!user) {
            return NextResponse.json({ notifications: [] });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Find all instructor profiles for this auth user
        const { data: instructors } = await supabase
            .from('instructors')
            .select('id')
            .eq('auth_user_id', user.id);

        const instructorIds = instructors?.map(i => i.id) || [];

        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Fetch notifications for this user (by instructor_id OR user_id)
        let query = supabase
            .from('notifications')
            .select('*')
            .gte('created_at', oneDayAgo)
            .order('created_at', { ascending: false })
            .limit(20);

        if (instructorIds.length > 0) {
            // Get notifications for any of this user's instructor profiles OR by user_id
            query = query.or(`instructor_id.in.(${instructorIds.join(',')}),user_id.eq.${user.id}`);
        } else {
            query = query.eq('user_id', user.id);
        }

        const { data: notifications } = await query;

        return NextResponse.json({ notifications: notifications || [] });
    } catch (err) {
        console.error("[Notifications Poll] Error:", err);
        return NextResponse.json({ notifications: [] });
    }
}
