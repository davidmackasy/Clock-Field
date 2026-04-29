# ClockField - Employee Tracking System

## Overview
ClockField is a comprehensive workforce operations platform designed for service businesses. It streamlines management for Admins, Employees, and Clients through a React/Express/PostgreSQL stack. The platform aims to enhance efficiency in scheduling, attendance, payroll, and client management, offering a robust solution for businesses to manage their workforce effectively. Its modular design supports scalability and a rich feature set to cover diverse operational needs.

## User Preferences
I prefer that the agent focuses on understanding the existing architecture and implementing new features or fixing bugs within that established framework. I value clear and concise communication, preferring direct answers and actionable suggestions over lengthy explanations. When making changes, please outline the proposed modifications before implementation, especially for significant architectural adjustments or database schema changes. I prefer an iterative development approach, with regular updates on progress and opportunities for feedback.

## System Architecture
The application is built as a full-stack JavaScript application.
**Frontend**: Developed with React, utilizing Vite for tooling, Tailwind CSS for styling, shadcn/ui for UI components, wouter for routing, and TanStack Query for data fetching and state management. The UI/UX is designed with role-specific layouts; Admin features a desktop-first sidebar navigation and a mobile-optimized bottom tab navigation, while Employee and Client interfaces are mobile-first with bottom tab navigation.
**Backend**: Implemented using Express.js. It handles API requests, authentication, and business logic.
**Database**: PostgreSQL is used as the relational database, with Drizzle ORM providing a type-safe interface for database interactions.
**Authentication**: A session-based authentication system is employed, featuring Passport.js with dual local strategies (email+password for Admin/Client and employeeId+PIN for Employees). Password hashing is secured using scrypt. Role-based access control (RBAC) is enforced across the application.
**Core Features**:
- **Authentication & Authorization**: Secure, role-based access with distinct login flows for Admins/Clients and Employees, including employee activation and forced password changes.
- **User Management**: Comprehensive CRUD operations for employees and clients, including login access management (enable/disable, PIN reset). Admin users can also be invited and managed.
- **Scheduling**: Robust recurring shift scheduling with various frequencies and calendar views (Day, Week, Month).
- **Attendance & Time Tracking**: Clock-in/out functionality with live timers, shift compliance flags, and advanced attendance tracking features including variance analysis and admin adjustments.
- **Payroll**: An integrated payroll deductions estimator (configurable for Canadian taxes) and a payroll estimation module with overtime calculation.
- **Timesheets**: Generation of pay-period timesheets for employees, with submission and approval workflows.
- **Client & Request Management**: Tools for managing client information and tracking service requests.
- **Work Log**: A system for employees to document service work, including priority clean alerts, photo uploads, and public report generation.
- **Publications**: A standalone content module allowing business admins to create SEO-friendly public pages (articles, product explanations, service guides). Features include a rich section builder, cover image upload, pricing tables, AI-assisted writing (gpt-4o-mini), voice-to-text (Web Speech API), helpful voting, and public URLs at `/p/:slug`. DB tables: `publications`, `publication_sections`, `publication_media`, `publication_pricing`, `publication_votes`. Admin pages at `/admin/publications` and `/admin/publications/:id`; public page at `/p/:slug` (no auth required).
- **Supply & Inventory Management**: A full inventory tracking and location expense management system. Organized into 5 admin tabs: (1) **Overview** — stats cards (total items, out of stock, running low, inventory value, total spent, open requests), top locations by spend, recent purchases, and an inventory status snapshot; (2) **Inventory** — item cards with In Stock/Running Low/Out of Stock status badges, unit price, total value, and 3 actions per item (Edit, Restock, Assign to Location). "Assign to Location" decrements stock and automatically creates a `location_supply_expenses` record + `inventory_movements` audit record. "Restock" creates an `inventory_purchases` record; (3) **Location Expenses** — location cards grouped by total spend, with a breakdown sheet per location showing each expense line, plus "Add Supply to Location" modal (from header button) that lets admin pick an inventory item, location, optional employee, quantity, with stock validation and automatic expense creation; (4) **Requests** — cleaner supply request cards with Fulfill from Inventory / Mark Ordered / Resolve / Not Needed action buttons per card; "Fulfill from Inventory" opens a dialog to select inventory item + quantity to deduct; (5) **Purchase History** — searchable 2-col/3-col grid of all restock purchases. New DB tables: `inventory_items`, `inventory_purchases`, `inventory_movements`, `location_supply_expenses`. `location_supply_expenses` schema includes `assignedEmployeeId`/`assignedEmployeeName` fields. New API routes: `/api/supplies/company-employees` (employee selector), `/api/employee/supply-requests` (employee supply request creation), `/api/employee/supplies/:id` (supply detail with admin notes). **Employee supplies page** (mobile-first): grid layout (2 columns), location header card with name/address, "Request" button at top to submit new supply requests, supply detail sheet shows admin updates/notes, `GET /api/employee/supplies` returns location-grouped supply data.
- **SaaS Layer**: Includes a subscription management system with different plans (legacy, starter, growth, pro), Stripe integration for billing, and a Super Admin dashboard for platform-wide management and feature gating.
- **Super Admin Trial Company Creation**: Super admins can create trial companies directly from the platform dashboard. Clicking "Create Trial Company" opens a modal to enter company name, admin details, trial length (default 7 days), and plan. Upon creation, the company and admin user are provisioned, temporary access is granted via `manual_access_enabled + manual_access_expires_at`. Trial companies show teal "Trial · Nd left" badges in the All Businesses table. The business detail modal includes a Trial Access section with Extend Trial, End Trial Now, Resend Setup Email, and Generate Temporary Password actions. Trial access expiry is enforced via the existing `canAccessPlatform` logic in auth.tsx. New fields added to companies table: `is_trial_access`, `trial_start_date`, `trial_end_date`, `trial_days`, `created_by_super_admin`, `trial_status`. New backend routes: POST /api/super-admin/trial-companies/create, /businesses/:id/extend-trial, /businesses/:id/end-trial, /businesses/:id/resend-invite, /businesses/:id/generate-temporary-password.
- **Temporary Password Flow**: When creating a trial company, a "Generate temporary password (CF-XXXX-XXXX)" checkbox (default: checked) controls whether a readable one-time password is generated. If enabled, the backend generates a `CF-XXXX-XXXX` format password (hashed), sets `mustChangePassword=true` + `temporaryPasswordRequired=true` on the admin user, and emails credentials to the admin. After creation, a "Temporary Password Generated" reveal dialog shows the one-time password with copy buttons for both password and email. The admin, on first login, is automatically intercepted by the `mustChangePassword` check in App.tsx and shown the `SetPasswordPage` (no dashboard access until a new password is set). The business detail modal has a "Login Setup" section (under Trial Access) showing real-time status (active/expired/completed), expiry date, and buttons to generate/regenerate the temp password or resend the setup email. New user fields: `temporaryPasswordRequired`, `temporaryPasswordCreatedAt`, `temporaryPasswordExpiresAt`, `temporaryPasswordLastSentAt`, `createdBySuperAdmin`.

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Stripe**: Used for subscription management, payment processing (checkout), customer portals, and webhook handling for billing events.
- **Passport.js**: Authentication middleware for Express.js.
- **TanStack Query**: Frontend data fetching, caching, and synchronization.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **shadcn/ui**: UI component library.
- **Vite**: Frontend build tool.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **OpenAI (gpt-4o-mini)**: Used for AI-assisted writing in the Publications module (improve, summarize, SEO description, professional tone, captions, intros). Key: `OPENAI_API_KEY`.
- **Web Speech API**: Browser-native voice-to-text used in the Publications section editor (no extra package).

## Field Notes Module

The Field Notes system allows employees to capture on-site inspections with photos, voice recordings, and AI-generated structured summaries.

**Key tables**: `field_notes_sessions`, `field_notes_entries`, `field_notes_assets`, `field_notes_transcript_chunks`, `field_notes_public_documents`, `field_notes_todos`

**Admin editor** (`/admin/field-notes/session/:id`): Full document editor with:
- Tabs: Document (entry editing), Photos, Transcript
- Each entry section has: Eye/EyeOff toggle (hide/show from public link), Edit button
- Per-photo controls on hover: drag handle (top-left) for reordering, EyeOff/Eye button (top-right) to hide/show
- Drag-to-reorder photos within a section (updates `assetIds` array order in entry)
- Section text editing: title, area name, body, bullet points, recommended action, voice transcript
- AI summary editing at session level

**Public link** (`/public/field-notes/:token`): Client-facing document view:
- Filters out entries where `isHiddenFromPublic = true`
- Filters out assets where `isHiddenFromPublic = true`
- Shows opening intro, area sections with photos, optional quote section
- Supports quote accept/decline flow

**Key schema fields**:
- `field_notes_entries.isHiddenFromPublic` — hides entire section from public link
- `field_notes_assets.isHiddenFromPublic` — hides individual photo from public link
- `field_notes_entries.assetIds` — JSON array of asset IDs; order determines photo display order
- `field_notes_entries.sortOrder` — entry display ordering

**Key API routes**:
- `PATCH /api/field-notes/entries/:id` — update entry (incl. `isHiddenFromPublic`, `assetIds` reorder)
- `PATCH /api/field-notes/assets/:id` — update asset (incl. `isHiddenFromPublic`, `caption`, `phase`)
- `GET /api/public/field-notes/:token` — public view (filters hidden entries + assets)

## Forms / Quote Requests Module

A full CRM pipeline and AI-powered quoting system, accessible at `/admin/quote-forms` (sidebar: "Forms / Requests"). The existing form builder at `/admin/quote-forms/:id` is unchanged.

**6-Tab Admin Hub** (`client/src/pages/admin/quote-forms.tsx`):
1. **Forms** — create/delete/toggle public forms, copy link, preview
2. **Submissions** — inbox list (filterable by pipeline stage) + detail pane with AI estimate, form answers, notes, activity timeline
3. **Pipeline** — 8-column kanban view (New Request → Estimated → Needs Review → Quote Ready → Quote Sent → Follow Up → Won → Lost)
4. **Estimator Settings** — pricing parameters (hourly rate, sq ft rate, multipliers, crew size, custom rules) used by AI engine
5. **Email Settings** — configurable templates for Confirmation, Estimate Summary, and Quote Ready emails (with Mailgun)
6. **Embed** — public link + iframe embed snippet for any website

**New DB tables** (created via raw SQL): `ai_estimates`, `form_quotes`, `estimator_settings`, `form_email_settings`, `lead_activity`

**Extended** `quote_form_submissions` with: `clientName`, `clientEmail`, `clientPhone`, `serviceType`, `serviceAddress`, `pipelineStage`, `estimateStatus`, `adminNotes`, `assignedTo`, `archivedAt`, `emailConfirmationSent`, `emailConfirmationSentAt`, `emailConfirmationMessageId`

**AI Estimate** (`POST /api/admin/submissions/:id/estimate`): Uses OpenAI gpt-4o-mini + estimatorSettings to generate a structured estimate. Now residential/commercial aware. Returns: `priceMin`, `priceMax`, `recommendedPrice`, `laborHours`, `crewSize`, `billing_type` (one_time | per_visit), `pricing_breakdown[]` (array of {label, amount}), `weekly_total`, `monthly_total`, `client_summary`, `suggestedServices`, `riskNotes`, `confidenceLevel`. Admin estimate card shows a visual pricing breakdown table and monthly totals for recurring jobs.

**Smart Cleaning Form**: When a form has `config.smartMode === "cleaning"`, the public form renders a hardcoded 6-step conditional flow (`client/src/pages/public/smart-cleaning-form.tsx`):
1. Contact — name, email, phone, company (if commercial)
2. Address — service address, city, province, postal
3. Service Type — cleaning type, frequency, preferred time
4. Property Details (conditional) — residential: bedrooms, bathrooms, sqft, pets; commercial: sqft, floors, employee count, operating hours, business type
5. Add-ons — optional services (fridge, oven, windows, laundry, etc.), special requests
6. Review + Submit — confirmation screen with "Created using Clockfield" branding
All data stored as flat keys in the existing `data` JSON field. No new DB tables needed.
Create smart forms via admin hub: "New Form" → select "Smart Cleaning Form" type → name it → "Create Smart Form".

**Respond to Submission** (`POST /api/admin/submissions/:id/respond`): Admin can email clients directly from the submission detail pane. Pre-fills To/Subject/Message fields. Sends via Mailgun, logs `email_sent` activity event, auto-advances `pipelineStage` from `new_request` to `follow_up`. Graceful fallback if Mailgun not configured.

**Key API routes**:
- `GET /api/admin/submissions` — all submissions across all company forms
- `GET /api/admin/submissions/:id` — detail with estimate + quote + activity
- `PATCH /api/admin/submissions/:id` — update pipelineStage, adminNotes, etc.
- `POST /api/admin/submissions/:id/estimate` — run AI estimate (res/com aware, structured breakdown)
- `POST /api/admin/submissions/:id/respond` — send email reply to client, log activity
- `POST /api/admin/submissions/:id/activity` — add note/activity event
- `GET|PUT /api/admin/estimator-settings` — pricing configuration
- `GET|PUT /api/admin/form-email-settings` — email template configuration
- Public form submit (`POST /api/forms/:companyId/:slug/submit`) — extracts CRM fields, sends confirmation email