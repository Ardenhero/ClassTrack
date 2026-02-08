# ClassTrack Admin Data Visibility - Diagnostic Guide

## Problem
Admin profile cannot view student attendance records and other data from different user profiles.

## Step-by-Step Diagnosis

### Phase 1: Verify Admin User Setup

#### 1.1 Check if admin role exists in database
Open Supabase SQL Editor and run:

```sql
-- Check your profiles table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';

-- Check if admin user has correct role
SELECT id, email, role, created_at 
FROM profiles 
WHERE role = 'admin';
```

**Expected Result:** You should see a `role` column and at least one user with `role = 'admin'`

**If no admin exists:** You need to update a user to admin:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-admin-email@example.com';
```

---

### Phase 2: Check Row Level Security (RLS) Policies

#### 2.1 View all RLS policies
```sql
-- See all policies on your tables
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

#### 2.2 Check specific table policies
For each critical table (profiles, attendance, classes, students), check:

```sql
-- Example for attendance table
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'attendance';
```

**Common Issue:** RLS policies that don't account for admin role.

**Fix Example - Attendance Table:**
```sql
-- Drop old restrictive policy
DROP POLICY IF EXISTS "Users can view own attendance" ON attendance;

-- Create new policy allowing admins to see all
CREATE POLICY "Enable read access for authenticated users"
ON attendance FOR SELECT
TO authenticated
USING (
  -- Either the user owns the record OR user is admin
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
```

---

### Phase 3: Check Frontend Data Queries

#### 3.1 Locate admin dashboard files
Common locations in Next.js apps:
- `/src/app/admin/page.tsx` or `/src/app/admin/dashboard/page.tsx`
- `/src/app/(dashboard)/admin/page.tsx`
- `/src/components/admin/` directory

#### 3.2 Check query logic
Look for Supabase queries that might filter data incorrectly:

**❌ Bad Pattern (restricts admin):**
```typescript
const { data: attendance } = await supabase
  .from('attendance')
  .select('*')
  .eq('user_id', session.user.id); // This filters even for admin!
```

**✅ Good Pattern (admin sees all):**
```typescript
const { data: userProfile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', session.user.id)
  .single();

const isAdmin = userProfile?.role === 'admin';

let query = supabase
  .from('attendance')
  .select('*, students(*), classes(*)');

if (!isAdmin) {
  query = query.eq('user_id', session.user.id);
}

const { data: attendance } = await query;
```

---

### Phase 4: Check API Routes

#### 4.1 Locate API endpoints
Check these directories:
- `/src/app/api/attendance/route.ts`
- `/src/app/api/students/route.ts`
- `/src/app/api/admin/route.ts`

#### 4.2 Verify authentication & authorization
Look for:

**❌ Bad - No admin check:**
```typescript
export async function GET(request: Request) {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  
  // Only gets current user's data
  const attendance = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', data.user?.id);
    
  return Response.json(attendance);
}
```

**✅ Good - Admin bypass:**
```typescript
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  let query = supabase
    .from('attendance')
    .select('*, students(*), classes(*)');
  
  // Only filter if not admin
  if (profile?.role !== 'admin') {
    query = query.eq('user_id', user.id);
  }
  
  const { data: attendance, error } = await query;
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  return Response.json(attendance);
}
```

---

### Phase 5: Database Relationships & Permissions

#### 5.1 Check foreign key relationships
```sql
-- Verify table relationships
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public';
```

#### 5.2 Verify join policies
If using joins, ensure RLS allows reading joined tables:

```sql
-- Check if admin can read students table
CREATE POLICY "Admins can view all students"
ON students FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
```

---

## Complete Fix Template

Here's a complete set of RLS policies for your main tables:

### For `profiles` table:
```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);
```

### For `attendance` table:
```sql
-- Enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Users can view their own attendance records
CREATE POLICY "Users can view own attendance"
ON attendance FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all attendance records
CREATE POLICY "Admins can view all attendance"
ON attendance FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Users can create their own attendance
CREATE POLICY "Users can create own attendance"
ON attendance FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can create any attendance
CREATE POLICY "Admins can create any attendance"
ON attendance FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
```

### For `students` table:
```sql
-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Users can view their own students
CREATE POLICY "Users can view own students"
ON students FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all students
CREATE POLICY "Admins can view all students"
ON students FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Similar for INSERT, UPDATE, DELETE
```

### For `classes` table:
```sql
-- Enable RLS
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Users can view their own classes
CREATE POLICY "Users can view own classes"
ON classes FOR SELECT
TO authenticated
USING (auth.uid() = teacher_id OR teacher_id IS NULL);

-- Admins can view all classes
CREATE POLICY "Admins can view all classes"
ON classes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
```

---

## Testing Checklist

After implementing fixes:

- [ ] Log in as admin user
- [ ] Navigate to dashboard/admin page
- [ ] Verify you can see ALL student records (not just your own)
- [ ] Verify you can see ALL attendance records
- [ ] Verify you can see ALL classes
- [ ] Check browser console for errors
- [ ] Check Network tab for failed API calls
- [ ] Test with a non-admin user to ensure they only see their own data

---

## Debugging Commands

### Check current user's role in browser console:
```javascript
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();
console.log('Current user role:', profile.role);
```

### Test data access:
```javascript
// Try to fetch all attendance
const { data, error } = await supabase
  .from('attendance')
  .select('*');
  
if (error) {
  console.error('Error:', error.message);
} else {
  console.log('Records accessible:', data.length);
}
```

---

## Next Steps

1. **Start with Phase 1** - Verify admin role exists
2. **Run Phase 2 queries** - Check and fix RLS policies
3. **Review Phase 3** - Check frontend code
4. **If still broken** - Review Phase 4 API routes
5. **Apply Complete Fix Template** if needed
6. **Test thoroughly** using the checklist

---

## Need More Help?

Share the output of:
1. The SQL query from Phase 2.1 (all your RLS policies)
2. Your admin dashboard page code
3. Any error messages from browser console or Supabase logs
