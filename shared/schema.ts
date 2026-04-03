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
  payrollCycleStartDate: text("payroll_cycle_start_date"),
  employeeIdCounter: integer("employee_id_counter").notNull().default(1000),
  // Payroll deductions
  deductionsEnabled: boolean("deductions_enabled").notNull().default(false),
  provinceCode: text("province_code").notNull().default("MB"),
  federalTaxMode: text("federal_tax_mode").notNull().default("off"),
  federalTaxPercent: decimal("federal_tax_percent", { precision: 5, scale: 2 }).default("0"),
  provincialTaxMode: text("provincial_tax_mode").notNull().default("off"),
  provincialTaxPercent: decimal("provincial_tax_percent", { precision: 5, scale: 2 }).default("0"),
  cppMode: text("cpp_mode").notNull().default("off"),
  cppPercent: decimal("cpp_percent", { precision: 5, scale: 2 }).default("0"),
  eiMode: text("ei_mode").notNull().default("off"),
  eiPercent: decimal("ei_percent", { precision: 5, scale: 2 }).default("0"),
  // SaaS subscription fields
  planCode: text("plan_code").notNull().default("legacy"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  subscriptionStatus: text("subscription_status").notNull().default("active"),
  accountStatus: text("account_status").notNull().default("active"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  currentPeriodStart: text("current_period_start"),
  currentPeriodEnd: text("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  suspendedReason: text("suspended_reason"),
  activatedAt: text("activated_at"),
  suspendedAt: text("suspended_at"),
  internalBypass: boolean("internal_bypass").notNull().default(false),
  createdAt: text("created_at"),
  // Timed Super Admin temporary access override
  manualAccessEnabled: boolean("manual_access_enabled").notNull().default(false),
  manualAccessExpiresAt: text("manual_access_expires_at"),
  manualAccessGrantedBy: text("manual_access_granted_by"),
  manualAccessReason: text("manual_access_reason"),
  // Company contact / address (for pay stubs)
  address: text("address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  companyPhone: text("company_phone"),
  companyEmail: text("company_email"),
  // Optional Google Review link (shown as external button on public report pages)
  googleReviewUrl: text("google_review_url"),
  // Report branding
  companyLogoUrl: text("company_logo_url"),
  brandColor: text("brand_color"),
  defaultReportIntro: text("default_report_intro"),
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
  employeeId: text("employee_id").unique(),
  loginEnabled: boolean("login_enabled").notNull().default(false),
  accountStatus: text("account_status").notNull().default("profile_only"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  tempPin: text("temp_pin"),
  position: text("position"),
  createdAt: text("created_at"),
  // Super Admin capability
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
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

export const recurringSchedules = pgTable("recurring_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  clientId: varchar("client_id"),
  locationId: varchar("location_id"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  isContinuous: boolean("is_continuous").notNull().default(true),
  repeatFrequency: text("repeat_frequency").notNull().default("weekly"),
  repeatDays: text("repeat_days").array().notNull(),
  scheduledStartTime: text("scheduled_start_time").notNull(),
  scheduledEndTime: text("scheduled_end_time").notNull(),
  shiftLabel: text("shift_label"),
  shiftNotes: text("shift_notes"),
  status: text("status").notNull().default("active"),
  createdBy: varchar("created_by"),
  createdAt: text("created_at").notNull(),
  generatedUpTo: text("generated_up_to"),
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
  shiftLabel: text("shift_label"),
  shiftType: text("shift_type").notNull().default("one-time"),
  recurringScheduleId: varchar("recurring_schedule_id"),
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
  manuallyClosedByAdmin: boolean("manually_closed_by_admin").notNull().default(false),
  manualClockOutByUserId: varchar("manual_clock_out_by_user_id"),
  manualClockOutAt: text("manual_clock_out_at"),
  manualClockOutReason: text("manual_clock_out_reason"),
});

export const payrollDeductions = pgTable("payroll_deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  label: text("label").notNull(),
  type: text("type").notNull().default("percent"),
  value: decimal("value", { precision: 8, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
});

export const clientRequests = pgTable("client_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  clientId: varchar("client_id"),
  locationId: varchar("location_id"),
  requestType: text("request_type").notNull().default("service_request"),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("new"),
  createdByUserId: varchar("created_by_user_id"),
  createdByRole: text("created_by_role").default("client"),
  employeeId: varchar("employee_id"),
  visibilityScope: text("visibility_scope").notNull().default("admin_and_client"),
  imageUrls: text("image_urls").array(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
  resolvedAt: text("resolved_at"),
});

export const requestMessages = pgTable("request_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull(),
  authorUserId: varchar("author_user_id").notNull(),
  authorRole: text("author_role").notNull(),
  body: text("body"),
  messageType: text("message_type").notNull().default("reply"),
  isVisibleToClient: boolean("is_visible_to_client").notNull().default(true),
  isVisibleToEmployee: boolean("is_visible_to_employee").notNull().default(true),
  isStatusUpdate: boolean("is_status_update").notNull().default(false),
  statusValue: text("status_value"),
  createdAt: text("created_at").notNull(),
});

export const requestAttachments = pgTable("request_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestMessageId: varchar("request_message_id").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull().default("image"),
  caption: text("caption"),
  uploadedByUserId: varchar("uploaded_by_user_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertRequestMessageSchema = createInsertSchema(requestMessages).omit({ id: true });
export const insertRequestAttachmentSchema = createInsertSchema(requestAttachments).omit({ id: true });

// ── Timesheets ────────────────────────────────────────────────────────────────
export const timesheets = pgTable("timesheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  payPeriodStart: text("pay_period_start").notNull(),
  payPeriodEnd: text("pay_period_end").notNull(),
  payPeriodType: text("pay_period_type").notNull().default("biweekly"),
  status: text("status").notNull().default("draft"),
  totalWorkedMinutes: integer("total_worked_minutes").notNull().default(0),
  regularMinutes: integer("regular_minutes").notNull().default(0),
  overtimeMinutes: integer("overtime_minutes").notNull().default(0),
  totalShifts: integer("total_shifts").notNull().default(0),
  lateCount: integer("late_count").notNull().default(0),
  leftEarlyCount: integer("left_early_count").notNull().default(0),
  missedShiftCount: integer("missed_shift_count").notNull().default(0),
  submittedAt: text("submitted_at"),
  approvedAt: text("approved_at"),
  approvedByUserId: varchar("approved_by_user_id"),
  generatedAt: text("generated_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertTimesheetSchema = createInsertSchema(timesheets).omit({ id: true });
export type Timesheet = typeof timesheets.$inferSelect;
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;

// ── Work Submissions ─────────────────────────────────────────────────────────
export const workSubmissions = pgTable("work_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  shiftId: varchar("shift_id"),
  clientId: varchar("client_id"),
  locationId: varchar("location_id"),
  locationName: text("location_name"),
  workDate: text("work_date").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull(),
  submittedAt: text("submitted_at"),
  updatedAt: text("updated_at").notNull(),
  publicShareToken: text("public_share_token"),
  publicShareEnabled: boolean("public_share_enabled").notNull().default(false),
  reportShortCode: text("report_short_code"),
  serviceSummary: text("service_summary"),
});

export const workSubmissionItems = pgTable("work_submission_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull(),
  section: text("section").notNull(),
  subArea: text("sub_area").notNull(),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const workSubmissionPhotos = pgTable("work_submission_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionItemId: varchar("submission_item_id").notNull(),
  photoType: text("photo_type").notNull(),
  fileUrl: text("file_url").notNull(),
  caption: text("caption"),
  createdAt: text("created_at").notNull(),
});

// ── Work Submission Reviews ───────────────────────────────────────────────────
export const workSubmissionReviews = pgTable("work_submission_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull(),
  companyId: varchar("company_id").notNull(),
  shareToken: text("share_token").notNull(),
  reviewShareToken: text("review_share_token"),
  reviewShortCode: text("review_short_code"),
  clientName: text("client_name").notNull(),
  companyName: text("company_name"),
  reviewText: text("review_text").notNull(),
  rating: integer("rating"),
  status: text("status").notNull().default("submitted"),
  submittedAt: text("submitted_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertWorkSubmissionSchema = createInsertSchema(workSubmissions).omit({ id: true });
export const insertWorkSubmissionItemSchema = createInsertSchema(workSubmissionItems).omit({ id: true });
export const insertWorkSubmissionPhotoSchema = createInsertSchema(workSubmissionPhotos).omit({ id: true });
export const insertWorkSubmissionReviewSchema = createInsertSchema(workSubmissionReviews).omit({ id: true });

export type WorkSubmission = typeof workSubmissions.$inferSelect;
export type InsertWorkSubmission = z.infer<typeof insertWorkSubmissionSchema>;
export type WorkSubmissionItem = typeof workSubmissionItems.$inferSelect;
export type InsertWorkSubmissionItem = z.infer<typeof insertWorkSubmissionItemSchema>;
export type WorkSubmissionPhoto = typeof workSubmissionPhotos.$inferSelect;
export type InsertWorkSubmissionPhoto = z.infer<typeof insertWorkSubmissionPhotoSchema>;
export type WorkSubmissionReview = typeof workSubmissionReviews.$inferSelect;
export type InsertWorkSubmissionReview = z.infer<typeof insertWorkSubmissionReviewSchema>;

// ── Platform Messages ─────────────────────────────────────────────────────────
export const platformMessages = pgTable("platform_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  senderUserId: varchar("sender_user_id").notNull(),
  senderRole: text("sender_role").notNull().default("super_admin"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  messageType: text("message_type").notNull().default("announcement"),
  isRead: boolean("is_read").notNull().default(false),
  isBroadcast: boolean("is_broadcast").notNull().default(false),
  parentMessageId: varchar("parent_message_id"),
  createdAt: text("created_at").notNull(),
  // Broadcast email delivery fields
  deliveryMode: text("delivery_mode").notNull().default("in_app"),
  emailSubject: text("email_subject"),
  emailCtaLabel: text("email_cta_label"),
  emailCtaUrl: text("email_cta_url"),
  emailSentAt: text("email_sent_at"),
  emailStatus: text("email_status"),
});

export const broadcastEmailDeliveries = pgTable("broadcast_email_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  broadcastId: varchar("broadcast_id").notNull(),
  businessId: varchar("business_id").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  status: text("status").notNull().default("pending"),
  mailgunMessageId: text("mailgun_message_id"),
  sentAt: text("sent_at"),
  failedAt: text("failed_at"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
});

export const welcomeEmailDeliveries = pgTable("welcome_email_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessId: varchar("business_id").notNull().unique(),
  recipientEmail: text("recipient_email").notNull(),
  status: text("status").notNull().default("pending"),
  mailgunMessageId: text("mailgun_message_id"),
  sentAt: text("sent_at"),
  failedAt: text("failed_at"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
});

export const insertPlatformMessageSchema = createInsertSchema(platformMessages).omit({ id: true });
export type PlatformMessage = typeof platformMessages.$inferSelect;
export type InsertPlatformMessage = z.infer<typeof insertPlatformMessageSchema>;
export type BroadcastEmailDelivery = typeof broadcastEmailDeliveries.$inferSelect;
export type WelcomeEmailDelivery = typeof welcomeEmailDeliveries.$inferSelect;

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertPayrollDeductionSchema = createInsertSchema(payrollDeductions).omit({ id: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export const insertRecurringScheduleSchema = createInsertSchema(recurringSchedules).omit({ id: true });
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
export type RecurringSchedule = typeof recurringSchedules.$inferSelect;
export type InsertRecurringSchedule = z.infer<typeof insertRecurringScheduleSchema>;
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type ClientRequest = typeof clientRequests.$inferSelect;
export type InsertClientRequest = z.infer<typeof insertClientRequestSchema>;
export type PayrollDeduction = typeof payrollDeductions.$inferSelect;
export type InsertPayrollDeduction = z.infer<typeof insertPayrollDeductionSchema>;
export type RequestMessage = typeof requestMessages.$inferSelect;
export type InsertRequestMessage = z.infer<typeof insertRequestMessageSchema>;
export type RequestAttachment = typeof requestAttachments.$inferSelect;
export type InsertRequestAttachment = z.infer<typeof insertRequestAttachmentSchema>;

// ── Pay Runs ──────────────────────────────────────────────────────────────────
export const payRuns = pgTable("pay_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  name: text("name").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  payDate: text("pay_date").notNull(),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Pay Stubs ─────────────────────────────────────────────────────────────────
export const payStubs = pgTable("pay_stubs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  displayPaystubId: text("display_paystub_id"),
  companyId: varchar("company_id").notNull(),
  payRunId: varchar("pay_run_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  timesheetId: varchar("timesheet_id"),
  status: text("status").notNull().default("draft"),
  employeeNameSnapshot: text("employee_name_snapshot"),
  employeeIdSnapshot: text("employee_id_snapshot"),
  employeePositionSnapshot: text("employee_position_snapshot"),
  employeePayTypeSnapshot: text("employee_pay_type_snapshot").default("hourly"),
  employeeRateSnapshot: decimal("employee_rate_snapshot", { precision: 10, scale: 2 }),
  companyNameSnapshot: text("company_name_snapshot"),
  regularHours: decimal("regular_hours", { precision: 8, scale: 2 }).default("0"),
  overtimeHours: decimal("overtime_hours", { precision: 8, scale: 2 }).default("0"),
  totalHours: decimal("total_hours", { precision: 8, scale: 2 }).default("0"),
  grossPay: decimal("gross_pay", { precision: 10, scale: 2 }).default("0"),
  totalDeductions: decimal("total_deductions", { precision: 10, scale: 2 }).default("0"),
  netPay: decimal("net_pay", { precision: 10, scale: 2 }).default("0"),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  payDate: text("pay_date"),
  finalizedAt: text("finalized_at"),
  confirmedPaidAt: text("confirmed_paid_at"),
  employeeVisibleAt: text("employee_visible_at"),
  voidedAt: text("voided_at"),
  adminNotes: text("admin_notes"),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Pay Stub Earnings ─────────────────────────────────────────────────────────
export const payStubEarnings = pgTable("pay_stub_earnings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payStubId: varchar("pay_stub_id").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  hours: decimal("hours", { precision: 8, scale: 2 }),
  rate: decimal("rate", { precision: 10, scale: 2 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  displayOrder: integer("display_order").notNull().default(0),
});

// ── Pay Stub Deductions ───────────────────────────────────────────────────────
export const payStubDeductions = pgTable("pay_stub_deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payStubId: varchar("pay_stub_id").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  employerPaid: boolean("employer_paid").default(false),
  displayOrder: integer("display_order").notNull().default(0),
});

// ── Pay Stub Audit Log ────────────────────────────────────────────────────────
export const payStubAuditLog = pgTable("pay_stub_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payStubId: varchar("pay_stub_id").notNull(),
  action: text("action").notNull(),
  actorId: varchar("actor_id"),
  actorRole: text("actor_role"),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull(),
});

export const insertPayRunSchema = createInsertSchema(payRuns).omit({ id: true });
export const insertPayStubSchema = createInsertSchema(payStubs).omit({ id: true });
export const insertPayStubEarningSchema = createInsertSchema(payStubEarnings).omit({ id: true });
export const insertPayStubDeductionSchema = createInsertSchema(payStubDeductions).omit({ id: true });
export const insertPayStubAuditLogSchema = createInsertSchema(payStubAuditLog).omit({ id: true });

export type PayRun = typeof payRuns.$inferSelect;
export type InsertPayRun = z.infer<typeof insertPayRunSchema>;
export type PayStub = typeof payStubs.$inferSelect;
export type InsertPayStub = z.infer<typeof insertPayStubSchema>;
export type PayStubEarning = typeof payStubEarnings.$inferSelect;
export type InsertPayStubEarning = z.infer<typeof insertPayStubEarningSchema>;
export type PayStubDeduction = typeof payStubDeductions.$inferSelect;
export type InsertPayStubDeduction = z.infer<typeof insertPayStubDeductionSchema>;
export type PayStubAuditLog = typeof payStubAuditLog.$inferSelect;

// ─── Reports Module ───────────────────────────────────────────────────────────
export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  reportType: text("report_type").notNull(), // incident, issue, damage, statement, complaint, general
  status: text("status").notNull().default("draft"), // draft, submitted, sent, viewed, awaiting_employee, awaiting_client, awaiting_signature, in_review, finalized, closed, archived, reopened
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdByRole: text("created_by_role").notNull(), // admin, employee, client
  // Linked entities
  assignedClientId: varchar("assigned_client_id"),
  assignedLocationId: varchar("assigned_location_id"),
  assignedEmployeeId: varchar("assigned_employee_id"),
  // Core fields
  title: text("title").notNull(),
  summary: text("summary"),
  incidentDate: text("incident_date"),
  incidentTime: text("incident_time"),
  severity: text("severity"), // low, medium, high, critical
  riskLevel: text("risk_level"), // none, low, medium, high
  // Incident details
  incidentCategory: text("incident_category"),
  areaAffected: text("area_affected"),
  clientPropertyAffected: boolean("client_property_affected").default(false),
  companyEquipmentAffected: boolean("company_equipment_affected").default(false),
  immediateAction: text("immediate_action"),
  workStopped: boolean("work_stopped").default(false),
  customerInformed: boolean("customer_informed").default(false),
  witnesses: text("witnesses"),
  // Property / equipment
  itemAffected: text("item_affected"),
  itemDescription: text("item_description"),
  damageType: text("damage_type"),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  itemRemoved: boolean("item_removed").default(false),
  removedBy: text("removed_by"),
  removalReason: text("removal_reason"),
  removalApproved: boolean("removal_approved").default(false),
  // Employee statement (filled by employee)
  employeeStatement: text("employee_statement"),
  // Client comments (filled by client)
  clientComments: text("client_comments"),
  // Admin-only fields
  internalNotes: text("internal_notes"),
  adminFindings: text("admin_findings"),
  correctiveAction: text("corrective_action"),
  finalDecision: text("final_decision"),
  nextSteps: text("next_steps"),
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDueDate: text("follow_up_due_date"),
  // Signature requirements
  requiresEmployeeSignature: boolean("requires_employee_signature").default(false),
  requiresClientSignature: boolean("requires_client_signature").default(false),
  requiresAdminSignature: boolean("requires_admin_signature").default(false),
  // Routing state
  sentToEmployee: boolean("sent_to_employee").default(false),
  sentToClient: boolean("sent_to_client").default(false),
  employeeViewedAt: text("employee_viewed_at"),
  clientViewedAt: text("client_viewed_at"),
  // Attachments as JSON array string: [{url, type, name}]
  attachments: text("attachments"),
  // Timestamps
  sentAt: text("sent_at"),
  finalizedAt: text("finalized_at"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").default(sql`now()`),
  updatedAt: text("updated_at").default(sql`now()`),
});

export const reportSignatures = pgTable("report_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull(),
  signerUserId: varchar("signer_user_id"), // nullable for public token signers
  signerRole: text("signer_role").notNull(), // admin, employee, client
  signerName: text("signer_name").notNull(),
  signatureType: text("signature_type").notNull().default("typed"), // "typed" | "drawn"
  signedAt: text("signed_at").notNull(),
  acknowledgementText: text("acknowledgement_text"),
  signatureDataUrl: text("signature_data_url"), // base64 PNG for drawn signatures
  publicAccessTokenId: varchar("public_access_token_id"), // reference to access token if signed via public link
});

export const reportAccessTokens = pgTable("report_access_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull(),
  recipientType: text("recipient_type").notNull(), // "employee" | "client"
  recipientEmail: text("recipient_email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  permissions: text("permissions").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: text("created_at").notNull().default(sql`now()::text`),
  expiresAt: text("expires_at"),
  revokedAt: text("revoked_at"),
  lastAccessedAt: text("last_accessed_at"),
  signedAt: text("signed_at"),
  createdByUserId: varchar("created_by_user_id"),
});

export const reportActivityLog = pgTable("report_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull(),
  action: text("action").notNull(), // created, submitted, sent, viewed, signed, finalized, archived, reopened, updated
  actionByUserId: varchar("action_by_user_id").notNull(),
  actionByRole: text("action_by_role").notNull(),
  metadata: text("metadata"), // JSON string
  createdAt: text("created_at").default(sql`now()`),
});

export const insertReportSchema = createInsertSchema(reports).omit({ id: true });
export const insertReportSignatureSchema = createInsertSchema(reportSignatures).omit({ id: true });
export const insertReportActivityLogSchema = createInsertSchema(reportActivityLog).omit({ id: true });
export const insertReportAccessTokenSchema = createInsertSchema(reportAccessTokens).omit({ id: true });

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type ReportSignature = typeof reportSignatures.$inferSelect;
export type InsertReportSignature = z.infer<typeof insertReportSignatureSchema>;
export type ReportActivityLog = typeof reportActivityLog.$inferSelect;
export type ReportAccessToken = typeof reportAccessTokens.$inferSelect;
export type InsertReportAccessToken = z.infer<typeof insertReportAccessTokenSchema>;

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

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  email: varchar("email").notNull(),
  tokenHash: varchar("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const ACCOUNT_STATUS = {
  PROFILE_ONLY: "profile_only",
  PENDING_ACTIVATION: "pending_activation",
  ACTIVE: "active",
  DISABLED: "disabled",
} as const;

// ── Field Notes Module ────────────────────────────────────────────────────────
export const fieldNotesSessions = pgTable("field_notes_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  locationId: varchar("location_id"),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdByRole: text("created_by_role").notNull().default("admin"),
  sessionType: text("session_type").notNull().default("site_visit"),
  title: text("title"),
  status: text("status").notNull().default("recording"),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  locationLat: text("location_lat"),
  locationLng: text("location_lng"),
  locationText: text("location_text"),
  deviceType: text("device_type"),
  aiStatus: text("ai_status").notNull().default("pending"),
  aiSummary: text("ai_summary"),
  clientSafeSummary: text("client_safe_summary"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const fieldNotesAssets = pgTable("field_notes_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  uploadedByUserId: varchar("uploaded_by_user_id").notNull(),
  assetType: text("asset_type").notNull().default("photo"),
  fileUrl: text("file_url").notNull(),
  sequenceIndex: integer("sequence_index").notNull().default(0),
  capturedAt: text("captured_at").notNull(),
  caption: text("caption"),
  createdAt: text("created_at").notNull(),
});

export const fieldNotesTranscriptChunks = pgTable("field_notes_transcript_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  chunkIndex: integer("chunk_index").notNull().default(0),
  startedAt: text("started_at"),
  endedAt: text("ended_at"),
  rawText: text("raw_text").notNull(),
  createdAt: text("created_at").notNull(),
});

export const fieldNotesEntries = pgTable("field_notes_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  entryType: text("entry_type").notNull().default("observation"),
  areaName: text("area_name"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  clientSafeSummary: text("client_safe_summary"),
  priority: text("priority").notNull().default("normal"),
  sortOrder: integer("sort_order").notNull().default(0),
  photoIndexes: text("photo_indexes"),
  assetIds: text("asset_ids"),
  relatedTranscript: text("related_transcript"),
  issueDetected: boolean("issue_detected").notNull().default(false),
  recommendedAction: text("recommended_action"),
  createdByAi: boolean("created_by_ai").notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const fieldNotesEntryTags = pgTable("field_notes_entry_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entryId: varchar("entry_id").notNull(),
  sessionId: varchar("session_id").notNull(),
  tagName: text("tag_name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertFieldNotesSessionSchema = createInsertSchema(fieldNotesSessions).omit({ id: true });
export const insertFieldNotesAssetSchema = createInsertSchema(fieldNotesAssets).omit({ id: true });
export const insertFieldNotesEntrySchema = createInsertSchema(fieldNotesEntries).omit({ id: true });

export type FieldNotesSession = typeof fieldNotesSessions.$inferSelect;
export type InsertFieldNotesSession = z.infer<typeof insertFieldNotesSessionSchema>;
export type FieldNotesAsset = typeof fieldNotesAssets.$inferSelect;
export type InsertFieldNotesAsset = z.infer<typeof insertFieldNotesAssetSchema>;
export type FieldNotesTranscriptChunk = typeof fieldNotesTranscriptChunks.$inferSelect;
export type FieldNotesEntry = typeof fieldNotesEntries.$inferSelect;
export type InsertFieldNotesEntry = z.infer<typeof insertFieldNotesEntrySchema>;
export type FieldNotesEntryTag = typeof fieldNotesEntryTags.$inferSelect;
