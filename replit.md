# ClockField - Employee Tracking System

## Overview
ClockField is a comprehensive workforce operations platform designed for service businesses. It streamlines management for Admins, Employees, and Clients by integrating scheduling, attendance, payroll, and client management functionalities. The platform aims to boost efficiency and scalability through its modular design, supporting features like a full CRM pipeline with AI-powered quoting, a field notes system for on-site inspections, and an internal training hub.

## User Preferences
I prefer that the agent focuses on understanding the existing architecture and implementing new features or fixing bugs within that established framework. I value clear and concise communication, preferring direct answers and actionable suggestions over lengthy explanations. When making changes, please outline the proposed modifications before implementation, especially for significant architectural adjustments or database schema changes. I prefer an iterative development approach, with regular updates on progress and opportunities for feedback.

## System Architecture
The application is a full-stack JavaScript application built with a modular and scalable architecture.

**Frontend**: React with Vite, Tailwind CSS, shadcn/ui, wouter for routing, and TanStack Query for data management. It features role-specific UI/UX designs: Admin has a desktop-first sidebar, while Employee and Client interfaces are mobile-first with bottom tab navigation.

**Backend**: Express.js handles API requests, authentication, and business logic.

**Database**: PostgreSQL with Drizzle ORM for type-safe interactions.

**Authentication**: Session-based using Passport.js, supporting distinct login flows for Admin/Client (email/password) and Employees (employeeId/PIN). Scrypt is used for password hashing, and role-based access control (RBAC) is enforced.

**Core Features**:
*   **Authentication & Authorization**: Secure, role-based access with distinct login flows and employee activation.
*   **User Management**: CRUD operations for employees and clients, including admin invitation and login access management.
*   **Scheduling**: Recurring shift scheduling with various frequencies and calendar views.
*   **Attendance & Time Tracking**: Clock-in/out, live timers, shift compliance, and variance analysis.
*   **Payroll**: Integrated deductions estimator and payroll estimation with overtime calculations.
*   **Timesheets**: Generation, submission, and approval workflows.
*   **Client & Request Management**: Tools for managing client information and service requests.
*   **Messages Inbox**: A dedicated 3-column enterprise inbox at `/admin/messages` (Workiz-inspired). Column 1 shows category filters (All, Clients, Team, Assigned, Archived) with live counts. Column 2 shows a searchable conversation list with avatars, role labels, previews, and unread indicators. Column 3 shows the full thread with an initial request card (From/Subject/Message/Priority fields + action buttons: Add Client, Create Schedule, Create Quote), chat-bubble message history, quick-reply chips, and a reply composer (Ctrl+Enter to send). Powered by existing `clientRequests` + `requestMessages` data — no backend changes. Mobile-responsive (list → thread with back button). "Messages" added to main sidebar nav; the former "Messages" account nav item was renamed "Notifications" (still links to `/admin/platform-messages`).
*   **Work Log**: Employee system for documenting service work, with photo uploads and public report generation.
*   **Publications**: Content management module for SEO-friendly public pages, featuring a rich section builder and AI-assisted writing.
*   **Supply & Inventory Management**: Comprehensive tracking system for inventory and location-based expenses. Supplies page is now a sub-tab under Work Log Hub (at `/admin/work-log/supplies`), no longer a standalone sidebar item.
*   **Incident Report Wizard**: A 13-step full-screen wizard for structured incident reporting (`client/src/pages/admin/incident-report-wizard.tsx`). Triggered from the "Incident Report" button on the Admin Reports page. Steps: Report Info → Incident Overview → People Involved → Description (AI narrative) → Witnesses → Evidence/Photos → Equipment → Immediate Actions → Root Cause → Corrective Actions → Client Notification → Sign-off → Attachments & Submit. The wizard auto-saves as draft after Step 1 and PATCHes on each navigation. New DB columns added to the `reports` table: `supervisor_notified`, `supervisor_name`, `incident_types`, `people_involved`, `narrative_summary`, `root_cause`, `contributing_factors`, `corrective_actions_structured`, `client_notification_detail`, `witness_list`, `equipment_involved`, `area_secured`, `attachments_checklist`. The ReportDetailDialog in admin/reports.tsx was enhanced to display all new wizard fields (incident types chips, people involved list, witness list, equipment list, corrective actions with completion status, client notification detail).
*   **SaaS Layer**: Subscription management, Stripe integration for billing, and a Super Admin dashboard for platform-wide management and feature gating, including trial company creation and management.
*   **Field Notes Module**: System for employees to capture on-site inspection data with photos, voice recordings, and AI-generated summaries, with an admin editor and public client-facing view.
*   **Scheduled Daily Field Notes**: A photo-checklist system for cleaners with reusable templates, photo task management, and public client reports.
*   **Forms / Quote Requests Module**: A CRM pipeline and AI-powered quoting system with a multi-tab admin hub, AI estimate generation, and a Smart Cleaning Form with a conditional flow.
*   **Agreements & E-Signature Module**: Full contract lifecycle management with a structured section builder, voice input, AI improvement buttons, live preview, PDF export, and an activity log.
*   **Hiring Package**: An employee onboarding system with configurable policies, document uploads, e-signatures, and an admin review process.
*   **Training Hub**: A Udemy-style internal training system for employees and public learners, featuring course creation (videos, text, images), module editing, employee assignment, completion tracking, and certificate generation. It also includes an AI Course Wizard for generating course content and quizzes. Admins can toggle a public share link per course (auto-generated `publicId`) so non-employees can enroll via `/training/public/:publicId` with name + email; the admin course detail shows a "Public Link Learners" roster (name, email, progress %, modules completed, best quiz score, pass/fail, certificate, last activity) alongside the assigned-employee cohort.
*   **Employee Profile System**: CRM-style admin workspace per employee with a 5-tab profile drawer (Profile / Schedule / Attendance / Documents / Training). Profile supports a view/edit toggle. Documents tab uploads HR files (resume, ID, certifications, contracts) — files are stored as base64 in the `employee_documents` table (mirrors training assets), with 30MB cap enforced server-side from the actual decoded payload, tenant-scoped CRUD, and document body redacted from API logs. Training tab is read-only and aggregates per-employee progress from existing training tables (no writes).

## External Dependencies
*   **PostgreSQL**: Primary database.
*   **Stripe**: Subscription management, payment processing, customer portals, webhooks.
*   **Passport.js**: Authentication middleware.
*   **TanStack Query**: Frontend data fetching and state management.
*   **Tailwind CSS**: Utility-first CSS framework.
*   **shadcn/ui**: UI component library.
*   **Vite**: Frontend build tool.
*   **Drizzle ORM**: TypeScript ORM for PostgreSQL.
*   **OpenAI (gpt-4o-mini)**: Used for AI-assisted writing (Publications), AI estimate generation (Forms/Quote Requests), and the AI Training Course Builder (generating course drafts, improving text, generating module content, and quizzes).
*   **Web Speech API**: Browser-native voice-to-text functionality (Publications).
*   **Mailgun**: Used for sending various emails (e.g., confirmations, estimate summaries, hiring packages).