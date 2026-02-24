# ClassTrack — Feature Matrix by Role

> Northwestern University Smart Classroom Attendance System  
> Comprehensive breakdown of every feature available to each user role.

---

## Table of Contents

1. [Role Hierarchy Overview](#role-hierarchy-overview)
2. [Super Admin](#-super-admin)
3. [System Admin (Department Admin)](#-system-admin-department-admin)
4. [Instructor](#-instructor)
5. [Student (Student Portal)](#-student-student-portal)
6. [Shared Features](#-shared-features)

---

## Role Hierarchy Overview

| Role | Scope | Profile Selection | Description |
|------|-------|-------------------|-------------|
| **Super Admin** | University-wide | No (locked to admin profile) | Full system authority. Manages the infrastructure itself. |
| **System Admin** | Department-scoped | Yes (Netflix-style) | Manages instructors, devices, and data within their department. |
| **Instructor** | Own classes only | Yes (Netflix-style) | Manages attendance, students, classes, and evidence for their assigned classes. |
| **Student** | Own records only | N/A (SIN-based login) | View-only access to personal attendance and evidence submission. |

---

## 🔴 Super Admin

> **Dashboard Title:** "Command Center Infrastructure"  
> **Scope:** University-wide — can see and manage ALL departments, ALL instructors, ALL data.

### Dashboard — University Pulse

| Feature | Description |
|---------|-------------|
| **Status Cards** | Real-time counters: Active Departments, Total Population (instructors + students), Active Sessions (classes with attendance in last 2 hours), System Operational status |
| **Traffic Analytics** | Hourly check-in heatmap for the last 24 hours, visualizing system-wide attendance activity peaks and valleys |
| **Security Audit Feed** | Live stream of the 10 most recent audit log entries (who did what, when, to what target) displayed directly on dashboard |
| **Gateway Health** | IoT infrastructure health panel showing Tuya Cloud connectivity status, device counts by type, and any error states |

### Admin Management (`/dashboard/admin/provisioning`)

| Feature | Description |
|---------|-------------|
| **Provision New Admin** | Create a brand-new auth account (email + auto-generated password) and assign them as a department admin. Displays generated credentials for one-time sharing. |
| **Lock / Unlock Admin** | Toggle an admin's `is_locked` status to temporarily suspend or restore their access. Locked admins cannot log in. |
| **View All Admins** | List every admin profile in the system with their name, department assignment, lock status, and super admin flag |
| **Reassign Admin Department** | Change which department an existing admin belongs to via dropdown |
| **Copy Credentials** | One-click copy of the provisioned admin's email and password for secure sharing |

### Departments (`/dashboard/admin/departments`)

| Feature | Description |
|---------|-------------|
| **Create Department** | Add a new department with name, code, and description |
| **Freeze / Unfreeze Department** | Toggle `is_active` flag. Frozen departments block all non-super-admin access for users in that department (enforced by middleware). |
| **Delete Department** | Permanently remove a department and all its associations |
| **View Department Cards** | Each department displays: name, code, description, admin name, total instructors, total students, last activity timestamp, and active/frozen status |
| **Reset Admin Profile** | Force-reset a department admin's auth_user_id link (for account recovery) |

### Global Directory (Sidebar Dropdown)

| Feature | Description |
|---------|-------------|
| **Read-Only Classes** | View all classes across every department. Cannot create, edit, or delete. |
| **Read-Only Students** | View all students across every department. Cannot create, edit, or delete. |

### API Key Management (`/dashboard/admin/api-keys`)

| Feature | Description |
|---------|-------------|
| **Generate API Key** | Create a new API key for a kiosk/device with name, device type, and scope. Raw key displayed once only. |
| **One-Time Key Display** | Raw key shown in green banner. After clicking "I've copied it — dismiss", key is hidden permanently. |
| **Revoke API Key** | Disable a key so it can no longer be used for authentication. |
| **Delete Revoked Key** | Permanently remove a revoked API key from the system. |

### Reports (`/reports`)

| Feature | Description |
|---------|-------------|
| **At-Risk Students Report** | View students with low attendance rates across the entire university, with risk-level indicators (Critical / Warning / Watch) |
| **Attendance Rate Metrics** | Per-student breakdown: total sessions, absences, attendance percentage, consecutive absence count |

### Settings (`/settings`)

| Feature | Description |
|---------|-------------|
| **Theme Toggle** | Switch between Light and Dark mode (system-wide CSS theme) |
| **Hardware Info** | View biometric terminal status and firmware version |

---

## 🟠 System Admin (Department Admin)

> **Dashboard Title:** "Smart Classroom: Attendance System"  
> **Scope:** Department-scoped — can manage all instructors and data within their department.

### Dashboard — Regular Dashboard

| Feature | Description |
|---------|-------------|
| **Stat Cards** | Total Students, Today's Present count, Upcoming Class, and Class Count — scoped to all instructors linked to the admin's auth account |
| **Upcoming Class Widget** | Shows the nearest scheduled class with countdown timer, room, and section |
| **Live Attendance Feed** | Real-time attendance log for today, with Supabase Realtime subscription for instant updates |
| **IoT Room Controls** | Inline smart device switches (Lights, Fans, ACs) for the currently active room, with group toggle support |
| **Quick Actions** | "Add Student" and "Add Class" buttons that open modal dialogs directly from the dashboard |
| **Recent Activity** | Last 5 attendance events displayed in the sidebar |

### Admin Console (`/dashboard/admin`)

| Feature | Description |
|---------|-------------|
| **Quick Access Cards** | Links to All Classes, System Reports, Audit Trail, Security, and Deletion Requests |
| **Sensor Memory Map (Biometric Matrix)** | Real-time grid of all students with their fingerprint enrollment status (Slot IDs), with Supabase Realtime for live updates when students are enrolled/modified. Shows connection status indicator and last-updated timestamp. |

### Instructor Management (`/dashboard/admin/instructors`)

| Feature | Description |
|---------|-------------|
| **Add Instructor** | Create a new instructor profile with name, PIN (optional), and role. Department is auto-locked to the admin's own department (cannot assign to other departments). |
| **View Instructors Directory** | List all instructor profiles within the admin's department |
| **Edit Instructor** | Modify instructor name, PIN, and role |
| **Delete Instructor** | Remove an instructor profile (with confirmation). Logs audit event. |

### IoT Device Management (`/dashboard/admin/devices`)

| Feature | Description |
|---------|-------------|
| **View Devices** | List all IoT devices within the admin's department scope, showing name, type, Tuya ID, DP Code, assigned room, and authorized instructors |
| **Assign Device to Department** | Link a device to a department for data isolation |
| **Restrict Device to Instructors** | Select which specific instructors can control a device |
| **Assign Device to Room** | Link a device to a physical room |
| **Delete Device** | Remove an IoT device registration |
| **Note:** Device registration (creating new devices) is **Super Admin only** | |

### Room Management (`/dashboard/admin/rooms`)

| Feature | Description |
|---------|-------------|
| **Create Room** | Add a new room with name, building, and capacity — auto-assigned to the admin's department |
| **Edit Room** | Modify room name, building, and capacity inline |
| **Delete Room** | Remove a room (with confirmation) |
| **Assign Devices to Room** | Drag-and-drop style device assignment panel showing unassigned and room-assigned devices with color-coded type indicators |
| **Room Status** | Each room shows assigned device count and types |

### Kiosk Inventory (`/dashboard/admin/kiosks`)

| Feature | Description |
|---------|-------------|
| **View All Kiosks** | List ESP32 kiosk devices with serial number, status (Pending/Approved/Rejected), online/offline indicator, last heartbeat, firmware version, IP address, assigned room, and label |
| **Approve / Reject Kiosk** | Approve or reject a kiosk that has registered itself (pending approval flow) |
| **Assign Kiosk to Admin** | Link a kiosk to a specific admin's scope |
| **Bind Kiosk to Room** | Assign a kiosk device to a physical room |
| **Edit Kiosk Label** | Set a human-readable label for identification |
| **Delete Kiosk** | Remove a kiosk from the system inventory |
| **Online/Offline Status** | Real-time heartbeat tracking with "last seen" timestamp |

### Evidence Review (`/dashboard/admin/evidence`)

| Feature | Description |
|---------|-------------|
| **View All Evidence** | List all submitted evidence across the department, showing student name, SIN, year level, file type, linked absence dates, submission date, and review status |
| **Approve Evidence** | Mark evidence as approved — updates the corresponding attendance status to "Excused" |
| **Reject Evidence** | Mark evidence as rejected — no attendance change |
| **Delete Evidence** | Permanently delete reviewed (approved/rejected) evidence submissions to clean up old records |
| **Preview Files** | View submitted evidence files (images, PDFs) inline |

### Archived / Recently Deleted (`/archived`)

| Feature | Description |
|---------|-------------|
| **View Archived Students** | List all archived (soft-deleted) students with name, SIN, and archive date |
| **View Archived Classes** | List all archived classes with name, year level, and archive date |
| **Restore Student** | Un-archive a student, making them appear in active lists again |
| **Restore Class** | Un-archive a class, restoring it to the active list |
| **Delete Forever (Student)** | Permanently hard-delete an archived student. Cannot be undone. |
| **Delete Forever (Class)** | Permanently hard-delete an archived class. Cannot be undone. |
| **Deletion Request Queue** | Review and approve/reject instructor requests to permanently delete archived items |
| **Tab Switcher** | Switch between Students and Classes tabs with item counts |
| **Loading Animations** | Spinners on Restore and Delete buttons while processing |

### Security Panel (`/dashboard/admin/security`)

| Feature | Description |
|---------|-------------|
| **Reset Password** | Select an instructor and trigger a password reset email or direct reset |
| **Reset PIN** | Clear an instructor's PIN code (removes PIN protection from their profile) |
| **Target Selection** | Searchable list of all users and instructors within scope |

### Audit Logs (`/dashboard/admin/audit-logs`)

| Feature | Description |
|---------|-------------|
| **Master Audit Trail** | Forensic log of up to 100 most recent administrative actions |
| **Columns** | Timestamp, Actor (who), Action (what — color-coded DELETE/CREATE/UPDATE), Target Type & ID, Detailed JSON payload |
| **Filters** | Search by action type (e.g., "DELETE"), filter by actor |

### Attendance (`/attendance`)

| Feature | Description |
|---------|-------------|
| **View All Attendance** | See attendance logs for ALL classes within the department (not scoped to a single instructor) |
| **Date Filter** | Pick any date to view historical attendance |
| **Search Students** | Filter attendance records by student name |
| **Live Real-Time Updates** | Supabase Realtime subscription auto-adds new attendance entries |
| **Status Labels** | Present, Late, Absent, Cut Class (left early), Ghosting (didn't leave), Invalid (too early), Excused |

### Classes (`/classes`)

| Feature | Description |
|---------|-------------|
| **View All Classes** | List all classes with name, section, schedule, instructor, enrolled student count |
| **Create Class** | Add a new class with name, section, year level, schedule (day + time), and assign instructor |
| **View Class Detail** | Click a class card → see enrolled students, attendance summary for that class |
| **Note:** System Admin is **read-only** for classes | Cannot edit, archive, or delete. Only instructors can perform these actions. |

### Students (`/students`)

| Feature | Description |
|---------|-------------|
| **View All Students** | Grid/list of all students showing name, SIN, year level, and enrolled class count |
| **Add Student** | Create a new student with name, SIN, year level, guardian contact (email/name), and optional fingerprint ID — includes batch CSV import support |
| **Note:** System Admin is **read-only** for students | Cannot edit, archive, or delete. No checkboxes for multi-select. Only instructors can modify students. |

### Auto-Absent Email Notifications (`/api/cron/absent-notify`)

| Feature | Description |
|---------|-------------|
| **Automatic Parent Notification** | Cron job (runs daily) automatically detects students who were Absent the previous day and sends a branded HTML email to their guardian_email address. |
| **No Human Confirmation** | Emails are sent fully automatically — no instructor or admin action required. |
| **Resend Integration** | Uses Resend API for email delivery. Falls back to dry-run logging if `RESEND_API_KEY` not set. |
| **Grouped by Student** | If a student is absent from multiple classes, one email lists all missed classes. |
| **Audit Logging** | Every notification sent is logged in the audit trail with student ID, guardian email, and absence date. |
| **CRON_SECRET Protection** | Endpoint protected by secret token to prevent unauthorized triggers. |

### Reports (`/reports`)

Same as Super Admin — scoped to the admin's department.

### Settings (`/settings`)

| Feature | Description |
|---------|-------------|
| **Theme Toggle** | Light / Dark mode |
| **Hardware Info** | Biometric terminal status |
| **Delete Profile** | Remove own instructor profile (role-gated: available to admins) |
| **Delete Account** | Full account deletion |

---

## 🟢 Instructor

> **Dashboard Title:** "Smart Classroom: Attendance System"  
> **Scope:** Own classes only — can only see students enrolled in their classes and attendance for their classes.

### Dashboard

| Feature | Description |
|---------|-------------|
| **Stat Cards** | Total Students (in own classes), Today's Present, Upcoming Class, Class Count |
| **Upcoming Class Widget** | Next scheduled class with time, room, and section |
| **Mark Attendance Button** | One-click button to mark manual attendance for the current live class |
| **IoT Room Controls** | Smart device switches for the room of the currently active class (lights, fans, ACs). Only visible during scheduled class time. Respects room-scoped authorization. |
| **Quick Actions** | "Add Student" and "Add Class" dialogs |
| **Kiosk Health Card** | Shows online/offline status of ESP32 kiosk devices, with diagnostic ping button for bidirectional communication testing |
| **Room Environment** | Temperature, humidity, and occupancy data from IoT sensors in the active room |

### Attendance (`/attendance`)

| Feature | Description |
|---------|-------------|
| **View Own Attendance** | See attendance logs only for classes assigned to this instructor |
| **Date Filter** | Navigate to any date for historical views |
| **Search Students** | Filter by student name within own classes |
| **Live Real-Time Table** | Supabase Realtime subscription for instant attendance updates |
| **Advanced Status Labels** | Present, Late, Absent, Cut Class, Ghosting, Invalid (Too Early), Excused, Incomplete |

### Evidence Queue (`/evidence`) — *Instructor Only*

| Feature | Description |
|---------|-------------|
| **View Pending Evidence** | List of student-submitted evidence files awaiting review, scoped to own classes only |
| **Approve Evidence** | Accept evidence → student's attendance status is updated to "Excused" for the linked dates |
| **Reject Evidence** | Reject evidence → no change to attendance |
| **Preview Files** | Inline preview of uploaded images, PDFs, and other evidence files |
| **Status Badges** | Visual indicators: Pending (yellow), Approved (green), Rejected (red) |
| **Linked Dates** | View which specific absence dates the evidence is covering |

### Classes (`/classes`)

| Feature | Description |
|---------|-------------|
| **View Own Classes** | List only classes assigned to this instructor |
| **Create Class** | Add a new class (auto-assigned to this instructor) |
| **Edit Class** | Modify class name, section, schedule |
| **Archive Class** | Soft-delete a class with confirmation |
| **View Class Detail** | Enrolled students list, class-specific attendance |
| **Assign / Unenroll Students** | Manage student enrollment within a class. Unenroll with confirmation ("attendance history preserved") |
| **Export Attendance CSV** | Download per-class attendance as CSV file (Student Name, SIN, Year Level, Status, Time In, Time Out) with summary stats |

### Students (`/students`)

| Feature | Description |
|---------|-------------|
| **View Own Students** | Only students enrolled in this instructor's classes |
| **Add Student** | Create new student with name, SIN, year level, optional fingerprint ID, CSV batch import |
| **Edit Student** | Modify student details |
| **Archive Student** | Soft-delete student with batch multi-select support ("Archive Selected") |
| **Student Detail** | View enrollment and attendance history |

### QR Scanner (`/dashboard/scanner`) — *Instructor Only*

| Feature | Description |
|---------|-------------|
| **Camera QR Scanner** | Real-time camera-based QR code scanner using the instructor's device camera |
| **Class Selection** | Select which class to log attendance for |
| **QR Verification** | Validates scanned QR payloads against registered students, rooms, and class schedules |
| **Attendance Logging** | Logs Time In / Time Out from verified QR scans |
| **Scan History** | Recent scan results with success/error feedback |
| **Manual Override** | Ability to manually mark attendance if QR scanning fails |

### Reports (`/reports`)

| Feature | Description |
|---------|-------------|
| **At-Risk Students** | Students in own classes with attendance below threshold, ranked by severity |
| **Risk Levels** | Critical (< 50%), Warning (< 75%), Watch (< 85%) |
| **Student Details** | Name, SIN, year level, total sessions, absences, attendance rate, consecutive absences, reason for flagging |

### Profile (`/profile`)

| Feature | Description |
|---------|-------------|
| **View Profile** | Display name, email, role, department |
| **Edit Name** | Update display name |
| **PIN Management** | Set, change, or remove the profile PIN code (used for Netflix-style profile protection) |
| **Kiosk Mode Toggle** | Enable/disable kiosk mode for the account |

### Settings (`/settings`)

| Feature | Description |
|---------|-------------|
| **Theme Toggle** | Light / Dark mode |
| **Hardware Info** | View biometric terminal status |
| **Delete Profile** | Remove own instructor profile |
| **Delete Account** | Full account deletion (with confirmation) |

---

## 🔵 Student (Student Portal)

> **URL:** `/student/portal` (public, no auth required)  
> **Scope:** Own records only — accessed via Student Identification Number (SIN).

### Access & Authentication

| Feature | Description |
|---------|-------------|
| **SIN Login** | Students enter their Student Identification Number (SIN) to access their portal — no email/password needed |
| **Student Lookup** | System validates the SIN and retrieves the student's name and enrollment data |
| **Session Persistence** | SIN is stored in browser for convenience; students can log out to clear it |
| **No Account Required** | Students do not need a Supabase auth account — access is SIN-based |

### Attendance Dashboard

| Feature | Description |
|---------|-------------|
| **Overall Attendance Summary** | Aggregate stats across all classes: total sessions, present count, late count, absent count, excuse-pending count, and overall attendance percentage |
| **Per-Class Breakdown** | Itemized attendance for each enrolled class showing: subject name, section, year level, present/late/absent/excuse-pending counts, and attendance percentage |
| **Attendance Percentage Bar** | Visual progress bar for each class showing attendance health (color-coded green → yellow → red) |
| **Real-Time Data** | Stats are fetched live from the API at each login (not cached) |

### Evidence Submission

| Feature | Description |
|---------|-------------|
| **Submit Evidence** | Upload evidence files (medical certificates, excuse letters, etc.) to justify absences |
| **File Upload** | Support for images (JPG, PNG) and documents (PDF) |
| **Date Linking** | Select specific absence dates the evidence covers |
| **Description Field** | Optional text description explaining the circumstances |
| **Class Selection** | Link evidence to a specific class |
| **Submission Status** | View the current status of submitted evidence: Pending, Approved, or Rejected |

### UI & Navigation

| Feature | Description |
|---------|-------------|
| **Tab Navigation** | Switch between "Attendance" and "Submit Evidence" tabs |
| **Responsive Design** | Fully mobile-optimized PWA-ready layout |
| **Back-to-Login Link** | Link to return to the main instructor/admin login page |
| **Loading States** | Skeleton loaders and spinner indicators for data fetching |

---

## 🔧 Shared Features

These features are available across multiple roles:

| Feature | Roles | Description |
|---------|-------|-------------|
| **Netflix-Style Profile Switching** | System Admin, Instructor | Choose which profile (admin or instructor) to use after login. Each profile has independent scope. |
| **PIN-Protected Profiles** | System Admin, Instructor | Optional PIN code to protect individual profiles within a shared account |
| **Global Search** | All authenticated | Search students, classes, and attendance records from any page |
| **Notification Dropdown** | All authenticated | In-app notifications for system events (last 24 hours), auto-fetched from the notifications table |
| **Dark / Light Theme** | All authenticated | System-wide CSS theme toggle, persisted across sessions |
| **Collapsible Sidebar** | All authenticated | Responsive sidebar with expand/collapse toggle and university branding |
| **Real-Time Updates** | All authenticated | Supabase Realtime subscriptions for live attendance and data changes |
| **Rate Limiting** | All (enforced) | Upstash Redis rate limiting (with in-memory fallback) applied per route type — Auth: 10/min, API: 60/min, Attendance: 30/min, Mutations: 20/min |
| **CORS Protection** | All (enforced) | Restricted origins for cross-origin requests |
| **Security Headers** | All (enforced) | HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy |
| **Department Isolation** | Admin, Instructor | Row-Level Security ensures users can only access data within their department or own classes |
| **Account Approval Flow** | New Users | New user accounts require admin approval before access is granted. Pending users see a "Pending Approval" page. |
| **Auto Auth-Link Repair** | All authenticated | Dashboard automatically repairs broken auth_user_id ↔ instructor email links on page load |

---

## API Endpoints Reference

| Endpoint | Purpose | Auth Required |
|----------|---------|:---:|
| `POST /api/attendance/log` | Log attendance from ESP32 kiosks | API Key |
| `GET /api/sync` | Sync student/class data to ESP32 kiosks | API Key |
| `POST /api/fingerprint/enroll` | Enroll fingerprint from ESP32 | API Key |
| `GET /api/fingerprint/check` | Check fingerprint enrollment status | API Key |
| `POST /api/iot/control` | Control IoT devices (Tuya Cloud) | Session |
| `GET /api/kiosk/*` | Kiosk registration, heartbeat, batch-sync | API Key |
| `POST /api/qr/generate` | Generate student QR codes | Session |
| `POST /api/qr/verify` | Verify scanned QR payloads | Session |
| `GET /api/reports/at-risk` | Fetch at-risk student analytics | Session |
| `GET /api/student/attendance` | Fetch student attendance by SIN | Public |
| `POST /api/evidence/public-upload` | Upload evidence files | Public |
| `GET /api/health` | System health check | Public |
| `GET /api/metrics` | System metrics | Public |
| `GET /api/status` | Connectivity handshake for ESP32 | Public |
| `POST /api/admin/approve` | Approve pending account requests | Session (Admin) |
| `GET /api/search` | Global search | Session |
| `GET /api/occupancy` | Room occupancy data | Session |

---

*Document generated from codebase analysis — February 2026*
