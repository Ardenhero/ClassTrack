import { createClient } from "@/utils/supabase/server";
import { ProfileSelector } from "./ProfileSelector";
import { Profile } from "@/context/ProfileContext";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function SelectProfilePage() {
    const supabase = createClient();

    // Get the current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    // Fetch ONLY this user's linked profiles
    const { data: instructors, error } = await supabase
        .from("instructors")
        .select("id, name, department_id, pin_enabled, role, is_super_admin")
        .eq("owner_id", user.id)
        .order("name");

    if (error) {
        console.error("Error fetching profiles:", error);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allProfiles: Profile[] = (instructors || []).map((inst: any) => {
        return {
            id: inst.id,
            name: inst.name,
            role: inst.role === 'admin' ? 'admin' : 'instructor',
            department_id: inst.department_id,
            has_pin: inst.pin_enabled,
            is_super_admin: inst.is_super_admin
        };
    });

    // Sort: admin first, then alphabetical
    const adminProfile = allProfiles.find(p => p.role === 'admin');
    const otherProfiles = allProfiles.filter(p => p.role !== 'admin').sort((a, b) => a.name.localeCompare(b.name));

    let profiles: Profile[] = [];
    if (adminProfile) {
        profiles = [adminProfile, ...otherProfiles];
    } else if (otherProfiles.length > 0) {
        profiles = otherProfiles;
    }

    return <ProfileSelector profiles={profiles} />;
}
