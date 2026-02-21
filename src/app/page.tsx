import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/utils/supabase/server";
import { Users, UserCheck, Clock, Plus, Calendar, BookOpen, MoreHorizontal, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { format, subDays, startOfDay } from "date-fns";
import { AttendanceChart } from "@/components/AttendanceChart";
import { IoTSwitches } from "@/components/IoTSwitches";
import { NotificationDropdown, NotificationItem } from "@/components/NotificationDropdown";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { GlobalSearch } from "@/components/GlobalSearch";
import { AddStudentDialog } from "./students/AddStudentDialog";
import { AddClassDialog } from "./classes/AddClassDialog";
import { markAttendance } from "./actions";
import { cookies } from "next/headers";
import { getProfileRole, checkIsSuperAdmin } from "@/lib/auth-utils";
import { CommandCenter } from "@/components/dashboard/super-admin/CommandCenter";
import { GatewayHealth } from "@/components/dashboard/super-admin/GatewayHealth";
import { startOfHour, endOfHour, eachHourOfInterval, subHours } from "date-fns";

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
  // This ensures RLS policies work by linking the auth.uid() to the instructor record
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (authUser?.email) {
    // Try to find an instructor with this email but NO auth_id, and link them
    const { error: updateError } = await supabase
      .from('instructors')
      .update({ auth_user_id: authUser.id })
      .eq('email', authUser.email)
      .is('auth_user_id', null);

    if (updateError) {
      console.error("Self-repair failed:", updateError);
    }
  }

  if (!profileId || !isValidProfileId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Redirecting to profile selection...</p>
      </div>
    );
  }

  // const isAdmin = await checkIsAdmin(); // Removed in favor of strict role check below

  const getManilaDate = (date: Date = new Date()) => {
    return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  };

  const nowManila = getManilaDate();
  const todayManilaStr = format(nowManila, 'yyyy-MM-dd'); // e.g., "2026-02-01"

  // STRICT DATA ISOLATION LOGIC
  // 1. Get the Active Profile's ROLE (not just a boolean check)
  const activeRole = await getProfileRole();
  const isActiveAdmin = activeRole === 'admin';
  const isSuperAdmin = await checkIsSuperAdmin();

  const { data: { user } } = await supabase.auth.getUser();

  // --- SUPER ADMIN VIEW LOGIC ---
  if (isSuperAdmin) {
    // 1. Infrastructure Status
    const { count: activeDepartments } = await supabase
      .from('departments')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: instructorCount } = await supabase
      .from('instructors')
      .select('*', { count: 'exact', head: true });

    const { count: totalStudents } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    // Active Sessions (Distinct classes with activity in last 2 hours)
    const twoHoursAgo = subHours(new Date(), 2).toISOString();
    const { data: activeSessionsData } = await supabase
      .from('attendance_logs')
      .select('class_id', { count: 'exact' })
      .gte('timestamp', twoHoursAgo);
    const activeSessions = new Set(activeSessionsData?.map(s => s.class_id)).size;

    const stats = {
      activeDepartments: activeDepartments || 0,
      totalPopulation: (instructorCount || 0) + (totalStudents || 0),
      activeSessions: activeSessions || 0,
      isOperational: true // If we are here, DB is up
    };

    // 2. Traffic Analytics (Check-ins per hour for last 24h)
    const dayAgo = subHours(new Date(), 24).toISOString();
    const { data: trafficLogs } = await supabase
      .from('attendance_logs')
      .select('timestamp')
      .gte('timestamp', dayAgo);

    const hours = eachHourOfInterval({
      start: subHours(new Date(), 23),
      end: new Date()
    });

    const trafficData = hours.map(hour => {
      const hStart = startOfHour(hour);
      const hEnd = endOfHour(hour);
      const count = trafficLogs?.filter(l => {
        const d = new Date(l.timestamp);
        return d >= hStart && d <= hEnd;
      }).length || 0;
      return {
        hour: format(hour, 'ha'),
        count
      };
    });

    // 3. Security Audit Feed
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*, instructor:actor_id(name)')
      .order('created_at', { ascending: false })
      .limit(10);

    // 4. Notifications (Super Admin sees all system alerts — last 24h only)
    const superAdminOneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: systemNotifs } = await supabase
      .from('notifications')
      .select('*')
      .gte('created_at', superAdminOneDayAgo)
      .not('title', 'in', '("Class Started","Upcoming Class","Class Ended")') // Exclude class updates
      .order('created_at', { ascending: false })
      .limit(5);

    return (
      <DashboardLayout>
        {/* Header (Shared) */}
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
            <Image src="/branding/icpep_logo.png" alt="ICPEP Logo" width={80} height={80} className="h-20 w-20 object-contain drop-shadow-lg rounded-full border-2 border-white" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-8 space-y-4 md:space-y-0">
          <div className="relative w-full md:w-96">
            <GlobalSearch />
          </div>
          <div className="flex items-center space-x-4 w-full md:w-auto justify-end">
            <NotificationDropdown notifications={systemNotifs || []} />
            <ProfileDropdown user={user} />
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">University Pulse</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time infrastructure health and security audit</p>
        </div>

        <CommandCenter stats={stats} logs={auditLogs || []} trafficData={trafficData} />

        {/* IoT Infrastructure Health */}
        <div className="mt-6">
          <GatewayHealth />
        </div>
      </DashboardLayout>
    );
  }

  // --- REGULAR DASHBOARD LOGIC (Original) ---

  // 0. Determine Account Scope (for System Admins)
  let accountInstructorIds: string[] = [];

  if (isActiveAdmin && profileId) {
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

  // 1. Fetch Summary Stats
  // Students
  let studentCount = 0;

  if (isActiveAdmin) {
    if (accountInstructorIds.length > 0) {
      // 1. Created by account instructors
      const { data: createdIds } = await supabase.from('students').select('id').in('instructor_id', accountInstructorIds);
      // 2. Enrolled in account instructors' classes
      const { data: enrolledIds } = await supabase.from('enrollments').select('student_id, classes!inner(instructor_id)').in('classes.instructor_id', accountInstructorIds);

      const uniqueIds = new Set([
        ...(createdIds?.map(s => s.id) || []),
        ...(enrolledIds?.map(e => e.student_id) || [])
      ]);
      studentCount = uniqueIds.size;
    }
  } else if (profileId) {
    // Instructor: Get unique students (created by them OR enrolled in their classes)
    const uniqueStudentIds = new Set<string>();

    // Get students created by this instructor
    const { data: createdStudents } = await supabase
      .from('students')
      .select('id')
      .eq('instructor_id', profileId);
    createdStudents?.forEach(s => uniqueStudentIds.add(s.id));

    // Get students enrolled in this instructor's classes
    const { data: enrolledData } = await supabase
      .from('enrollments')
      .select('student_id, classes!inner(instructor_id)')
      .eq('classes.instructor_id', profileId);
    enrolledData?.forEach(e => uniqueStudentIds.add(e.student_id));

    studentCount = uniqueStudentIds.size;
  }

  // Classes
  let classQuery = supabase.from('classes').select('*', { count: 'exact', head: true });
  if (isActiveAdmin) {
    if (accountInstructorIds.length > 0) {
      // STRICT SCOPING: Only count classes from managed instructors
      classQuery = classQuery.in('instructor_id', accountInstructorIds);
    } else {
      // If no managed instructors, count should be 0 (don't show admin's own classes if they erroneously have any)
      classQuery = classQuery.eq('instructor_id', '00000000-0000-0000-0000-000000000000'); // Valid UUID format but dummy
    }
  } else if (profileId) {
    classQuery = classQuery.eq('instructor_id', profileId);
  }
  const { count: classCount } = await classQuery;

  // 2. Fetch Weekly Logs
  const today = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    return {
      date: d,
      day: format(d, 'EEE'), // Mon, Tue...
      label: format(d, 'MMM dd'),
      count: 0
    };
  });

  const weekStart = startOfDay(last7Days[0].date).toISOString();

  let weekLogsQuery = supabase
    .from('attendance_logs')
    .select('timestamp, status, classes!inner(instructor_id)')
    .eq('status', 'Present')
    .gte('timestamp', weekStart);

  if (isActiveAdmin && accountInstructorIds.length > 0) {
    weekLogsQuery = weekLogsQuery.in('classes.instructor_id', accountInstructorIds);
  } else if (!isActiveAdmin && profileId) {
    weekLogsQuery = weekLogsQuery.eq('classes.instructor_id', profileId);
  }

  const { data: weekLogs } = await weekLogsQuery;

  // Aggregate logs
  weekLogs?.forEach(log => {
    const logDate = new Date(log.timestamp).toDateString();
    const dayStat = last7Days.find(d => d.date.toDateString() === logDate);
    if (dayStat) {
      dayStat.count++;
    }
  });

  // 3. Today's stats
  const todayStartStr = startOfDay(nowManila).toISOString();
  // Filter locally since weekLogs is already filtered
  const todaysLogs = weekLogs?.filter(l => l.timestamp >= todayStartStr) || [];
  const presentCount = todaysLogs.length;

  let lateQuery = supabase
    .from('attendance_logs')
    .select('*, classes!inner(instructor_id)', { count: 'exact', head: true })
    .eq('status', 'Late')
    .gte('timestamp', todayStartStr);

  if (isActiveAdmin && accountInstructorIds.length > 0) {
    lateQuery = lateQuery.in('classes.instructor_id', accountInstructorIds);
  } else if (!isActiveAdmin && profileId) {
    lateQuery = lateQuery.eq('classes.instructor_id', profileId);
  }

  const { count: lateCount } = await lateQuery;

  // 4. Fetch Recent Students
  const fiveDaysAgo = subDays(today, 5).toISOString();
  let recentStudentQuery = supabase.from('students')
    .select('*')
    .gte('created_at', fiveDaysAgo)
    .limit(5)
    .order('created_at', { ascending: false });

  if (isActiveAdmin && accountInstructorIds.length > 0) {
    recentStudentQuery = recentStudentQuery.in('instructor_id', accountInstructorIds);
  } else if (!isActiveAdmin && profileId) {
    recentStudentQuery = recentStudentQuery.eq('instructor_id', profileId);
  }

  if (query) {
    recentStudentQuery = recentStudentQuery.ilike('name', `%${query}%`);
  }
  const { data: recentStudents } = await recentStudentQuery;

  // 5. Fetch Classes
  let classesListQuery = supabase
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50); // Get enough classes to filter

  if (isActiveAdmin && accountInstructorIds.length > 0) {
    classesListQuery = classesListQuery.in('instructor_id', accountInstructorIds);
  } else if (!isActiveAdmin && profileId) {
    classesListQuery = classesListQuery.eq('instructor_id', profileId);
  }

  const { data: classes } = await classesListQuery;


  const upcomingClasses = classes?.map(c => {
    if (!c.start_time || !c.end_time) return null;

    // Construct class dates relative to Manila "Today"
    const startString = `${todayManilaStr}T${c.start_time}`;

    const start = new Date(startString);

    // Filter Logic:
    // 1. Attendance Window: Opens 15 mins BEFORE start, closes 30 mins AFTER start.
    // 2. Upcoming: starts within 1 hour.

    const attendanceOpen = new Date(start.getTime() - 15 * 60 * 1000); // 15 mins before
    const attendanceClose = new Date(start.getTime() + 30 * 60 * 1000); // 30 mins after start

    let status = 'hidden';
    const timeDiffMs = start.getTime() - nowManila.getTime();
    const oneHourMs = 60 * 60 * 1000;

    // "Live" means actionable/markable
    if (nowManila >= attendanceOpen && nowManila <= attendanceClose) {
      status = 'live';
    } else if (nowManila < attendanceOpen && timeDiffMs <= oneHourMs) {
      status = 'upcoming';
    } else if (nowManila > attendanceClose) {
      status = 'completed';
    }

    if (status === 'hidden' || status === 'completed') return null;

    return { ...c, status, startTimeObj: start };
  }).filter(Boolean)
    .sort((a, b) => (a?.startTimeObj?.getTime() || 0) - (b?.startTimeObj?.getTime() || 0)) || [];

  const activeOrNextClass = upcomingClasses[0];

  // --- NOTIFICATIONS ---
  // Lazy Trigger: Check for Class Alerts
  if (user) {
    const activeClasses = upcomingClasses.filter(c => c && (c.status === 'live' || c.status === 'upcoming' || c.status === 'completed'));

    for (const c of activeClasses) {
      if (!c) continue;
      const noteTitle = c.status === 'live' ? 'Class Started' : (c.status === 'upcoming' ? 'Upcoming Class' : 'Class Ended');
      const noteMsg = c.status === 'live'
        ? `${c.name} has started.`
        : (c.status === 'upcoming' ? `${c.name} is starting soon.` : `${c.name} has ended.`);

      // Simple deduplication check: check if we already have a notification for this title/message today
      // Note: Ideally we'd store a reference ID, but for now exact title/message match on today is rough enough.
      const todayStart = startOfDay(new Date()).toISOString();
      const { data: existing } = await supabase.from('notifications')
        .select('id')
        .eq('instructor_id', profileId) // Strict check
        .eq('title', noteTitle)
        .eq('message', noteMsg)
        .gte('created_at', todayStart)
        .single();

      if (!existing) {
        await supabase.from("notifications").insert({
          user_id: user.id,
          instructor_id: profileId, // Link to Profile
          title: noteTitle,
          message: noteMsg,
          type: "info",
          read: false,
        });
      }
    }
  }

  // Fetch Real Notifications ( STRICT ISOLATION — last 24h only )
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
    // Fallback for admin-profile or undefined
    notifQuery = notifQuery.eq('user_id', user?.id);
  }

  const { data: notificationsData } = await notifQuery;

  const notifications: NotificationItem[] = notificationsData?.map(n => ({
    ...n,
    timestamp: n.created_at // Map created_at to timestamp for UI if needed, but UI uses created_at now
  })) || [];

  return (
    <DashboardLayout>

      {/* Header Section */}
      <div className="bg-nwu-red rounded-xl p-6 mb-8 text-white flex justify-between items-center shadow-md relative overflow-hidden">
        {/* Decorative Background Element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

        {/* Text Content */}
        <div className="relative z-10">
          <p className="text-xs font-mono mb-1 opacity-75" data-testid="current-date">{format(new Date(), 'M/d/yyyy')}</p>
          <h1 className="text-xl md:text-3xl font-bold uppercase tracking-wide leading-tight">
            Smart Classroom: <br className="md:hidden" /> Attendance System
          </h1>
          <p className="text-nwu-gold text-xs md:text-sm font-medium tracking-wider mt-1 uppercase opacity-90">
            Institute of Computer Engineers of the Philippines-Student Edition
          </p>
        </div>

        {/* Right Logo: ICPEP */}
        <div className="hidden md:block flex-shrink-0 relative z-10 ml-6">
          <Image
            src="/branding/icpep_logo.png"
            alt="ICPEP Logo"
            width={80}
            height={80}
            className="h-20 w-20 object-contain drop-shadow-lg rounded-full border-2 border-white"
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center mb-8 space-y-4 md:space-y-0">
        <div className="relative w-full md:w-96">
          {/* Global Search with Suggestions */}
          <GlobalSearch />
        </div>

        <div className="flex items-center space-x-4 w-full md:w-auto justify-end">
          <NotificationDropdown notifications={notifications} />

          <ProfileDropdown user={user} />
        </div>
      </div>

      {/* Hero / Dashboard Title */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of your classes and student attendance</p>
        </div>
        <div className="flex space-x-3">
          <AddClassDialog
            trigger={
              <button className="flex items-center px-4 py-2 bg-nwu-red text-white rounded-xl hover:bg-red-700 transition-colors shadow-sm text-sm font-medium">
                <Plus className="h-4 w-4 mr-2" />
                Create Class
              </button>
            }
          />
          <Link href="/students" className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm text-sm font-medium">
            Manage Students
          </Link>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-nwu-red rounded-3xl p-6 text-white relative overflow-hidden shadow-lg transform hover:scale-[1.02] transition-transform">
          <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
            <BookOpen className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <p className="font-medium text-white/80">Total Classes</p>
              <div className="p-2 bg-white/20 rounded-full">
                <BookOpen className="h-4 w-4" />
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-2">{classCount || 0}</h2>
            <div className="inline-flex items-center px-2 py-1 bg-white/20 rounded-lg text-xs font-medium">
              <span className="mr-1">↑</span> Active this semester
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Students</p>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{studentCount || 0}</h2>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full text-gray-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Enrolled across all years</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Present Today</p>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{presentCount}</h2>
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-full text-green-600 dark:text-green-400">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-2 bg-green-50 dark:bg-green-900/20 inline-block px-2 py-1 rounded w-max">
            {studentCount ? Math.round((presentCount / studentCount) * 100) : 0}% Attendance Rate
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Pending/Late</p>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{lateCount || 0}</h2>
            </div>
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-full text-yellow-600 dark:text-yellow-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Students marked late today</p>
        </div>
      </div>

      {/* Middle Section: Analytics & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Analytics Chart */}
        <div className="lg:col-span-2 h-full">
          <AttendanceChart
            data={last7Days.map(d => ({ day: d.day, count: d.count, date: d.label }))}
          />
        </div>

        {/* Reminders / Next Class */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Upcoming Class</h3>
            <Link href="/classes">
              <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal className="h-5 w-5" /></button>
            </Link>
          </div>

          <div className="space-y-4 flex-1">
            {activeOrNextClass ? (
              <div className={`p-4 rounded-2xl border ${activeOrNextClass.status === 'live' ? 'bg-nwu-red/5 border-nwu-red/20' : 'bg-gray-50 dark:bg-gray-700 border-gray-100 dark:border-gray-600'}`} data-testid="upcoming-class">
                <div className="flex items-start">
                  <div className={`p-2 rounded-lg shadow-sm mr-3 ${activeOrNextClass.status === 'live' ? 'bg-nwu-red text-white' : 'bg-white dark:bg-gray-600 text-nwu-red'}`}>
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{activeOrNextClass.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span data-testid="upcoming-class-time">{activeOrNextClass.startTimeObj ? format(activeOrNextClass.startTimeObj, 'h:mm a') : 'TBD'}</span>
                      {' - '}
                      {/* end time object wasn't passed, let's fix that or parse it on fly relative to start */}
                      {activeOrNextClass.end_time ? format(new Date(`${todayManilaStr}T${activeOrNextClass.end_time}`), 'h:mm a') : 'TBD'}
                    </p>
                    {activeOrNextClass.status === 'live' && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full animate-pulse">
                        LIVE NOW
                      </span>
                    )}
                  </div>
                </div>
                <Link href={`/classes/${activeOrNextClass.id}`} className="block w-full mt-4">
                  <button className={`w-full py-2.5 rounded-xl text-xs font-medium transition-colors ${activeOrNextClass.status === 'live'
                    ? 'bg-nwu-red text-white hover:bg-red-700'
                    : 'bg-gray-900 dark:bg-gray-900 text-white hover:bg-gray-800'
                    }`}>
                    {activeOrNextClass.status === 'live' ? 'View Live Class' : 'Prepare Class'}
                  </button>
                </Link>

                {activeOrNextClass.status === 'live' && (
                  <form action={async () => {
                    "use server";
                    await markAttendance(activeOrNextClass.id);
                  }} className="mt-2">
                    <button className="w-full py-2.5 rounded-xl text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm">
                      Mark Attendance
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-700 rounded-2xl border border-dashed border-gray-200 dark:border-gray-600" data-testid="upcoming-class">
                <p className="text-sm">No classes scheduled.</p>
              </div>
            )}
            {/* Other tasks */}
            <div className="pt-2 space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tasks</p>
              <div className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer group">
                <div className="h-2 w-2 rounded-full bg-orange-400 mr-3 group-hover:scale-125 transition-transform"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Check hardware status</p>
                  <p className="text-xs text-gray-400">Daily Check</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Students List */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">New Students</h3>
            <Link href="/students">
              <button className="px-3 py-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center group">
                View All
                <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </Link>
          </div>

          <div className="space-y-4">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {recentStudents?.map((student: any) => (
              <div key={student.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-nwu-red/10 rounded-full flex items-center justify-center text-nwu-red font-bold text-sm mr-4">
                    {student.name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{student.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-left">{student.year_level}</p>
                  </div>
                </div>
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Active
                </div>
              </div>
            ))}
            {(!recentStudents || recentStudents.length === 0) && (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No recent students {query ? "matching search" : "found"}.</p>
                <AddStudentDialog
                  trigger={
                    <button className="text-nwu-red text-xs font-medium hover:underline mt-1 inline-block">
                      Add your first student
                    </button>
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* IoT Switches */}
        <IoTSwitches />
      </div>
      {/* Content was previously wrapped here */}
    </DashboardLayout>
  );
}
