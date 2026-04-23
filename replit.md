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
- **SaaS Layer**: Includes a subscription management system with different plans (legacy, starter, growth, pro), Stripe integration for billing, and a Super Admin dashboard for platform-wide management and feature gating.

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Stripe**: Used for subscription management, payment processing (checkout), customer portals, and webhook handling for billing events.
- **Passport.js**: Authentication middleware for Express.js.
- **TanStack Query**: Frontend data fetching, caching, and synchronization.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **shadcn/ui**: UI component library.
- **Vite**: Frontend build tool.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.