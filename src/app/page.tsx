import DashboardLayout from "@/components/DashboardLayout";
export const dynamic = "force-dynamic";
import { createClient } from "@/utils/supabase/server";
import Image from "next/image";
import { format } from "date-fns";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { GlobalSearch } from "@/components/GlobalSearch";
import { cookies } from "next/headers";
import { getProfileRole, checkIsSuperAdmin } from "@/lib/auth-utils";
import { Suspense } from "react";
import SuperAdminDashboardContent from "@/components/dashboard/super-admin/SuperAdminDashboardContent";
import AdminDashboardContent from "@/components/dashboard/admin/AdminDashboardContent";
import RegularDashboardContent from "@/components/dashboard/RegularDashboardContent";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";


function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Skeleton className="h-32" variant="rounded" />
        <Skeleton className="h-32" variant="rounded" />
        <Skeleton className="h-32" variant="rounded" />
        <Skeleton className="h-32" variant="rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <Skeleton className="h-64" variant="rounded" />
    </div>
  );
}

export default async function Dashboard() {
  // ⚡ PARALLEL: Fire auth check, self-repair, and role checks simultaneously
  const supabase = createClient();
  const cookieStore = cookies();
  const profileId = cookieStore.get("sc_profile_id")?.value;

  const [{ data: { user: authUser } }, activeRole, isSuperAdmin, { data: activeTerm }] = await Promise.all([
    supabase.auth.getUser(),
    getProfileRole(),
    checkIsSuperAdmin(),
    supabase.from('academic_terms').select('id').eq('is_active', true).maybeSingle(),
  ]);

  // SELF-REPAIR: Link Auth User to Instructor Profile (fire-and-forget)
  if (authUser?.email) {
    void supabase
      .from('instructors')
      .update({ auth_user_id: authUser.id })
      .eq('email', authUser.email)
      .is('auth_user_id', null);
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValidProfileId = profileId && uuidRegex.test(profileId);
  const isActiveAdmin = activeRole === 'admin';
  const user = authUser;

  if (!profileId || !isValidProfileId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Redirecting to profile selection...</p>
      </div>
    );
  }

  let accountInstructorIds: string[] = [];
  if (isActiveAdmin && profileId && !isSuperAdmin) {
    const { data: adminRecord } = await supabase
      .from('instructors')
      .select('auth_user_id, department')
      .eq('id', profileId)
      .single();

    if (adminRecord?.department) {
      // If they are a Dept Admin, they should see everyone in their department
      const { data: deptInstructors } = await supabase
        .from('instructors')
        .select('id')
        .eq('department', adminRecord.department);

      accountInstructorIds = deptInstructors?.map(i => i.id) || [];
    } else if (adminRecord?.auth_user_id) {
      // Fallback to account-linked instructors if no department
      const { data: accountInstructors } = await supabase
        .from('instructors')
        .select('id')
        .or(`auth_user_id.eq.${adminRecord.auth_user_id},owner_id.eq.${adminRecord.auth_user_id}`);

      accountInstructorIds = accountInstructors?.map(i => i.id) || [];
    }
  }

  return (
    <DashboardLayout>
      {isSuperAdmin ? (
        <div className="bg-nwu-red rounded-xl p-6 mb-8 text-white flex justify-between items-center shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <div className="relative z-10">
            <p className="text-xs font-mono mb-1 opacity-75">{format(new Date(), 'M/d/yyyy')}</p>
            <h1 className="text-xl md:text-3xl font-bold uppercase tracking-wide leading-tight">
              Command Center <br className="md:hidden" /> Infrastructure
            </h1>
            <p className="text-nwu-gold text-xs md:text-sm font-medium tracking-wider mt-1 uppercase opacity-90">
              University-Wide System Monitor
            </p>
          </div>
          <div className="hidden md:block flex-shrink-0 relative z-10 ml-6">
            <Image priority src="/branding/icpep_logo.png" alt="ICPEP.SE Logo" width={80} height={80} sizes="80px" className="h-20 w-20 object-contain drop-shadow-lg rounded-full border-2 border-white" />
          </div>
        </div>
      ) : (
        <div className="bg-nwu-red rounded-xl p-6 mb-8 text-white flex justify-between items-center shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <div className="relative z-10">
            <p className="text-xs font-mono mb-1 opacity-75" data-testid="current-date">{format(new Date(), 'M/d/yyyy')}</p>
            <h1 className="text-xl md:text-3xl font-bold uppercase tracking-wide leading-tight">
              Smart Classroom: <br className="md:hidden" /> Attendance System
            </h1>
            <p className="text-nwu-gold text-xs md:text-sm font-medium tracking-wider mt-1 uppercase opacity-90">
              Institute of Computer Engineers of the Philippines-Student Edition
            </p>
          </div>
          <div className="hidden md:block flex-shrink-0 relative z-10 ml-6">
            <Image
              priority
              src="/branding/icpep_logo.png"
              alt="ICPEP.SE Logo"
              width={80}
              height={80}
              sizes="80px"
              className="h-20 w-20 object-contain drop-shadow-lg rounded-full border-2 border-white"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center mb-8 space-y-4 md:space-y-0">
        <div className="relative w-full md:w-96">
          <GlobalSearch />
        </div>
        <div className="flex items-center space-x-4 w-full md:w-auto justify-end">
          <ProfileDropdown user={user} />
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        {isSuperAdmin ? (
          <SuperAdminDashboardContent />
        ) : isActiveAdmin ? (
          <AdminDashboardContent
            profileId={profileId}
            accountInstructorIds={accountInstructorIds}
            activeTermId={activeTerm?.id}
          />
        ) : (
          <RegularDashboardContent
            profileId={profileId}
            isActiveAdmin={false}
            accountInstructorIds={[]}
            activeTermId={activeTerm?.id}
          />
        )}
      </Suspense>

    </DashboardLayout>
  );
}
