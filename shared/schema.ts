import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/New_York"),
  defaultGracePeriodMinutes: integer("default_grace_period_minutes").notNull().default(15),
  allowUnscheduledClockIns: boolean("allow_unscheduled_clock_ins").notNull().default(true),
  requireReports: boolean("require_reports").notNull().default(false),
  requireBeforePhotos: boolean("require_before_photos").notNull().default(false),
  requireAfterPhotos: boolean("require_after_photos").notNull().default(false),
  overtimeEnabled: boolean("overtime_enabled").notNull().default(false),
  overtimeThresholdWeekly: integer("overtime_threshold_weekly").default(40),
  defaultPayPeriodType: text("default_pay_period_type").notNull().default("biweekly"),
  employeeIdCounter: integer("employee_id_counter").notNull().default(1000),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  email: text("email").unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("employee"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  overtimeRate: decimal("overtime_rate", { precision: 10, scale: 2 }),
  // Employee access fields
  employeeId: text("employee_id").unique(),
  loginEnabled: boolean("login_enabled").notNull().default(false),
  accountStatus: text("account_status").notNull().default("profile_only"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  tempPin: text("temp_pin"),
  position: text("position"),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  userId: varchar("user_id"),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  isActive: boolean("is_active").notNull().default(true),
});

export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  clientId: varchar("client_id"),
  name: text("name").notNull(),
  address: text("address"),
  notes: text("notes"),
});

export const shifts = pgTable("shifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  clientId: varchar("client_id"),
  locationId: varchar("location_id"),
  shiftDate: text("shift_date").notNull(),
  scheduledStartAt: text("scheduled_start_at").notNull(),
  scheduledEndAt: text("scheduled_end_at").notNull(),
  expectedHours: decimal("expected_hours", { precision: 5, scale: 2 }),
  gracePeriodMinutes: integer("grace_period_minutes").notNull().default(15),
  requireReport: boolean("require_report").notNull().default(false),
  shiftNotes: text("shift_notes"),
  status: text("status").notNull().default("scheduled"),
  createdBy: varchar("created_by"),
});

export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  shiftId: varchar("shift_id"),
  clientId: varchar("client_id"),
  locationId: varchar("location_id"),
  clockInAt: text("clock_in_at").notNull(),
  clockOutAt: text("clock_out_at"),
  breakTotalMinutes: integer("break_total_minutes").notNull().default(0),
  workedMinutes: integer("worked_minutes"),
  status: text("status").notNull().default("active"),
  flags: text("flags").array(),
  notes: text("notes"),
});

export const clientRequests = pgTable("client_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  clientId: varchar("client_id").notNull(),
  locationId: varchar("location_id"),
  requestType: text("request_type").notNull().default("service_request"),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export const insertShiftSchema = createInsertSchema(shifts).omit({ id: true });
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true });
export const insertClientRequestSchema = createInsertSchema(clientRequests).omit({ id: true });

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type ClientRequest = typeof clientRequests.$inferSelect;
export type InsertClientRequest = z.infer<typeof insertClientRequestSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().min(1),
});

export const ACCOUNT_STATUS = {
  PROFILE_ONLY: "profile_only",
  PENDING_ACTIVATION: "pending_activation",
  ACTIVE: "active",
  DISABLED: "disabled",
} as const;
