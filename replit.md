# WorkTrack - Employee Tracking System

## Overview
A workforce operations platform for service businesses with 3 user roles: Admin, Employee, and Client. Built with React/Express/PostgreSQL.

## Architecture
- **Frontend**: React + Vite + Tailwind + shadcn/ui + wouter routing + TanStack Query
- **Backend**: Express.js + Passport.js (local strategy) + express-session (pg-backed sessions)
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Session-based with password hashing (scrypt), role-based access control

## Demo Credentials
- **Admin**: admin@sparkle.com / admin123
- **Employee**: maria@sparkle.com / employee123 (also james@sparkle.com, lisa@sparkle.com)
- **Client**: tom@riverside.com / client123

## User Roles
- **Admin**: Full dashboard with sidebar nav. Manages employees, schedules, attendance, payroll estimation, clients, requests, and company settings.
- **Employee**: Mobile-first bottom nav. Home with clock in/out + live timer, schedule view (Today/Week/Upcoming), hours tracking, profile.
- **Client**: Mobile-first bottom nav. Service request submission + tracking, profile.

## Key Features
- Role-based authentication with secure session management
- Employee CRUD management with hourly rate tracking
- Client management with auto-created client user accounts
- Location management linked to clients
- Shift scheduling with date navigation and status tracking
- Clock in/out with live timer and shift compliance flags
- Attendance tracking with flags (late, early departure, overtime, unscheduled, etc.)
- Payroll estimation based on hourly rates with overtime calculation
- Client request management (service requests, complaints, issues)
- Company settings configuration (grace period, overtime, report requirements)
- Ownership/tenant authorization on all mutating endpoints

## Database Schema (shared/schema.ts)
- companies, users (all roles), clients (linked to users via userId), locations, shifts, time_entries, client_requests

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
