# ClockField - Employee Tracking System

## Overview
A workforce operations platform for service businesses with 3 user roles: Admin, Employee, and Client. Built with React/Express/PostgreSQL.

## Architecture
- **Frontend**: React + Vite + Tailwind + shadcn/ui + wouter routing + TanStack Query
- **Backend**: Express.js + Passport.js (local strategy) + express-session (pg-backed sessions)
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Session-based with password hashing (scrypt), role-based access control

## Public Routes
- **Landing page**: `/` — public SaaS marketing homepage (visible to unauthenticated visitors)
- **Login**: `/login` — auth page with 3 tabs (Employee, Admin/Client, Register). Supports `?tab=register` and `?tab=login` query params for pre-selecting tabs
- **Unauthenticated protected routes**: redirect to `/login`
- **Authenticated users at `/` or `/login`**: redirect to their role dashboard

## Demo Credentials
- **Admin**: admin@sparkle.com / admin123
- **Client**: tom@riverside.com / client123
- **Employees**: Use Employee ID + PIN via the Employee tab on login page (admin enables access per employee)

## Authentication Model
- **Admin/Client login**: Email + Password via "Admin / Client" tab
- **Employee login**: Employee ID (e.g. EMP-1001) + PIN via "Employee" tab (default tab)
- **Employee activation flow**: Admin enables access → generates Employee ID + temp PIN → employee logs in → forced password change → active account
- **Dual Passport strategies**: `local` (email+password) and `employee-local` (employeeId+pin)

## User Roles
- **Admin**: Full dashboard. Desktop: sidebar nav. Mobile: native-app style bottom tab nav (Dashboard, Employees, Schedule, Attendance, More) + fixed top header with profile/sign-out. Manages employees, schedules, attendance, payroll estimation, clients, requests, admin management, and company settings.
- **Employee**: Mobile-first bottom nav. Home with clock in/out + live timer, schedule view (Today/Week/Upcoming), hours tracking, profile (with change password).
- **Client**: Mobile-first bottom nav. Service request submission + tracking, profile. Login created by admin from Clients page.

## Employee Account Statuses
- `profile_only` - Record created but no login access
- `pending_activation` - Access enabled, awaiting first login and password change
- `active` - Fully activated, can log in
- `disabled` - Login access blocked

## Employee Onboarding Flow
1. Admin creates employee profile (email is optional)
2. Admin clicks "Enable Login Access" → system generates Employee ID + 6-digit temp PIN
3. Admin shares credentials with employee
4. Employee logs in via Employee tab → forced to set a new password
5. Employee reaches their dashboard

## Super Admin / SaaS Layer (additive)
- **is_super_admin** boolean on users table — grants access to Platform Admin mode
- **Subscription columns on companies**: plan_code (starter/growth/pro/legacy), billing_cycle, subscription_status, account_status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_start/end, cancel_at_period_end, activated_at, suspended_at, suspended_reason
- **platform_messages table**: super admin → business messaging, broadcast support
- **server/plans.ts**: 4 plan configs (legacy/starter/growth/pro) with maxEmployees, maxClients, feature flags
- **Super Admin routes**: /api/super-admin/stats, /api/super-admin/businesses, /api/super-admin/businesses/:id (PATCH, POST message), /api/super-admin/messages (GET, broadcast)
- **Admin routes**: /api/admin/plan (plan+usage), /api/admin/platform-messages (read/mark-read)
- **Billing routes**: /api/billing/checkout (Stripe checkout), /api/billing/portal (customer portal), /api/billing/webhook (event sync)
- **Plan enforcement**: POST /api/employees and POST /api/clients return 403 PLAN_LIMIT_* when over limit
- **Super Admin UI**: /super-admin route + SuperAdminLayout with purple sidebar, business table, detail modal, plan change, messaging
- **Admin Subscription page**: /admin/subscription — current plan, usage bars, feature access grid, plan cards with Stripe checkout
- **Admin Platform Messages page**: /admin/platform-messages — inbox with mark-read
- **Mode switcher**: super admins see "Platform" section in sidebar + profile sheet shortcut on mobile
- **Stripe**: Dynamic import (`await import("stripe")`), configured via STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET + STRIPE_PRICE_* env vars

## Key Features
- Role-based authentication with secure session management
- Employee CRUD management with hourly rate tracking
- Employee login access management (enable, disable, reset PIN) from admin panel
- **Admin management** - Invite additional admins with temp PIN, reset PIN, deactivate/reactivate
- **Client login enablement** - Enable/disable login for clients from Clients page, generates email+PIN credentials
- Email-free employee accounts supported (Employee ID + PIN login)
- Forced password change on first login (all roles: admin, employee, client)
- **Recurring shift scheduling** - Create one-time, recurring (daily/weekly/biweekly), or extra shifts with day-of-week selection and 90-day auto-generation
- **Schedule calendar views** - Day, Week, and Month calendar views with shift indicators
- **Recurring schedule management** - List, pause, resume, end, or delete recurring schedules
- **Employee detail panels** - Clickable employee cards open a detail sheet with Overview, Schedule, and Attendance tabs; includes inline editing
- **Client detail modals** - Clickable client cards open a detail modal with Overview, Locations, and Requests tabs; includes inline editing
- **Advanced attendance tracking** - Filters (search, date range, status, employee), variance columns ("+2 min late"), clickable employee names open attendance portfolio with stats + monthly calendar
- **Attendance Hour Adjustments** - Admin-only adjustment layer on each completed attendance row. Row-level slider icon opens a modal to add or reduce paid time without touching raw clock data. Adjustments stored in `attendance_adjustments` table with reason, note, audit trail, and void support. Adjustment badge shown in row flags. Summary card shows "Payable Hours" (adjusted) with raw hours as sub-text when adjustments exist. Payroll estimator uses adjusted minutes automatically.
- Clock in/out with live timer and shift compliance flags
- **Payroll Deductions estimator** - Admin-configurable Canadian payroll deductions (federal/provincial tax, CPP, EI, custom deductions). Toggle per-company, configurable modes (off/manual%), per-period breakdown in payroll table and history modal
- Payroll estimation based on hourly rates with overtime calculation (per-period history modal, 6 period filter options)
- Client request management (service requests, complaints, issues)
- **Timesheets module** - Pay-period timesheets generated from attendance records. Admin: generate all-employee timesheets, per-period drill-down with daily breakdown + approve action + print/download. Employee: view own timesheets via Profile → My Timesheets, submit for review, print. Status flow: draft → submitted → approved.
- Company settings configuration (grace period, overtime, report requirements, payroll deductions)
- Ownership/tenant authorization on all mutating endpoints

## Database Schema (shared/schema.ts)
- companies (with deductionsEnabled, provinceCode, federalTaxMode/Percent, provincialTaxMode/Percent, cppMode/Percent, eiMode/Percent), users (all roles), clients (linked to users via userId), locations
- **recurring_schedules** - Recurring shift rules (days, frequency, start/end dates, continuous toggle)
- shifts (with shiftType, shiftLabel, recurringScheduleId), time_entries, client_requests
- **payroll_deductions** - Custom per-company deductions (label, type: percent|fixed, value, isActive)
- **timesheets** - Pay-period summaries (employee_id, company_id, pay_period_start/end, status, worked/regular/overtime minutes, shift counts, late/left_early/missed counts, submitted_at, approved_at)
- **attendance_adjustments** - Separate adjustment layer per time entry (adjustment_minutes +/-, reason, note, created_by_user_id, is_voided, voided_by_user_id). Never modifies raw attendance records.

## SaaS Subscription Layer
- **Plans**: `legacy` (unlimited, grandfathered), `starter` ($29), `growth` ($79), `pro` ($129) — defined in `server/plans.ts`
- **Billing**: Stripe checkout + portal, monthly & yearly (10% off), webhook handler for `invoice.payment_failed`, `customer.subscription.updated/deleted`
- **Company fields**: `plan_code`, `billing_cycle`, `subscription_status`, `account_status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`, `cancel_at_period_end`, `internal_bypass`
- **Paywall flow**: New companies start as `account_status='pending_subscription'` → redirected to `/subscribe` (pricing page) → after Stripe checkout → `active`
- **Access logic**: `internal_bypass=true` OR `plan_code='legacy'` OR (`account_status='active'` AND `subscription_status='active'`)
- **Feature gating**: `FeatureGate` component wraps payroll/requests/work-log/timesheets — shows locked UI for plans that don't include the feature
- **Billing blocked page**: `/billing-blocked` — for `past_due`, `canceled`, `unpaid`, `suspended` states
- **Super admin**: `/super-admin` dashboard — manage all businesses, toggle `internalBypass`, change plans, send messages, broadcast announcements
- **Plan enforcement**: POST /api/employees returns 403 PLAN_LIMIT_EMPLOYEES; POST /api/clients returns 403 PLAN_LIMIT_CLIENTS
- **Legacy/bypass accounts**: All 4 existing companies (MackasyInc, Sparkle, Masterpiece, Icon) have `plan_code='legacy'` and `internal_bypass=true` for uninterrupted access

## API Routes (server/routes.ts)
- Auth: POST /api/auth/login, /api/auth/employee-login, /api/auth/change-password, /api/auth/logout, GET /api/auth/me, GET /api/auth/company
- Billing: POST /api/billing/checkout, /api/billing/portal, /api/billing/webhook
- Admin Plan: GET /api/admin/plan
- Super Admin: GET /api/super-admin/stats|businesses, GET/PATCH /api/super-admin/businesses/:id, POST /api/super-admin/businesses/:id/message, POST /api/super-admin/messages/broadcast
- Employees: GET/POST /api/employees, PATCH /api/employees/:id, POST /api/employees/:id/enable-access|reset-pin|disable-access
- Admins: GET /api/admins, POST /api/admins/invite, POST /api/admins/:id/reset-pin, PATCH /api/admins/:id
- Company: GET/PATCH /api/company
- Dashboard: GET /api/dashboard/stats
- Clients: GET/POST/PATCH /api/clients/:id, POST /api/clients/:id/enable-login|reset-pin|disable-login
- Locations: GET/POST /api/locations
- Recurring Schedules: GET/POST /api/recurring-schedules, PATCH/DELETE /api/recurring-schedules/:id
- Shifts: GET/POST /api/shifts, GET /api/shifts/date/:date, PATCH/DELETE /api/shifts/:id
- Time Entries: GET /api/time-entries, GET /api/time-entries/active, POST /api/time-entries/clock-in|clock-out
- Client Requests: GET/POST /api/client-requests, PATCH /api/client-requests/:id
- Payroll Deductions: GET/POST /api/payroll-deductions, PATCH/DELETE /api/payroll-deductions/:id
- Timesheets: GET /api/timesheets, POST /api/timesheets/generate, GET /api/timesheets/:id, POST /api/timesheets/:id/submit|approve

## Project Structure
```
client/src/
  App.tsx - Main router with role-based layouts (AdminLayout, EmployeeLayout, ClientLayout)
  lib/auth.tsx - Auth context provider with login/register/logout
  lib/queryClient.ts - TanStack Query setup with default fetcher
  components/admin-sidebar.tsx - Admin sidebar navigation
  components/mobile-nav.tsx - Mobile bottom navigation for employee/client
  pages/auth-page.tsx - Login/Register with split layout
  pages/admin/ - dashboard, employees, schedule, attendance, payroll, timesheets, clients, requests, settings
  pages/employee/ - home (clock in/out + timer), schedule, hours, timesheets, profile
  pages/client/ - dashboard, requests, profile
server/
  index.ts - Express server entry with seed on startup
  routes.ts - All API routes with ownership checks
  storage.ts - Database storage layer (IStorage interface + DatabaseStorage)
  auth.ts - Passport auth setup with scrypt password hashing
  db.ts - Database connection pool
  seed.ts - Realistic seed data (company, employees, clients, locations, shifts, time entries, requests)
shared/
  schema.ts - Drizzle schema + Zod validators + TypeScript types
```
