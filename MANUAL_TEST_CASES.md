# ClassTrack — Manual Test Cases

> Northwestern University Smart Classroom Attendance System
> Comprehensive test cases for every feature, organized by role.
> Last Updated: February 2026

---

## Table of Contents

1. [Authentication & Login](#1-authentication--login)
2. [Profile Selection](#2-profile-selection)
3. [Super Admin Test Cases](#3-super-admin-test-cases)
4. [System Admin Test Cases](#4-system-admin-test-cases)
5. [Instructor Test Cases](#5-instructor-test-cases)
6. [Student Portal Test Cases](#6-student-portal-test-cases)
7. [Shared / Cross-Role Test Cases](#7-shared--cross-role-test-cases)
8. [Production Hardening Test Cases](#8-production-hardening-test-cases)
9. [API & IoT Test Cases](#9-api--iot-test-cases)

---

## 1. Authentication & Login

### TC-AUTH-01: Admin/Instructor Login with Email & Password

| Field | Detail |
|-------|--------|
| **Precondition** | Valid account exists and is approved |
| **Steps** | 1. Navigate to `/login` <br> 2. Enter email in the Email field <br> 3. Enter password in the Password field <br> 4. Click "Sign In" |
| **Expected** | User is redirected to `/select-profile` if multiple profiles exist, or directly to the Dashboard |

### TC-AUTH-02: Login with Invalid Credentials

| Field | Detail |
|-------|--------|
| **Precondition** | None |
| **Steps** | 1. Navigate to `/login` <br> 2. Enter a wrong email or password <br> 3. Click "Sign In" |
| **Expected** | Error message "Invalid login credentials" displayed. User stays on login page. |

### TC-AUTH-03: Login with Locked Account

| Field | Detail |
|-------|--------|
| **Precondition** | Super Admin has locked the account via Admin Provisioning |
| **Steps** | 1. Navigate to `/login` <br> 2. Enter locked account credentials <br> 3. Click "Sign In" |
| **Expected** | Login is blocked. Error message displayed. User cannot access dashboard. |

### TC-AUTH-04: Login with Pending Approval Account

| Field | Detail |
|-------|--------|
| **Precondition** | Account created via signup but not yet approved by admin |
| **Steps** | 1. Navigate to `/login` <br> 2. Enter pending account credentials <br> 3. Click "Sign In" |
| **Expected** | User is redirected to `/pending-approval` page with info message. |

### TC-AUTH-05: Account Signup

| Field | Detail |
|-------|--------|
| **Precondition** | None |
| **Steps** | 1. Navigate to `/login` <br> 2. Click "Sign Up" tab <br> 3. Enter email and password <br> 4. Click "Sign Up" |
| **Expected** | Account is created. User sees confirmation or is redirected to `/pending-approval`. |

### TC-AUTH-06: Logout

| Field | Detail |
|-------|--------|
| **Precondition** | User is logged in |
| **Steps** | 1. Click "Log Out" in the sidebar <br> 2. Confirm if prompted |
| **Expected** | Session cleared. User redirected to `/login`. Cannot access dashboard without re-authentication. |

---

## 2. Profile Selection

### TC-PROF-01: Netflix-Style Profile Selector

| Field | Detail |
|-------|--------|
| **Precondition** | Account has multiple instructor profiles linked |
| **Steps** | 1. Log in successfully <br> 2. Observe the `/select-profile` page <br> 3. Click on one of the profile cards |
| **Expected** | Profile cards displayed with names and avatars. Clicking a profile sets `sc_profile_id` cookie and redirects to dashboard. |

### TC-PROF-02: PIN-Protected Profile Access

| Field | Detail |
|-------|--------|
| **Precondition** | Profile has a PIN code set |
| **Steps** | 1. Navigate to `/select-profile` <br> 2. Click the PIN-protected profile <br> 3. Enter the correct PIN <br> 4. Click "Unlock" |
| **Expected** | PIN prompt appears. Correct PIN grants access. Wrong PIN shows error. |

### TC-PROF-03: Set / Change PIN on Profile

| Field | Detail |
|-------|--------|
| **Precondition** | Logged in and viewing `/profile` page |
| **Steps** | 1. Navigate to `/profile` <br> 2. Find the PIN Management section <br> 3. Enter a new PIN or change existing <br> 4. Save changes |
| **Expected** | PIN is saved. Next login requires PIN for this profile. |

---

## 3. Super Admin Test Cases

### 3.1 Dashboard

#### TC-SA-DASH-01: View Command Center Dashboard

| Field | Detail |
|-------|--------|
| **Precondition** | Logged in as Super Admin |
| **Steps** | 1. Navigate to the dashboard |
| **Expected** | Dashboard titled "Command Center Infrastructure" with cards: Active Departments, Total Population, Active Sessions, System Operational. Traffic Analytics heatmap and Security Audit Feed visible. |

#### TC-SA-DASH-02: Security Audit Feed Displays Recent Actions

| Field | Detail |
|-------|--------|
| **Precondition** | Audit log entries exist in the system |
| **Steps** | 1. View dashboard as Super Admin <br> 2. Scroll to the Security Audit Feed section |
| **Expected** | Last 10 audit log entries displayed with who, what, when, and target details. |

#### TC-SA-DASH-03: Gateway Health Panel

| Field | Detail |
|-------|--------|
| **Precondition** | IoT devices registered in the system |
| **Steps** | 1. View dashboard as Super Admin <br> 2. Check the Gateway Health section |
| **Expected** | Tuya Cloud connectivity status, device counts by type, and error states displayed. |

---

### 3.2 Admin Provisioning

#### TC-SA-PROV-01: Provision a New Admin

| Field | Detail |
|-------|--------|
| **Precondition** | Super Admin logged in, at least one department exists |
| **Steps** | 1. Navigate to `/dashboard/admin/provisioning` <br> 2. Fill in full name, email <br> 3. Select a department <br> 4. Click "Provision Admin" |
| **Expected** | New admin account created with auto-generated password. Credentials displayed in a copy-once card. New admin appears in the admin list. |

#### TC-SA-PROV-02: Lock an Admin Account

| Field | Detail |
|-------|--------|
| **Precondition** | Admin exists and is unlocked |
| **Steps** | 1. Navigate to `/dashboard/admin/provisioning` <br> 2. Find the target admin <br> 3. Click the "Lock" button |
| **Expected** | Admin status changes to "Locked". Locked admin cannot log in until unlocked. |

#### TC-SA-PROV-03: Unlock an Admin Account

| Field | Detail |
|-------|--------|
| **Precondition** | Admin exists and is locked |
| **Steps** | 1. Navigate to `/dashboard/admin/provisioning` <br> 2. Find the locked admin <br> 3. Click the "Unlock" button |
| **Expected** | Admin status changes to active. Admin can log in again. |

#### TC-SA-PROV-04: Reassign Admin to Different Department

| Field | Detail |
|-------|--------|
| **Precondition** | Multiple departments exist |
| **Steps** | 1. Navigate to admin provisioning <br> 2. Find admin <br> 3. Change department dropdown <br> 4. Save |
| **Expected** | Admin's department updated. Their data scope changes accordingly. |

---

### 3.3 Department Management

#### TC-SA-DEPT-01: Create a Department

| Field | Detail |
|-------|--------|
| **Precondition** | Super Admin logged in |
| **Steps** | 1. Navigate to `/dashboard/admin/departments` <br> 2. Click "Create Department" <br> 3. Enter name, code, and description <br> 4. Submit |
| **Expected** | New department card appears with the entered details. |

#### TC-SA-DEPT-02: Freeze a Department

| Field | Detail |
|-------|--------|
| **Precondition** | Active department exists |
| **Steps** | 1. Navigate to departments page <br> 2. Click "Freeze" on a department card |
| **Expected** | Department shows "Frozen" status. Users in that department are blocked from accessing the system (enforced by middleware). |

#### TC-SA-DEPT-03: Unfreeze a Department

| Field | Detail |
|-------|--------|
| **Precondition** | Frozen department exists |
| **Steps** | 1. Navigate to departments page <br> 2. Click "Unfreeze" on the frozen department |
| **Expected** | Department returns to active status. Users regain access. |

#### TC-SA-DEPT-04: Delete a Department

| Field | Detail |
|-------|--------|
| **Precondition** | Department exists |
| **Steps** | 1. Navigate to departments page <br> 2. Click "Delete" on the target department <br> 3. Confirm deletion |
| **Expected** | Department removed. All associated data cascade-deleted or reassigned. |

---

### 3.4 Super Admin Read-Only Mode

#### TC-SA-RO-01: Classes Page Shows Read-Only

| Field | Detail |
|-------|--------|
| **Precondition** | Super Admin logged in |
| **Steps** | 1. Navigate to `/classes` |
| **Expected** | All classes visible across departments. "Read-Only Mode" badge shown. No "Add Class" button. Cannot edit or delete classes. |

#### TC-SA-RO-02: Students Page Shows Read-Only

| Field | Detail |
|-------|--------|
| **Precondition** | Super Admin logged in |
| **Steps** | 1. Navigate to `/students` |
| **Expected** | All students visible. "Read-Only Mode" badge shown. No "Add Student" button. Cannot edit or delete students. |

---

### 3.5 API Key Management (Production Hardening)

#### TC-SA-KEY-01: Generate a New API Key

| Field | Detail |
|-------|--------|
| **Precondition** | Super Admin logged in |
| **Steps** | 1. Navigate to `/dashboard/admin/api-keys` <br> 2. Enter key name (e.g., "Room 201 Kiosk") <br> 3. Select device type (Kiosk / Tuya / ESP32) <br> 4. Click "Generate Key" |
| **Expected** | Raw API key shown in green success banner (format: `ct_XXXXXXX...`). Copy button available. Warning: "This key will be hidden once you dismiss." |

#### TC-SA-KEY-02: API Key One-Time Display

| Field | Detail |
|-------|--------|
| **Precondition** | API key just generated (success banner visible) |
| **Steps** | 1. Copy the key using the copy button <br> 2. Click "I've copied it — dismiss" |
| **Expected** | Raw key disappears permanently. Key list shows only masked prefix (e.g., `ct_ABcD1234...`). Key cannot be retrieved again. |

#### TC-SA-KEY-03: Revoke an API Key

| Field | Detail |
|-------|--------|
| **Precondition** | Active API key exists |
| **Steps** | 1. Navigate to API Keys page <br> 2. Click the shield/revoke icon on an active key |
| **Expected** | Key status changes to "Revoked" with red badge. Key can no longer be used for API authentication. |

#### TC-SA-KEY-04: Delete a Revoked API Key

| Field | Detail |
|-------|--------|
| **Precondition** | Revoked API key exists |
| **Steps** | 1. Navigate to API Keys page <br> 2. Find a revoked key (red "Revoked" badge) <br> 3. Click the trash icon next to it <br> 4. Confirm deletion |
| **Expected** | Key permanently removed from the list. Cannot be restored. |

---

### 3.7 Security Panel

#### TC-SA-SEC-01: Reset Admin Password (Flexible — No Restrictions)

| Field | Detail |
|-------|--------|
| **Precondition** | Super Admin logged in |
| **Steps** | 1. Navigate to `/dashboard/admin/security` <br> 2. Select a target user from the dropdown <br> 3. Enter any new password (e.g., all lowercase "hello") <br> 4. Click "Reset Password" |
| **Expected** | Password reset succeeds regardless of format. No complexity requirements enforced. Remaining monthly reset count shown. |

#### TC-SA-SEC-02: Reset PIN

| Field | Detail |
|-------|--------|
| **Precondition** | Target instructor has a PIN set |
| **Steps** | 1. Navigate to Security Panel <br> 2. Select the instructor <br> 3. Click "Reset PIN" |
| **Expected** | PIN cleared from the instructor's profile. They can log in without PIN. |

#### TC-SA-SEC-03: Rate Limit on Password Resets

| Field | Detail |
|-------|--------|
| **Precondition** | Super Admin has used many resets this month |
| **Steps** | 1. Attempt to reset passwords repeatedly until limit reached |
| **Expected** | After 10 resets in 30 days, further resets blocked with "Monthly reset limit reached" error. |

---

### 3.8 Audit Logs

#### TC-SA-AUDIT-01: View Audit Trail

| Field | Detail |
|-------|--------|
| **Precondition** | System has audit log entries |
| **Steps** | 1. Navigate to `/dashboard/admin/audit-logs` |
| **Expected** | Table with columns: Timestamp, Actor, Action (color-coded), Target Type & ID, Human-readable Details. Up to 100 entries shown. |

#### TC-SA-AUDIT-02: Verify Human-Readable Audit Descriptions

| Field | Detail |
|-------|--------|
| **Precondition** | Recent actions have been performed (archive, note, key creation) |
| **Steps** | 1. Navigate to Audit Logs <br> 2. Look for recent entries |
| **Expected** | Entries read as sentences, e.g.: "Super Admin generated API key 'Room 201 Kiosk' for kiosk device", "Instructor marked John Doe as 'Manually Verified' (was Absent)." |

---

## 4. System Admin Test Cases

### 4.1 Dashboard

#### TC-ADM-DASH-01: View Admin Dashboard

| Field | Detail |
|-------|--------|
| **Precondition** | Logged in as System Admin |
| **Steps** | 1. Navigate to dashboard |
| **Expected** | Dashboard shows: Total Students, Today's Present, Upcoming Class, Class Count. IoT room controls visible. Live attendance feed active. |

#### TC-ADM-DASH-02: Quick Action — Add Student from Dashboard

| Field | Detail |
|-------|--------|
| **Precondition** | System Admin logged in |
| **Steps** | 1. Click "Add Student" quick action on dashboard <br> 2. Fill in student details (Name, SIN, Year Level) <br> 3. Submit |
| **Expected** | Student created successfully. Appears in student directory. |

#### TC-ADM-DASH-03: Quick Action — Add Class from Dashboard

| Field | Detail |
|-------|--------|
| **Precondition** | System Admin logged in |
| **Steps** | 1. Click "Add Class" quick action <br> 2. Fill in class details (Name, Schedule, Year Level) <br> 3. Submit |
| **Expected** | Class created. Appears in classes page grouped by year level. |

---

### 4.2 Admin Console

#### TC-ADM-CON-01: View Sensor Memory Map (Biometric Matrix)

| Field | Detail |
|-------|--------|
| **Precondition** | Students exist with fingerprint data |
| **Steps** | 1. Navigate to `/dashboard/admin` <br> 2. View the Sensor Memory Map grid |
| **Expected** | Grid shows all students with slot IDs. Real-time updates via Supabase Realtime. Connection status indicator and last-updated timestamp visible. |

---

### 4.3 Instructor Management

#### TC-ADM-INST-01: Add an Instructor

| Field | Detail |
|-------|--------|
| **Precondition** | System Admin logged in |
| **Steps** | 1. Navigate to `/dashboard/admin/instructors` <br> 2. Click "Add Instructor" <br> 3. Enter name, set optional PIN, select role <br> 4. Submit |
| **Expected** | Instructor created and listed in directory. Department auto-locked to admin's department. |

#### TC-ADM-INST-02: Edit an Instructor

| Field | Detail |
|-------|--------|
| **Precondition** | Instructor profile exists |
| **Steps** | 1. Navigate to instructor directory <br> 2. Click edit on an instructor <br> 3. Change name/PIN/role <br> 4. Save |
| **Expected** | Changes reflected immediately. |

#### TC-ADM-INST-03: Delete an Instructor

| Field | Detail |
|-------|--------|
| **Precondition** | Instructor profile exists |
| **Steps** | 1. Navigate to instructor directory <br> 2. Click delete on an instructor <br> 3. Confirm deletion |
| **Expected** | Instructor removed. Audit log entry created. |

---

### 4.4 Student Management

#### TC-ADM-STU-01: Add a Student

| Field | Detail |
|-------|--------|
| **Precondition** | System Admin logged in |
| **Steps** | 1. Navigate to `/students` <br> 2. Click "Add Student" <br> 3. Enter Name, SIN, Year Level <br> 4. Submit |
| **Expected** | Student created with unique SIN. Appears in student list. |

#### TC-ADM-STU-02: Bulk Import Students via CSV

| Field | Detail |
|-------|--------|
| **Precondition** | CSV file with columns: name, sin, year_level |
| **Steps** | 1. Navigate to Students page <br> 2. Click "Import CSV" <br> 3. Upload the CSV file <br> 4. Review import results |
| **Expected** | Students imported. Success/failure counts shown. Failed rows show specific error reasons. |

#### TC-ADM-STU-03: Edit a Student

| Field | Detail |
|-------|--------|
| **Precondition** | Student exists |
| **Steps** | 1. Navigate to students page <br> 2. Click on a student <br> 3. Edit name, SIN, or year level <br> 4. Save |
| **Expected** | Student details updated. |

#### TC-ADM-STU-04: Archive a Student (formerly Delete)

| Field | Detail |
|-------|--------|
| **Precondition** | Student exists |
| **Steps** | 1. Navigate to students page <br> 2. Click delete/archive on a student <br> 3. Confirm |
| **Expected** | Student is archived (not deleted). `is_archived` flag set to `true`. Student hidden from active lists. Audit log entry: "Student moved to archive". |

#### TC-ADM-STU-05: Batch Delete/Archive Students

| Field | Detail |
|-------|--------|
| **Precondition** | Multiple students exist |
| **Steps** | 1. Navigate to students page <br> 2. Select multiple students via checkboxes <br> 3. Click batch delete <br> 4. Confirm |
| **Expected** | All selected students archived. Individual audit log entries for each. |

#### TC-ADM-STU-06: View Student Detail

| Field | Detail |
|-------|--------|
| **Precondition** | Student exists with enrollment and attendance data |
| **Steps** | 1. Click on a student card/row |
| **Expected** | Student detail view shows: enrollment list (which classes), attendance history with dates and statuses. |

---

### 4.5 Class Management

#### TC-ADM-CLS-01: Create a Class

| Field | Detail |
|-------|--------|
| **Precondition** | System Admin logged in |
| **Steps** | 1. Navigate to `/classes` <br> 2. Click "Add Class" <br> 3. Enter Name, Start Time, End Time, Year Level, optional Description <br> 4. Click "Create" |
| **Expected** | Class created. Appears in class list grouped by year level. |

#### TC-ADM-CLS-02: Edit a Class

| Field | Detail |
|-------|--------|
| **Precondition** | Class exists |
| **Steps** | 1. Navigate to Classes page <br> 2. Click edit on a class <br> 3. Change name/schedule <br> 4. Save |
| **Expected** | Class details updated. |

#### TC-ADM-CLS-03: Archive a Class (formerly Delete)

| Field | Detail |
|-------|--------|
| **Precondition** | Class exists |
| **Steps** | 1. Navigate to Classes page <br> 2. Click delete/archive on a class <br> 3. Confirm |
| **Expected** | Class archived (not hard-deleted). Hidden from active lists. Audit log entry created. |

#### TC-ADM-CLS-04: Assign Students to a Class

| Field | Detail |
|-------|--------|
| **Precondition** | Class and students exist |
| **Steps** | 1. Navigate to class detail page <br> 2. Click "Assign Student" <br> 3. Search and select students <br> 4. Confirm assignment |
| **Expected** | Students enrolled in the class. They appear in the class roster. |

#### TC-ADM-CLS-05: Remove Student from a Class

| Field | Detail |
|-------|--------|
| **Precondition** | Student enrolled in a class |
| **Steps** | 1. Navigate to class detail <br> 2. Click remove next to a student <br> 3. Confirm |
| **Expected** | Student un-enrolled. No longer appears in that class's roster. |

#### TC-ADM-CLS-06: Bulk Import Classes via CSV

| Field | Detail |
|-------|--------|
| **Precondition** | CSV file with columns: name, start_time, end_time, year_level |
| **Steps** | 1. Navigate to Classes page <br> 2. Click "Import CSV" <br> 3. Upload CSV <br> 4. Review results |
| **Expected** | Classes imported. Time formats normalized (e.g., "8:00 AM" → "08:00"). Failed rows show reasons. |

---

### 4.6 Attendance

#### TC-ADM-ATT-01: View All Attendance for Today

| Field | Detail |
|-------|--------|
| **Precondition** | Attendance records exist for today |
| **Steps** | 1. Navigate to `/attendance` |
| **Expected** | Table shows all attendance records for today: Date, SIN, Student Name, Class Name, Time In, Time Out, Status, Note. Live indicator shows "Live — Listening for scans". |

#### TC-ADM-ATT-02: Filter Attendance by Date

| Field | Detail |
|-------|--------|
| **Precondition** | Historical attendance records exist |
| **Steps** | 1. Navigate to Attendance page <br> 2. Click the date picker <br> 3. Select a past date |
| **Expected** | Table updates to show records for the selected date only. |

#### TC-ADM-ATT-03: Search Attendance by Student Name

| Field | Detail |
|-------|--------|
| **Precondition** | Attendance records exist |
| **Steps** | 1. Navigate to Attendance page <br> 2. Type a student name in the search box |
| **Expected** | Table filters to show only matching students. |

#### TC-ADM-ATT-04: Real-Time Attendance Update

| Field | Detail |
|-------|--------|
| **Precondition** | Attendance page open, ESP32 kiosk online |
| **Steps** | 1. Keep the attendance page open <br> 2. Have a student scan fingerprint on the kiosk |
| **Expected** | New attendance row appears at the top with green flash animation. No page refresh needed. |

#### TC-ADM-ATT-05: Verify Status Labels

| Field | Detail |
|-------|--------|
| **Precondition** | Various attendance scenarios |
| **Steps** | 1. Review attendance records with different statuses |
| **Expected** | Correct labels shown: **Present** (green), **Late** (orange), **Absent** (red), **Cut Class** (left early), **Ghosting** (didn't leave), **Invalid** (too early), **Excused** (evidence approved), **Manually Verified** (purple — teacher vouched). |

---

### 4.7 Room Management

#### TC-ADM-ROOM-01: Create a Room

| Field | Detail |
|-------|--------|
| **Precondition** | System Admin logged in |
| **Steps** | 1. Navigate to `/dashboard/admin/rooms` <br> 2. Click "Add Room" <br> 3. Enter room name, building, capacity <br> 4. Submit |
| **Expected** | Room created. Auto-assigned to admin's department. |

#### TC-ADM-ROOM-02: Edit a Room

| Field | Detail |
|-------|--------|
| **Precondition** | Room exists |
| **Steps** | 1. Navigate to Rooms page <br> 2. Edit room details inline <br> 3. Save |
| **Expected** | Room details updated. |

#### TC-ADM-ROOM-03: Delete a Room

| Field | Detail |
|-------|--------|
| **Precondition** | Room exists |
| **Steps** | 1. Click Delete on a room <br> 2. Confirm |
| **Expected** | Room removed. Devices previously assigned to it become unassigned. |

#### TC-ADM-ROOM-04: Assign Devices to Room

| Field | Detail |
|-------|--------|
| **Precondition** | Room and IoT devices exist |
| **Steps** | 1. Navigate to room management <br> 2. Use the device assignment panel <br> 3. Drag/select devices to assign to the room |
| **Expected** | Devices linked to the room. Color-coded type indicators visible. |

---

### 4.8 Kiosk Inventory

#### TC-ADM-KIOSK-01: View All Kiosks

| Field | Detail |
|-------|--------|
| **Precondition** | ESP32 kiosks registered |
| **Steps** | 1. Navigate to `/dashboard/admin/kiosks` |
| **Expected** | List shows: serial number, status (Pending/Approved/Rejected), online/offline, last heartbeat, firmware version, IP, room, label. |

#### TC-ADM-KIOSK-02: Approve a Pending Kiosk

| Field | Detail |
|-------|--------|
| **Precondition** | Kiosk registered but pending |
| **Steps** | 1. Navigate to Kiosk Inventory <br> 2. Find the pending kiosk <br> 3. Click "Approve" |
| **Expected** | Kiosk status changes to "Approved". It can now sync data and log attendance. |

#### TC-ADM-KIOSK-03: Reject a Kiosk

| Field | Detail |
|-------|--------|
| **Precondition** | Pending kiosk exists |
| **Steps** | 1. Click "Reject" on the kiosk |
| **Expected** | Kiosk status changes to "Rejected". It cannot sync or log attendance. |

#### TC-ADM-KIOSK-04: Bind Kiosk to Room

| Field | Detail |
|-------|--------|
| **Precondition** | Approved kiosk and room exist |
| **Steps** | 1. Select the kiosk <br> 2. Assign it to a room |
| **Expected** | Kiosk linked to the room. It will serve attendance for classes in that room. |

---

### 4.9 Evidence / Mails Review (Admin)

#### TC-ADM-MAIL-01: View All Mail Submissions

| Field | Detail |
|-------|--------|
| **Precondition** | Students have submitted excuse letters |
| **Steps** | 1. Navigate to `/dashboard/admin/evidence` |
| **Expected** | Page titled "Mail Inbox". Shows all submissions across the department with student name, SIN, file type, absence dates, and status. |

#### TC-ADM-MAIL-02: Filter by Pending Mails

| Field | Detail |
|-------|--------|
| **Precondition** | Mix of pending and reviewed submissions |
| **Steps** | 1. Click "Pending Mails" filter button |
| **Expected** | Only pending (unreviewed) submissions shown. |

#### TC-ADM-MAIL-03: Approve Evidence → Auto-Excuse

| Field | Detail |
|-------|--------|
| **Precondition** | Pending evidence submission exists |
| **Steps** | 1. Click "Approve" on a pending evidence item |
| **Expected** | Evidence status changes to "Approved" (green). Linked attendance records updated to "Excused" status. |

#### TC-ADM-MAIL-04: Reject Evidence

| Field | Detail |
|-------|--------|
| **Precondition** | Pending evidence exists |
| **Steps** | 1. Click "Reject" on a pending evidence item |
| **Expected** | Evidence status changes to "Rejected" (red). Attendance records unchanged. |

#### TC-ADM-MAIL-05: Delete Reviewed Evidence

| Field | Detail |
|-------|--------|
| **Precondition** | Evidence has been approved or rejected |
| **Steps** | 1. View "All Mails" (not Pending filter) <br> 2. Find a reviewed item (green approved / red rejected badge) <br> 3. Click "Delete" button <br> 4. Confirm deletion |
| **Expected** | Evidence permanently deleted. Removed from the list. |

---

### 4.10 Reports & Student Alerts

#### TC-ADM-RPT-01: View Student Alerts (At-Risk Report)

| Field | Detail |
|-------|--------|
| **Precondition** | Students with low attendance exist |
| **Steps** | 1. Navigate to `/reports` |
| **Expected** | Page titled "Student Alerts". Shows students with low attendance: name, SIN, year level, attendance %, risk label with emoji (🟢 EXCELLENT / 🟡 GOOD / 🔴 CRITICAL). |

#### TC-ADM-RPT-02: Verify Scope — Department Scoped

| Field | Detail |
|-------|--------|
| **Precondition** | Multiple departments exist |
| **Steps** | 1. As System Admin, view Reports |
| **Expected** | Only students within admin's department shown. Not university-wide. |

---

### 4.11 Settings (Admin)

#### TC-ADM-SET-01: Delete Account (Admin Only)

| Field | Detail |
|-------|--------|
| **Precondition** | Logged in as System Admin |
| **Steps** | 1. Navigate to `/settings` <br> 2. Scroll to "Danger Zone" <br> 3. Click "Delete Account" <br> 4. Confirm in the dialog |
| **Expected** | Account permanently deleted. User logged out and redirected to login. |

---

## 5. Instructor Test Cases

### 5.1 Dashboard

#### TC-INS-DASH-01: View Instructor Dashboard

| Field | Detail |
|-------|--------|
| **Precondition** | Logged in as Instructor |
| **Steps** | 1. Navigate to dashboard |
| **Expected** | Shows: Total Students (own classes), Today's Present, Upcoming Class widget with countdown, Class Count. IoT controls visible during scheduled class time. |

#### TC-INS-DASH-02: IoT Room Controls — During Class Time

| Field | Detail |
|-------|--------|
| **Precondition** | Instructor has an active class with IoT devices in the room |
| **Steps** | 1. View dashboard during scheduled class time <br> 2. Toggle light/fan/AC switches |
| **Expected** | Devices respond. Controls only visible during scheduled class time for the instructor's room. |

#### TC-INS-DASH-03: IoT Room Controls — Outside Class Time

| Field | Detail |
|-------|--------|
| **Precondition** | No active class currently |
| **Steps** | 1. View dashboard outside of any scheduled class |
| **Expected** | IoT controls not visible or disabled. Instructor cannot control devices outside their schedule. |

#### TC-INS-DASH-04: Kiosk Health Card

| Field | Detail |
|-------|--------|
| **Precondition** | Kiosk assigned to instructor's room |
| **Steps** | 1. View dashboard <br> 2. Check kiosk health card |
| **Expected** | Shows online/offline status, firmware version. "Diagnostic Ping" button available for testing. |

---

### 5.2 Attendance

#### TC-INS-ATT-01: View Own Class Attendance

| Field | Detail |
|-------|--------|
| **Precondition** | Instructor has classes with attendance data |
| **Steps** | 1. Navigate to `/attendance` |
| **Expected** | Only records for the instructor's own classes shown. |

#### TC-INS-ATT-02: Cannot See Other Instructor's Attendance

| Field | Detail |
|-------|--------|
| **Precondition** | Other instructors have attendance data |
| **Steps** | 1. Navigate to attendance as Instructor |
| **Expected** | Only own class records visible. Other instructors' data not accessible. |

---

### 5.3 Attendance Notes & 48-Hour Freeze (Production Hardening)

#### TC-INS-NOTE-01: Add Note to an Attendance Record

| Field | Detail |
|-------|--------|
| **Precondition** | Attendance record exists, less than 48 hours old |
| **Steps** | 1. Navigate to Attendance <br> 2. Click the message icon (💬) next to a record <br> 3. Enter a note (e.g., "Student was late due to medical appointment") <br> 4. Click "Save Note" |
| **Expected** | Note saved. Blue badge appears in the Note column showing the note text. Audit log entry created. |

#### TC-INS-NOTE-02: Add Note to Absent Record → Auto "Manually Verified"

| Field | Detail |
|-------|--------|
| **Precondition** | An attendance record with status "Absent" exists, less than 48h old |
| **Steps** | 1. Click the message icon on an Absent record <br> 2. Observe the purple info notice about "Manually Verified" <br> 3. Enter a note explaining why the student should be marked present <br> 4. Click "Save Note" |
| **Expected** | Status changes from "Absent" to **"Manually Verified"** (purple badge 🟣). This distinguishes teacher-vouched attendance from biometric scans. Audit log: `Instructor marked [Name] as "Manually Verified" (was Absent). Note: "..."` |

#### TC-INS-NOTE-03: 48-Hour Freeze — Cannot Edit Frozen Record

| Field | Detail |
|-------|--------|
| **Precondition** | Attendance record older than 48 hours exists |
| **Steps** | 1. Navigate to Attendance <br> 2. Find a record from 3+ days ago <br> 3. Look for the 🧊 (snowflake) frozen indicator <br> 4. Attempt to add a note |
| **Expected** | Snowflake icon visible next to status. No message icon (💬) button available for the instructor. Record is frozen and cannot be modified. |

#### TC-INS-NOTE-04: Admin CAN Edit Frozen Record ("Defrost")

| Field | Detail |
|-------|--------|
| **Precondition** | Logged in as System Admin, frozen record exists |
| **Steps** | 1. Navigate to Attendance <br> 2. Find a frozen record (>48h old, 🧊 icon) <br> 3. Click the message icon — tooltip should say "Defrost: Add admin note" <br> 4. Add a note and save |
| **Expected** | Admin can still add notes to frozen records. Note saved successfully. |

---

### 5.4 Mails / Evidence Queue (Instructor)

#### TC-INS-MAIL-01: View Pending Mails

| Field | Detail |
|-------|--------|
| **Precondition** | Students submitted evidence for instructor's classes |
| **Steps** | 1. Navigate to `/evidence` |
| **Expected** | Page titled "Mails" with mail icon. Only submissions for instructor's own classes shown. |

#### TC-INS-MAIL-02: Approve Mail → Mark Excused

| Field | Detail |
|-------|--------|
| **Precondition** | Pending mail submission exists |
| **Steps** | 1. Click "Approve" on a pending mail |
| **Expected** | Mail approved. Linked attendance records changed to "Excused". |

#### TC-INS-MAIL-03: Reject Mail

| Field | Detail |
|-------|--------|
| **Precondition** | Pending mail exists |
| **Steps** | 1. Click "Reject" |
| **Expected** | Mail rejected. No attendance changes. |

#### TC-INS-MAIL-04: Preview Uploaded Files

| Field | Detail |
|-------|--------|
| **Precondition** | Mail with attached files exists |
| **Steps** | 1. Click on a mail item to preview files |
| **Expected** | Images and PDFs display inline. |

---

### 5.5 Classes & Students (Instructor)

#### TC-INS-CLS-01: Create a Class

| Field | Detail |
|-------|--------|
| **Steps** | 1. Navigate to `/classes` <br> 2. Click "Add Class" <br> 3. Fill in details <br> 4. Submit |
| **Expected** | Class created and auto-assigned to this instructor. |

#### TC-INS-STU-01: Add a Student

| Field | Detail |
|-------|--------|
| **Steps** | 1. Navigate to `/students` <br> 2. Click "Add Student" <br> 3. Enter Name, SIN, Year Level <br> 4. Submit |
| **Expected** | Student created. |

#### TC-INS-STU-02: Cannot See Students from Other Instructors

| Field | Detail |
|-------|--------|
| **Steps** | 1. Navigate to Students as Instructor |
| **Expected** | Only students enrolled in this instructor's classes visible. |

---

### 5.6 QR Scanner

#### TC-INS-QR-01: Open QR Scanner

| Field | Detail |
|-------|--------|
| **Precondition** | Instructor logged in, device has camera |
| **Steps** | 1. Navigate to `/dashboard/scanner` <br> 2. Select a class <br> 3. Allow camera access |
| **Expected** | Camera feed active. QR scanner ready. |

#### TC-INS-QR-02: Scan Student QR Code

| Field | Detail |
|-------|--------|
| **Precondition** | Scanner open, student has QR code |
| **Steps** | 1. Student shows their QR code <br> 2. Scanner reads it |
| **Expected** | QR validated. Attendance logged with success feedback. Scan history updated. |

#### TC-INS-QR-03: Scan Invalid QR Code

| Field | Detail |
|-------|--------|
| **Steps** | 1. Scan a non-ClassTrack QR code |
| **Expected** | Error: QR not recognized. No attendance logged. |

---

### 5.7 Reports (Instructor)

#### TC-INS-RPT-01: View Student Alerts for Own Classes

| Field | Detail |
|-------|--------|
| **Steps** | 1. Navigate to `/reports` |
| **Expected** | Only at-risk students from the instructor's own classes shown. Risk levels: 🟢 EXCELLENT / 🟡 GOOD / 🔴 CRITICAL. |

---

### 5.8 Settings (Instructor — Production Hardening)

#### TC-INS-SET-01: No Self-Deletion Available

| Field | Detail |
|-------|--------|
| **Precondition** | Logged in as Instructor (not admin) |
| **Steps** | 1. Navigate to `/settings` <br> 2. Scroll to bottom section |
| **Expected** | Instead of "Danger Zone" with delete button, instructor sees "Account Management" with message: "Profile and account deletion is managed by your System Administrator." No delete button. |

#### TC-INS-SET-02: Theme Toggle

| Field | Detail |
|-------|--------|
| **Steps** | 1. Navigate to Settings <br> 2. Toggle theme between Light and Dark |
| **Expected** | Theme changes immediately across all pages. Persisted on refresh. |

---

### 5.9 Profile

#### TC-INS-PROF-01: View Profile

| Field | Detail |
|-------|--------|
| **Steps** | 1. Navigate to `/profile` |
| **Expected** | Displays: name, email, role, department. Edit Name field. PIN management section. |

#### TC-INS-PROF-02: Edit Display Name

| Field | Detail |
|-------|--------|
| **Steps** | 1. Navigate to Profile <br> 2. Change display name <br> 3. Save |
| **Expected** | Name updated across the system (sidebar, cards, etc.). |

---

## 6. Student Portal Test Cases

### 6.1 Login

#### TC-STU-LOGIN-01: Login with Valid SIN

| Field | Detail |
|-------|--------|
| **Precondition** | Student with SIN exists in the system |
| **Steps** | 1. Navigate to `/student/portal` <br> 2. Enter the SIN in the input field <br> 3. Click "Login" or press Enter |
| **Expected** | Student portal loads showing the student's name, enrollment, and attendance data. |

#### TC-STU-LOGIN-02: Login with Invalid SIN

| Field | Detail |
|-------|--------|
| **Steps** | 1. Navigate to `/student/portal` <br> 2. Enter a non-existent SIN <br> 3. Submit |
| **Expected** | Error message: SIN not found. Portal does not load. |

#### TC-STU-LOGIN-03: Logout from Student Portal

| Field | Detail |
|-------|--------|
| **Steps** | 1. While in the student portal, click "Logout" or clear SIN |
| **Expected** | SIN cleared from browser storage. Redirected to SIN login screen. |

---

### 6.2 Attendance Dashboard

#### TC-STU-ATT-01: View Overall Attendance Summary

| Field | Detail |
|-------|--------|
| **Precondition** | Student enrolled in classes with attendance data |
| **Steps** | 1. Log in with SIN <br> 2. View the Attendance tab |
| **Expected** | Shows: total sessions, present count, late count, absent count, excuse-pending count, overall attendance percentage. |

#### TC-STU-ATT-02: View Per-Class Breakdown

| Field | Detail |
|-------|--------|
| **Steps** | 1. Scroll through attendance tab |
| **Expected** | Each enrolled class shown with: subject name, section, present/late/absent counts, attendance % with color-coded bar (green → yellow → red). |

#### TC-STU-ATT-03: QR Code Generation

| Field | Detail |
|-------|--------|
| **Precondition** | Student logged into portal |
| **Steps** | 1. Navigate to the QR tab |
| **Expected** | QR code generated for the student. Can be used for check-in/out scanning. |

---

### 6.3 Excuse Letter Submission

#### TC-STU-EXCUSE-01: Submit an Excuse Letter

| Field | Detail |
|-------|--------|
| **Precondition** | Student logged in, has absences |
| **Steps** | 1. Click the "Excuse" tab <br> 2. Select an instructor <br> 3. Select a class <br> 4. Select the absence dates to cover <br> 5. Upload a file (image or PDF) <br> 6. Click "Submit Excuse Letter" |
| **Expected** | Excuse submitted successfully. Success message shown. Submission visible in instructor's Mails queue. |

#### TC-STU-EXCUSE-02: Submit Without File — Validation

| Field | Detail |
|-------|--------|
| **Steps** | 1. Try to submit an excuse without uploading a file |
| **Expected** | Submit button disabled or validation error shown. File is required. |

#### TC-STU-EXCUSE-03: Submit Without Selecting Dates — Validation

| Field | Detail |
|-------|--------|
| **Steps** | 1. Try to submit without selecting any absence dates |
| **Expected** | Submit button disabled. At least one date required. |

---

## 7. Shared / Cross-Role Test Cases

### 7.1 Navigation & UI

#### TC-SHARED-NAV-01: Sidebar Navigation

| Field | Detail |
|-------|--------|
| **Steps** | 1. Open any page while logged in <br> 2. Check sidebar items |
| **Expected** | Role-appropriate nav items shown. Super Admin sees: API Keys, Audit Trail. Admin sees: Archived. Instructor sees: Mails, QR Scanner. |

#### TC-SHARED-NAV-02: Collapsible Sidebar

| Field | Detail |
|-------|--------|
| **Steps** | 1. Click the sidebar collapse toggle |
| **Expected** | Sidebar collapses to icons-only mode. Expand restores full labels. |

#### TC-SHARED-NAV-03: Dark Mode / Light Mode Toggle

| Field | Detail |
|-------|--------|
| **Steps** | 1. Navigate to Settings <br> 2. Toggle theme <br> 3. Navigate to other pages |
| **Expected** | Theme applies globally. Persisted on page refresh and between sessions. |

---

### 7.2 Search

#### TC-SHARED-SEARCH-01: Global Search

| Field | Detail |
|-------|--------|
| **Steps** | 1. Click the search bar in the header <br> 2. Type a student name or class name |
| **Expected** | Results returned matching the query. Scoped to user's accessible data. |

---

### 7.3 Notifications

#### TC-SHARED-NOTIF-01: View Notifications

| Field | Detail |
|-------|--------|
| **Steps** | 1. Click the notification bell icon |
| **Expected** | Dropdown shows recent notifications from the last 24 hours. |

---

### 7.4 Security

#### TC-SHARED-SEC-01: Rate Limiting

| Field | Detail |
|-------|--------|
| **Steps** | 1. Make rapid repeated requests to any endpoint |
| **Expected** | After exceeding limit: Auth 10/min, API 60/min, Attendance 30/min, Mutations 20/min → 429 error with "Too Many Requests". |

#### TC-SHARED-SEC-02: CORS Protection

| Field | Detail |
|-------|--------|
| **Steps** | 1. Attempt API call from an unauthorized origin |
| **Expected** | Request blocked by CORS policy. |

#### TC-SHARED-SEC-03: Department Data Isolation (RLS)

| Field | Detail |
|-------|--------|
| **Precondition** | Multiple departments with separate data |
| **Steps** | 1. Log in as admin of Department A <br> 2. Try to access data from Department B via direct DB query or API |
| **Expected** | Row-Level Security blocks access. Only Department A data returned. |

---

### 7.5 Account Approval Flow

#### TC-SHARED-APPROVE-01: New Account Approval

| Field | Detail |
|-------|--------|
| **Precondition** | New account pending approval |
| **Steps** | 1. Log in as admin <br> 2. Navigate to approve pending accounts <br> 3. Approve the account |
| **Expected** | Account approved. User can now log in and access dashboard. |

---

## 8. Production Hardening Test Cases

### 8.1 Archive System

#### TC-HARD-ARC-01: Delete Student → Archived (Not Deleted)

| Field | Detail |
|-------|--------|
| **Steps** | 1. As Admin, delete a student <br> 2. Check the database |
| **Expected** | Student record still exists with `is_archived = true`, `archived_at` timestamp set. Student hidden from active lists but data preserved. |

#### TC-HARD-ARC-02: Delete Class → Archived (Not Deleted)

| Field | Detail |
|-------|--------|
| **Steps** | 1. As Admin, delete a class <br> 2. Check the database |
| **Expected** | Class record still exists with `is_archived = true`. Hidden from active lists. Attendance history preserved. |

### 8.2 Manually Verified vs Present

#### TC-HARD-MV-01: Distinguish Biometric Present from Manually Verified

| Field | Detail |
|-------|--------|
| **Steps** | 1. View attendance table with a mix of "Present" and "Manually Verified" students |
| **Expected** | "Present" has green badge (biometric scan). "Manually Verified" has purple badge (🟣, teacher-vouched). Clear visual distinction. |

### 8.3 Flexible Password

#### TC-HARD-PWD-01: Reset Password with All Lowercase

| Field | Detail |
|-------|--------|
| **Steps** | 1. As Super Admin, navigate to Security <br> 2. Select a user <br> 3. Enter "hello" as the new password <br> 4. Click Reset |
| **Expected** | Password reset succeeds. No complexity error. User can log in with "hello". |

#### TC-HARD-PWD-02: Reset Password with Numbers Only

| Field | Detail |
|-------|--------|
| **Steps** | 1. Enter "123456" as password <br> 2. Reset |
| **Expected** | Succeeds. No format restrictions. |

#### TC-HARD-PWD-03: Reset Password with Single Character

| Field | Detail |
|-------|--------|
| **Steps** | 1. Enter "a" as password <br> 2. Reset |
| **Expected** | Succeeds. Any non-empty password accepted. |

---

## 9. API & IoT Test Cases

### 9.1 ESP32 Kiosk Endpoints

#### TC-API-ATT-01: Log Attendance from Kiosk

| Field | Detail |
|-------|--------|
| **Endpoint** | `POST /api/attendance/log` |
| **Steps** | 1. Send POST with `student_id`, `class_id`, `action` (check_in/check_out), and API key |
| **Expected** | 200 OK. Attendance record created. Real-time update appears on web dashboard. |

#### TC-API-SYNC-01: Sync Data to Kiosk

| Field | Detail |
|-------|--------|
| **Endpoint** | `GET /api/sync` |
| **Steps** | 1. ESP32 sends GET with API key |
| **Expected** | Returns JSON with students and classes data for the kiosk's assigned room/department. |

#### TC-API-FP-01: Enroll Fingerprint

| Field | Detail |
|-------|--------|
| **Endpoint** | `POST /api/fingerprint/enroll` |
| **Steps** | 1. ESP32 sends enrollment data with student_id and slot_id |
| **Expected** | Fingerprint slot registered in database. Biometric matrix updates on dashboard. |

#### TC-API-HEALTH-01: Health Check

| Field | Detail |
|-------|--------|
| **Endpoint** | `GET /api/health` |
| **Steps** | 1. Send GET request (no auth needed) |
| **Expected** | 200 OK with system health status. |

#### TC-API-STATUS-01: Connectivity Handshake

| Field | Detail |
|-------|--------|
| **Endpoint** | `GET /api/status` |
| **Steps** | 1. ESP32 pings on boot |
| **Expected** | 200 OK confirming server is reachable. |

### 9.2 IoT Device Control

#### TC-API-IOT-01: Control Device

| Field | Detail |
|-------|--------|
| **Endpoint** | `POST /api/iot/control` |
| **Steps** | 1. Send toggle command with device_id and dp_code |
| **Expected** | Tuya Cloud relays command. Device toggles on/off. |

### 9.3 Student Public Endpoints

#### TC-API-STU-01: Fetch Student Attendance by SIN

| Field | Detail |
|-------|--------|
| **Endpoint** | `GET /api/student/attendance?sin=XXXXX` |
| **Steps** | 1. Send GET with valid SIN (no auth needed) |
| **Expected** | Returns attendance data for that student across all enrolled classes. |

#### TC-API-UPLOAD-01: Public Evidence Upload

| Field | Detail |
|-------|--------|
| **Endpoint** | `POST /api/evidence/public-upload` |
| **Steps** | 1. Send multipart form with file and metadata |
| **Expected** | File uploaded to storage. Evidence record created in pending status. |

---

---

## 10. Archive System Test Cases (New)

### 10.1 Archived Page — Recently Deleted

#### TC-ARC-01: View Archived Students

| Field | Detail |
|-------|--------|
| **Precondition** | At least one student has been archived |
| **Steps** | 1. Navigate to `/dashboard/admin/archived` <br> 2. Click the "Students" tab |
| **Expected** | List of archived students with name, SIN, and "Archived X days ago" timestamp. |

#### TC-ARC-02: View Archived Classes

| Field | Detail |
|-------|--------|
| **Precondition** | At least one class has been archived |
| **Steps** | 1. Navigate to Archived page <br> 2. Click the "Classes" tab |
| **Expected** | List of archived classes with name, year level, and archive date. |

#### TC-ARC-03: Restore a Student

| Field | Detail |
|-------|--------|
| **Precondition** | Archived student exists |
| **Steps** | 1. Navigate to Archived → Students tab <br> 2. Click "Restore" on a student |
| **Expected** | Student removed from archived list. Appears again in the active Students page. Audit log entry: "Student restored from archive". |

#### TC-ARC-04: Restore a Class

| Field | Detail |
|-------|--------|
| **Precondition** | Archived class exists |
| **Steps** | 1. Navigate to Archived → Classes tab <br> 2. Click "Restore" on a class |
| **Expected** | Class removed from archived list. Appears again in the active Classes page. Audit log entry: "Class restored from archive". |

#### TC-ARC-05: Delete Forever — Student

| Field | Detail |
|-------|--------|
| **Precondition** | Archived student exists |
| **Steps** | 1. Navigate to Archived → Students tab <br> 2. Click "Delete Forever" on a student <br> 3. Confirm the double-confirmation dialog |
| **Expected** | Student permanently deleted from database. All attendance records for this student are lost. Cannot be undone. |

#### TC-ARC-06: Delete Forever — Class

| Field | Detail |
|-------|--------|
| **Precondition** | Archived class exists |
| **Steps** | 1. Navigate to Archived → Classes tab <br> 2. Click "Delete Forever" on a class <br> 3. Confirm |
| **Expected** | Class permanently deleted. All enrollment records lost. Cannot be undone. |

---

## 11. Auto-Absent Email Notification Test Cases (New)

#### TC-EMAIL-01: Cron Endpoint with Valid Secret

| Field | Detail |
|-------|--------|
| **Endpoint** | `GET /api/cron/absent-notify?secret=YOUR_SECRET` |
| **Precondition** | `CRON_SECRET` environment variable set, students were absent yesterday, students have `guardian_email` set |
| **Steps** | 1. Call the endpoint with the correct secret |
| **Expected** | Returns JSON with `sent` count, `failed` count, and `date`. Emails sent to guardian emails via Resend. Audit log entries created. |

#### TC-EMAIL-02: Cron Endpoint with Invalid Secret

| Field | Detail |
|-------|--------|
| **Steps** | 1. Call `GET /api/cron/absent-notify?secret=wrong` |
| **Expected** | Returns 401 Unauthorized. No emails sent. |

#### TC-EMAIL-03: No Absences Yesterday

| Field | Detail |
|-------|--------|
| **Precondition** | No students were absent yesterday |
| **Steps** | 1. Call the endpoint with valid secret |
| **Expected** | Returns `{ sent: 0, message: "No absences found for yesterday" }`. |

#### TC-EMAIL-04: Student Without Guardian Email — Skipped

| Field | Detail |
|-------|--------|
| **Precondition** | Absent student has no `guardian_email` set |
| **Steps** | 1. Call the cron endpoint |
| **Expected** | Student is silently skipped. No error. Other students with guardian emails are still notified. |

#### TC-EMAIL-05: Dry Run Mode (No Resend Key)

| Field | Detail |
|-------|--------|
| **Precondition** | `RESEND_API_KEY` environment variable not set |
| **Steps** | 1. Call the endpoint with valid CRON_SECRET |
| **Expected** | Returns `{ message: "Dry run (RESEND_API_KEY not set)" }`. Notifications logged to console but no real emails sent. |

#### TC-EMAIL-06: Add Guardian Email to Student

| Field | Detail |
|-------|--------|
| **Precondition** | Admin or Instructor logged in |
| **Steps** | 1. Navigate to Students <br> 2. Click "Add Student" <br> 3. Fill in name, SIN, year level <br> 4. Scroll to "Guardian Contact" section <br> 5. Enter guardian name and email <br> 6. Submit |
| **Expected** | Student created with `guardian_email` and `guardian_name` fields saved. These are used for auto-absent notifications. |

---

## 12. System Admin Read-Only Test Cases

#### TC-ADM-RO-01: Students Page — No Edit/Archive Controls

| Field | Detail |
|-------|--------|
| **Precondition** | Logged in as System Admin |
| **Steps** | 1. Navigate to `/students` |
| **Expected** | No checkboxes, no "..." menu, no archive button visible. "Add Student" button IS visible. |

#### TC-ADM-RO-02: Classes Page — No Edit/Archive Controls

| Field | Detail |
|-------|--------|
| **Precondition** | Logged in as System Admin |
| **Steps** | 1. Navigate to `/classes` |
| **Expected** | No checkboxes, no archive button visible. Cards show "View →" (not "Manage →"). "Add Class" IS visible. |

#### TC-ADM-RO-03: Class Detail — No Unenroll Button

| Field | Detail |
|-------|--------|
| **Precondition** | Logged in as System Admin, class with enrolled students exists |
| **Steps** | 1. Navigate to `/classes/[id]` |
| **Expected** | Enrolled students visible. No unenroll (UserMinus) button. No "Assign Student" button. Export CSV IS visible. |

---

## 13. Deletion Request Test Cases

#### TC-DEL-01: Instructor Requests Deletion

| Field | Detail |
|-------|--------|
| **Precondition** | Instructor logged in, archived student exists |
| **Steps** | 1. Navigate to `/archived` → Students tab <br> 2. Click "Request Deletion" on a student <br> 3. Enter a reason <br> 4. Click "Send Request" |
| **Expected** | Modal closes. Alert: "Deletion request sent to your System Administrator." Record created in `deletion_requests` table. Audit log entry created. |

#### TC-DEL-02: Admin Approves Deletion

| Field | Detail |
|-------|--------|
| **Precondition** | System Admin logged in, pending deletion request exists |
| **Steps** | 1. Navigate to Admin Console → Deletion Requests card <br> 2. Click "Approve & Delete" <br> 3. Confirm the permanent deletion dialog |
| **Expected** | Item permanently deleted. Request status changes to "approved". Moves to History section. |

#### TC-DEL-03: Admin Rejects Deletion

| Field | Detail |
|-------|--------|
| **Precondition** | Pending deletion request exists |
| **Steps** | 1. Navigate to Deletion Requests <br> 2. Click "Reject" |
| **Expected** | Request status changes to "rejected". Item stays archived. Audit log entry created. |

---

## 14. Export & Unenroll Test Cases

#### TC-EXPORT-01: Export Class Attendance as CSV

| Field | Detail |
|-------|--------|
| **Precondition** | Class with attendance data for the selected date |
| **Steps** | 1. Navigate to `/classes/[id]` <br> 2. Click "Export CSV" |
| **Expected** | CSV file downloads with filename `ClassName_YYYY-MM-DD.csv`. Contains header rows (class name, date, summary stats), column headers, per-student rows (Name, SIN, Year Level, Status, Time In, Time Out), and footer. |

#### TC-EXPORT-02: Export Empty Class

| Field | Detail |
|-------|--------|
| **Precondition** | Class with no attendance for the selected date |
| **Steps** | 1. Navigate to `/classes/[id]` <br> 2. Click "Export CSV" |
| **Expected** | CSV downloads with header and summary (all zeros) but no student rows. |

#### TC-UNENROLL-01: Unenroll Student with Confirmation

| Field | Detail |
|-------|--------|
| **Precondition** | Instructor logged in, class with enrolled students |
| **Steps** | 1. Navigate to `/classes/[id]` <br> 2. Click the unenroll icon (UserMinus) <br> 3. Read the confirmation message <br> 4. Click "OK" |
| **Expected** | Student removed from roster. Confirmation says "attendance history will be preserved." Student still exists on Students page. |

#### TC-UNENROLL-02: Cancel Unenroll

| Field | Detail |
|-------|--------|
| **Steps** | 1. Click unenroll icon <br> 2. Click "Cancel" in confirmation |
| **Expected** | Nothing happens. Student remains enrolled. |

---

## 15. Holiday / No-Class Test Cases

#### TC-HOLIDAY-01: Mark Day as Holiday

| Field | Detail |
|-------|--------|
| **Precondition** | Instructor logged in, class exists |
| **Steps** | 1. Navigate to `/classes/[id]` <br> 2. Click "No Class" button <br> 3. Select "Holiday" <br> 4. Enter note "EDSA Anniversary" <br> 5. Click "Save" |
| **Expected** | Amber "🏖 Holiday — EDSA Anniversary" banner appears. Day excluded from attendance calculations. |

#### TC-HOLIDAY-02: Remove No-Class Marker

| Field | Detail |
|-------|--------|
| **Precondition** | Day already marked as holiday |
| **Steps** | 1. Click the X next to the holiday badge <br> 2. Confirm removal |
| **Expected** | Marker removed. Day counts normally in attendance again. |

#### TC-HOLIDAY-03: No-Class Marker Not Visible to Admin

| Field | Detail |
|-------|--------|
| **Precondition** | Logged in as System Admin |
| **Steps** | 1. Navigate to `/classes/[id]` that has an existing holiday marker |
| **Expected** | Holiday banner IS visible (informational), but "No Class" button is NOT visible (admin can't mark days). |

---

## 16. Finalize Attendance Test Cases

#### TC-FINAL-01: Finalize Creates Absent Records

| Field | Detail |
|-------|--------|
| **Precondition** | Class with 5 enrolled students, 2 have scanned in for today |
| **Steps** | 1. Navigate to `/classes/[id]` <br> 2. Click "Finalize (3 absent)" <br> 3. Confirm dialog |
| **Expected** | 3 absence records created. Summary cards update: Absent count = 3. Button changes to "Finalized ✓". |

#### TC-FINAL-02: Finalize Not Shown When Nobody Scanned

| Field | Detail |
|-------|--------|
| **Precondition** | Class with enrolled students, no attendance logs for today |
| **Steps** | 1. Navigate to `/classes/[id]` |
| **Expected** | "Finalize" button does NOT appear (no evidence class occurred). |

#### TC-FINAL-03: Finalize Not Shown on Holiday

| Field | Detail |
|-------|--------|
| **Precondition** | Day marked as holiday |
| **Steps** | 1. Navigate to `/classes/[id]` |
| **Expected** | "Finalize" button does NOT appear (day is excluded). |

#### TC-FINAL-04: Finalize Not Shown When All Present

| Field | Detail |
|-------|--------|
| **Precondition** | All enrolled students have scanned in |
| **Steps** | 1. Navigate to `/classes/[id]` |
| **Expected** | "Finalize" button does NOT appear (no students to mark absent). |

---

*Document generated from codebase analysis — February 2026*
