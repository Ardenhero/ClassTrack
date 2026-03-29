
# Production Deployment Guide

## 1. Prerequisites
- **Vercel Account** linked to GitHub.
- **Supabase Project** (Pro tier recommended for production).
- **Environment Variables** prepared.

## 2. Environment Variables
Configure the following in Vercel Project Settings:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (For Cron Jobs/Admin API)
```

## 3. Database Migration
Ensure all migrations are applied. Run locally:
```bash
npx supabase migration up
```
Or execute the SQL files in `supabase/migrations` via the Supabase Dashboard SQL Editor.

### Critical Tables
- `students` (with `created_at` index)
- `attendance` (with `student_id`, `date` indices)
- `room_settings` (for IoT controls - see schema below)
- `notifications` (for real-time alerts)

## 4. IoT Room Persistence Schema
If not already created, run this SQL:
```sql
create table if not exists public.room_settings (
    user_id uuid references auth.users not null primary key,
    lights boolean default false,
    fans boolean default false,
    ac boolean default false,
    updated_at timestamptz default now()
);

alter table public.room_settings enable row level security;

create policy "Users can view own settings" 
on public.room_settings for select 
using (auth.uid() = user_id);

create policy "Users can update own settings" 
on public.room_settings for update 
using (auth.uid() = user_id);

create policy "Users can insert own settings" 
on public.room_settings for insert 
with check (auth.uid() = user_id);
```

## 5. Deployment Check
1.  **Build**: Vercel will auto-build on push.
2.  **Smoke Test**: After deployment, run `scripts/smoke-test.sh` (if configured) or visit `/api/health`.
3.  **Logs**: Monitor Vercel "Runtime Logs" for any 500 errors.

## 6. Post-Launch Verification
- Log in as Admin.
- Verify "Upcoming Class" shows correct time (Manila Time).
- Test "Mark Attendance" button on an active class.
- Toggle IoT controls and refresh to ensure state persists.
