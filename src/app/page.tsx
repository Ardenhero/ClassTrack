import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/utils/supabase/server";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { format } from "date-fns";
import { NotificationDropdown, NotificationItem } from "@/components/NotificationDropdown";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { GlobalSearch } from "@/components/GlobalSearch";
import { cookies } from "next/headers";
import { getProfileRole, checkIsSuperAdmin } from "@/lib/auth-utils";
import { Suspense } from "react";
import SuperAdminDashboardContent from "@/components/dashboard/super-admin/SuperAdminDashboardContent";
import RegularDashboardContent from "@/components/dashboard/RegularDashboardContent";

function DashboardSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-nwu-red" />
      <p className="text-gray-500 text-sm animate-pulse">Loading dashboard data...</p>
    </div>
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams?: {
    query?: string;
  };
}) {
  const query = searchParams?.query || "";
  const supabase = createClient();
  const cookieStore = cookies();
  const profileId = cookieStore.get("sc_profile_id")?.value;

  // Validate Profile ID to prevent DB crashes and ensure security
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValidProfileId = profileId && (uuidRegex.test(profileId) || profileId === 'admin-profile');

  // SELF-REPAIR: Link Auth User to Instructor Profile
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (authUser?.email) {
    await supabase
      .from('instructors')
      .update({ auth_user_id: authUser.id })
      .eq('email', authUser.email)
      .is('auth_user_id', null);
  }

  if (!profileId || !isValidProfileId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Redirecting to profile selection...</p>
      </div>
    );
  }

  // STRICT DATA ISOLATION LOGIC
  const activeRole = await getProfileRole();
  const isActiveAdmin = activeRole === 'admin';
  const isSuperAdmin = await checkIsSuperAdmin();

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch Real Notifications ( STRICT ISOLATION — last 24h only )
  // We keep this in the main frame because the Dropdown is in the layout header
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let notifQuery = supabase
    .from('notifications')
    .select('*')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  if (profileId && isValidProfileId && profileId !== 'admin-profile') {
    notifQuery = notifQuery.eq('instructor_id', profileId);
  } else {
    notifQuery = notifQuery.eq('user_id', user?.id);
  }

  const { data: notificationsData } = await notifQuery;
  const notifications: NotificationItem[] = notificationsData?.map(n => ({
    ...n,
    timestamp: n.created_at
  })) || [];

  let accountInstructorIds: string[] = [];
  if (isActiveAdmin && profileId && !isSuperAdmin) {
    const { data: adminRecord } = await supabase
      .from('instructors')
      .select('auth_user_id')
      .eq('id', profileId)
      .single();

    if (adminRecord?.auth_user_id) {
      const { data: accountInstructors } = await supabase
        .from('instructors')
        .select('id')
        .eq('auth_user_id', adminRecord.auth_user_id);
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
            <Image priority src="/branding/icpep_logo.png" alt="ICPEP Logo" width={80} height={80} className="h-20 w-20 object-contain drop-shadow-lg rounded-full border-2 border-white" />
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
              alt="ICPEP Logo"
              width={80}
              height={80}
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
          <NotificationDropdown notifications={notifications} />
          <ProfileDropdown user={user} />
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        {isSuperAdmin ? (
          <SuperAdminDashboardContent />
        ) : (
          <RegularDashboardContent
            profileId={profileId}
            isActiveAdmin={isActiveAdmin}
            accountInstructorIds={accountInstructorIds}
            query={query}
          />
        )}
      </Suspense>

    </DashboardLayout>
  );
}
