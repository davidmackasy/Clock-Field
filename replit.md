# ClockField - Employee Tracking System

## Overview
ClockField is a comprehensive workforce operations platform for service businesses, streamlining management for Admins, Employees, and Clients. It aims to enhance efficiency in scheduling, attendance, payroll, and client management through a React/Express/PostgreSQL stack. The platform's modular design supports scalability and a rich feature set to cover diverse operational needs, including advanced features like a full CRM pipeline with AI-powered quoting, and a field notes system for on-site inspections.

## User Preferences
I prefer that the agent focuses on understanding the existing architecture and implementing new features or fixing bugs within that established framework. I value clear and concise communication, preferring direct answers and actionable suggestions over lengthy explanations. When making changes, please outline the proposed modifications before implementation, especially for significant architectural adjustments or database schema changes. I prefer an iterative development approach, with regular updates on progress and opportunities for feedback.

## System Architecture
The application is built as a full-stack JavaScript application.

**Frontend**: React with Vite, Tailwind CSS, shadcn/ui, wouter for routing, and TanStack Query for data management. UI/UX features role-specific layouts: Admin has desktop-first sidebar and mobile bottom tab navigation, while Employee and Client interfaces are mobile-first with bottom tab navigation.

**Backend**: Express.js handles API requests, authentication, and business logic.

**Database**: PostgreSQL with Drizzle ORM for type-safe interactions.

**Authentication**: Session-based using Passport.js with dual local strategies (email/password for Admin/Client, employeeId/PIN for Employees). Scrypt handles password hashing, and role-based access control (RBAC) is enforced.

**Core Features**:
*   **Authentication & Authorization**: Secure, role-based access with distinct login flows, employee activation, and forced password changes.
*   **User Management**: CRUD for employees and clients, including login access management and admin invitation.
*   **Scheduling**: Recurring shift scheduling with various frequencies and calendar views.
*   **Attendance & Time Tracking**: Clock-in/out, live timers, shift compliance, variance analysis, and admin adjustments.
*   **Payroll**: Integrated deductions estimator (configurable for Canadian taxes) and payroll estimation with overtime.
*   **Timesheets**: Generation, submission, and approval workflows.
*   **Client & Request Management**: Tools for client information and service request tracking.
*   **Work Log**: Employee system for documenting service work, including priority alerts, photo uploads, and public report generation.
*   **Publications**: Content module for SEO-friendly public pages (articles, guides) with a rich section builder, AI-assisted writing (gpt-4o-mini), and voice-to-text.
*   **Supply & Inventory Management**: Full inventory tracking and location expense management system, including an overview dashboard, item management, location-based expenses, supply request fulfillment, and purchase history.
*   **SaaS Layer**: Subscription management, Stripe integration for billing, and a Super Admin dashboard for platform-wide management and feature gating.
*   **Super Admin Trial Company Creation**: Super admins can provision trial companies with temporary access via specific backend routes and manage trial lifecycles (extend, end, resend setup email, generate temporary password).
*   **Temporary Password Flow**: System for generating and managing one-time temporary passwords for trial admins, enforcing password changes on first login, and providing setup status updates.
*   **Field Notes Module**: System for employees to capture on-site inspections with photos, voice recordings, and AI-generated summaries. Features an admin editor for document management (tabs for Document, Photos, Transcript, reordering, visibility toggles) and a public client-facing view that filters hidden content.
*   **Forms / Quote Requests Module**: A CRM pipeline and AI-powered quoting system with a 6-tab admin hub: Forms, Submissions (inbox, detail pane with AI estimate), Pipeline (kanban view), Estimator Settings (separate Residential/Commercial pricing tabs), Email Settings, and Embed options. It features AI Estimate generation (gpt-4o-mini) that picks the correct Residential or Commercial pricing profile automatically, and a Smart Cleaning Form with a hardcoded 6-step conditional flow.
*   **Agreements & E-Signature Module**: Integrated under Publications (Publications sidebar item → Publications/Agreements tabs). Full contract lifecycle with a structured 13-section builder (Header, Parties, Overview, Scope of Work, Service Schedule, Payment Terms, Contract Term, Termination, Non-Payment Enforcement, Confidentiality, Liability, Acceptance, Signatures). 3-panel layout: section navigator (left) + section form editor (center, with voice input and AI improvement buttons: Improve/Professional/Expand/Shorten) + live document preview (right). Payment Terms section auto-generates legal clauses from structured fields. Schedule and Termination sections generate auto-clauses. Agreements sent via email or shared link. Public signing page renders structured sections in a clean contract layout. PDF exports as A4-formatted structured document with all sections, proper margins, and signature blocks (client + provider + witness). Activity log tracks lifecycle events. Status lifecycle: Draft → Sent → Viewed → Signed/Declined. DB tables: agreement_templates, agreements (with sections_data jsonb, provider signature fields), agreement_activity_logs. AI endpoint: POST /api/admin/agreements/improve-text.
*   **Scheduled Daily Field Notes**: Photo-checklist system for cleaners, completely separate from existing Field Notes. Admin creates reusable templates (commercial or residential type) with Main Steps (sections) and Photo Tasks (steps, each with title, description, optional reference photo, isRequired flag). **AddMainStepModal** bulk-creates a section + all steps at once: select Main Area → Specific Area → multi-select items (per-area item lists via `getItems()`) → upload up to 8 reference photos → auto-labels each photo task with `{area} - {item}`. Templates assigned to cleaners via Assignments tab; assignments can be optionally linked to an existing recurring schedule (`scheduleId` on `scheduled_field_note_assignments`). Cleaners see today's required checklists via /employee/scheduled-field-notes and complete step-by-step photo captures via /employee/scheduled-field-notes/:submissionId. Clock-out blocked if required checklists incomplete. Admins review submissions (grouped by cleaner → drill into date-sorted history → step-by-step review). Admin generates public client report links. Public report: /public/scheduled-field-notes/:publicId (submitted photos only, compact 1:1 grid, lightbox). DB tables: scheduled_field_note_templates, scheduled_field_note_sections, scheduled_field_note_steps, scheduled_field_note_assignments (with schedule_id column), scheduled_field_note_submissions, scheduled_field_note_step_submissions. Options lib: `client/src/lib/scheduled-field-note-options.ts` — per-area item lists for all 16 commercial + 13 residential area categories.
*   **Hiring Package (New)**: 4th tab inside Publications admin page (alongside Publications, Agreements, Proposals). A full employee onboarding system using `employee_hiring_*` DB tables (already migrated). Admin flow at `/admin/publications` → Hiring Package tab has 7 inner tabs: Templates (create/edit policy templates with 7 default policies), Policies (edit policies for default template), Create Package (send to applicant by name/email/position), Sent Packages (list with copy link / resend / review), Submitted Applications, Approved/Hired, Archived. Admin can download PDF or ZIP of a submission and approve/reject/request missing docs via ReviewModal. Public applicant flow at `/public/hiring-package/:token` (no auth): 7 steps — sequential policy acceptance (one policy per screen), Personal Info, Emergency Contacts, Medical Info, Document Uploads (sin, void cheque, gov ID, whmis, proof of address), Signature canvas + final acknowledgement, Status page. All progress auto-saves. DB tables: `employee_hiring_templates` (policies as JSON), `employee_hiring_packages` (no policies column — reads from template via templateId), `employee_hiring_submissions`, `employee_hiring_policy_acceptances` (companyId + acceptedAt required), `employee_hiring_documents` (companyId + fileName + uploadedAt required). All tables require explicit `createdAt` + `updatedAt` on INSERT (no DB defaults). API: `/api/hiring-package/*` (admin, requireAuth+requireRole("admin")), `/api/public/hiring-package/*` (public, no auth). Email via Mailgun (`sendHiringPackageEmail` in mail.ts). File uploads via multer memoryStorage, base64 in DB. Key files: `client/src/pages/admin/HiringPackageAdmin.tsx`, `client/src/pages/public/HiringPackagePage.tsx`, HP routes at lines ~9527+ in `server/routes.ts`, storage methods in `server/storage.ts`.

## External Dependencies
*   **PostgreSQL**: Primary database.
*   **Stripe**: Subscription management, payment processing, customer portals, webhooks.
*   **Passport.js**: Authentication middleware.
*   **TanStack Query**: Frontend data fetching and state management.
*   **Tailwind CSS**: Utility-first CSS framework.
*   **shadcn/ui**: UI component library.
*   **Vite**: Frontend build tool.
*   **Drizzle ORM**: TypeScript ORM for PostgreSQL.
*   **OpenAI (gpt-4o-mini)**: AI-assisted writing in Publications and AI Estimate generation in Forms/Quote Requests.
*   **Web Speech API**: Browser-native voice-to-text in Publications.
*   **Mailgun**: Used for sending emails (e.g., confirmation, estimate summary, quote ready, submission responses).