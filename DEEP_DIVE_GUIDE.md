# 🏁 The ClassTrack Grand Encyclopedia: Volume A
## The Definitive Technical & Functional Master Guide (v5.0.0)

ClassTrack is a professional-grade, biometric-integrated educational management ecosystem. It bridges the gap between physical classroom attendance and cloud-based student portal management using a high-performance **ESP32-S3 Kiosk** and an **A+ Armor Hardened Next.js Dashboard**.

---

## 🏛️ Chapter 1: System Vision & Strategic Architecture
The fundamental mission of ClassTrack is to provide a "Zero-Trust," biometric-first environment for institutional attendance management.

### 1.1 The Core Philosophy
The platform is built on three core pillars:
1. **Biometric Certainty**: Eliminating "proxy" attendance by tying scans directly to a physical AS608 fingerprint sensor.
2. **Data Integrity**: Using Supabase PostgreSQL with strict Row-Level Security (RLS) to ensure that only authorized administrative staff can view or modify records.
3. **Real-time Agility**: Utilizing WebSockets and Edge Runtimes to provide sub-100ms updates between the hardware Kiosk and the Instructor's dashboard.

### 1.2 The Technology Stack (The "Full Spectrum")
#### 1.2.1 Frontend Architecture
- **Framework**: Next.js 14.x (App Router).
- **Styling**: TailwindCSS (Utility-first) + Framer Motion (Transitions).
- **Icons**: Lucide React + FontAwesome 6 (for hardware icons).
- **State Management**: React Hooks (useState/useEffect) + Real-time Supabase subscriptions.

#### 1.2.2 Backend & Cloud Infrastructure
- **Database**: Supabase PostgreSQL + PostgREST.
- **Authentication**: GoTrue (JWT-based) with persistent session management.
- **Rate Limiting**: Upstash Redis (Global) + Local Memory Fallback.
- **AI Brain**: Google Gemini 1.5 Pro / 2.0 Flash (Identity-aware).

#### 1.2.3 Hardware & Firmware
- **MCU**: ESP32-S3 (Dual-core, 240MHz).
- **Memory**: 8MB PSRAM (Optimized for LVGL graphics and JSON buffering).
- **Framework**: PlatformIO (Arduino Framework v3.0+).
- **Graphics Library**: LVGL 8.3.11 with custom TFT drivers.

---

## 🔌 Chapter 2: The Silicon Layer (ESP32-S3 Deep-Dive)
The **SmartClassroom Kiosk** is the physical anchor of the ecosystem. It manages high-resolution graphics, complex UART communications with the bio-sensor, and asynchronous WiFi tasks.

### 2.1 Hardware Specifications (The "Raw Metal")
- **Display**: Waveshare 7-inch Touch LCD (800x480 resolution).
- **Bus**: ESP32-RGB Panel interface for lag-free performance.
- **Touch**: I2C-based GT911 controller.

#### 2.1.1 GPIO Pin Mapping (The Definitive List)
1. **RGB Interface Pins**:
    - **Data Pins (R0-R4)**: 14, 38, 18, 17, 10.
    - **Data Pins (G0-G5)**: 39, 0, 45, 48, 47, 21.
    - **Data Pins (B0-B4)**: 1, 2, 42, 41, 40.
    - **Control Pins**: DE (5), VSYNC (3), HSYNC (46), PCLK (7).
2. **I2C Bus (Liquid Crystal / IO Expander)**:
    - SDA/SCL: Pins 8, 9.
3. **Biometric Input (AS608)**:
    - **RX/TX**: Pins 44, 43 (Direct UART0 mapping).
    - **Reset/Power**: Handled via CH422G IO expander.

### 2.2 Firmware State Machine (The "Intelligence")
The kiosk transitions through several critical states in the `main.cpp` logic:

1. **BOOT_STATE**:
    - Initializes CH422G IO Expander.
    - Resets GT911 Touch Controller.
    - Loads `iclpep_logo.h` and `ceat_logo.h` into LVGL memory.
    - Reconciles local fingerprint templates with the Cloud via `batch_template_sync()`.

2. **IDLE_SCAN_STATE**:
    - Periodically checks for "Finger Pressed" via UART0.
    - If a match is found (Confidence > 50), it captures the Slot ID.
    - Triggers the `network_worker_task` to send a POST request to `/api/attendance/log`.

3. **ENROLLMENT_STATE**:
    - Triggered by a remote callback from the Teacher's dashboard.
    - Kiosk enters "Wait for Finger" mode.
    - Captures two separate scans to generate a high-confidence biometric template.
    - Saves to internal AS608 memory and syncs the Slot ID back to the Supabase User UID.

4. **OFFLINE_FALLBACK**:
    - If WiFi signal drops (RSSI < -85), the kiosk switches to "NVS Storage" mode.
    - Saves logs to internal flash segment `nvs_prefs`.
    - Auto-flushes records when `internet_check_task` confirms connectivity.

---

## 🌐 Chapter 3: The Web Logic (Server & Middleware Architecture)
The web application is built to be "Production-Hardened" against both brute-force attacks and session hijacking.

### 3.1 Middleware & Security Layers
The `middleware.ts` file is the "Shield" of the application, enforcing a strict A+ Grade Security Policy.

#### 3.1.1 CSP (Content Security Policy)
We utilize a **Nonce-based Policy** to block cross-site scripting (XSS).
- **default-src**: 'none' (Strict lockdown).
- **script-src**: Only allows 'self' and scripts signed with the per-request **Digital Nonce**.
- **style-src**: Only allows 'self' and nonced inline styles for Framer Motion.
- **connect-src**: Restricted to Supabase, Vercel Insights, and known WebSocket endpoints.

#### 3.1.2 The "Zero-Spam" Guard
We implement multiple layers of rate-limiting to protect the Gemini AI resources:
- **Identifier**: Authenticated User UUID (from Supabase Auth).
- **Quota**: 10 messages per day per account.
- **Mechanism**: Upstash Redis (Serverless) for global synchronization across Vercel regions.

### 3.2 Database Schema (The "Relational Web")
ClassTrack's data is normalized to ensure performance on low-end hardware.

1. **`students` Table**:
    - Keys: `id` (UUID), `sin` (Student Identification Number), `name` (Text), `department_id` (Foreign Key).
    - Indices: Composite index on `(name, sin)` for 50ms lookup times.

2. **`attendance_logs` Table**:
    - Keys: `id` (BigInt), `student_id` (UUID), `class_id` (UUID), `timestamp` (TIMESTAMPTZ).
    - logic: Automatically triggers a legacy "Attendance-Sync" event for the Instructor UI.

---

## 👥 Chapter 4: The Role & Feature Almanac (Part 1)
ClassTrack manages four distinct levels of permission.

### 4.1 The Student Role
The student portal is optimized for mobile-first scanning and history tracking.
1. **Attendance Dashboard**: Dynamic charts showing "Attendance Percentage" per subject.
2. **LOA (Leave of Absence) Center**: Upload and track "Excused" evidence directly to Supabase Storage.
3. **Profile Identity**: View enrolled fingerprint status (Confirming the Kiosk sync).
4. **Platform Alerts**: Department-wide notifications for suspensions or holiday announcements.

### 4.2 The Instructor Role
The instructor dashboard is the "Control Tower" of the classroom.
1. **Live Attendance Badge**: A pulsing UI element that shows current "Kiosk Activity."
2. **QR Generator**: Generates a dynamic, time-sensitive code for secondary attendance verification.
3. **Manual Overrides**: Corrects attendance for students whose fingers are physically dirty or unreadable by the sensor.
4. **Subject Management**: Mapping sessions to specific room IDs (e.g., STC102).

---
**[STAY TUNED — Volume B: API Matrix & Granular State Logic coming in Volume B]**
