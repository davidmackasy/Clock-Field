# ClockField - Employee Tracking System

## Overview
A workforce operations platform for service businesses with 3 user roles: Admin, Employee, and Client. Built with React/Express/PostgreSQL.

## Architecture
- **Frontend**: React + Vite + Tailwind + shadcn/ui + wouter routing + TanStack Query
- **Backend**: Express.js + Passport.js (local strategy) + express-session (pg-backed sessions)
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Session-based with password hashing (scrypt), role-based access control

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
- Clock in/out with live timer and shift compliance flags
- Payroll estimation based on hourly rates with overtime calculation
- Client request management (service requests, complaints, issues)
- Company settings configuration (grace period, overtime, report requirements)
- Ownership/tenant authorization on all mutating endpoints

## Database Schema (shared/schema.ts)
- companies, users (all roles), clients (linked to users via userId), locations
- **recurring_schedules** - Recurring shift rules (days, frequency, start/end dates, continuous toggle)
- shifts (with shiftType, shiftLabel, recurringScheduleId), time_entries, client_requests

## API Routes (server/routes.ts)
- Auth: POST /api/auth/login, /api/auth/employee-login, /api/auth/change-password, /api/auth/logout, GET /api/auth/me
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

## Project Structure
```
client/src/
  App.tsx - Main router with role-based layouts (AdminLayout, EmployeeLayout, ClientLayout)
  lib/auth.tsx - Auth context provider with login/register/logout
  lib/queryClient.ts - TanStack Query setup with default fetcher
  components/admin-sidebar.tsx - Admin sidebar navigation
  components/mobile-nav.tsx - Mobile bottom navigation for employee/client
  pages/auth-page.tsx - Login/Register with split layout
  pages/admin/ - dashboard, employees, schedule, attendance, payroll, clients, requests, settings
  pages/employee/ - home (clock in/out + timer), schedule, hours, profile
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
