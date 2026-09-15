import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal, json } from "drizzle-orm/pg-core";
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
  // Super Admin trial access fields
  isTrialAccess: boolean("is_trial_access").notNull().default(false),
  trialStartDate: text("trial_start_date"),
  trialEndDate: text("trial_end_date"),
  trialDays: integer("trial_days"),
  createdBySuperAdmin: boolean("created_by_super_admin").notNull().default(false),
  trialStatus: text("trial_status"),
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
  // Attendance alert email settings
  alertLateClockIn: boolean("alert_late_clock_in").notNull().default(false),
  alertMissedShift: boolean("alert_missed_shift").notNull().default(false),
  alertEmployeeClockedIn: boolean("alert_employee_clocked_in").notNull().default(false),
  alertEmployeeClockedOut: boolean("alert_employee_clocked_out").notNull().default(false),
  alertDailySummary: boolean("alert_daily_summary").notNull().default(false),
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
  // Management role (for admin users): admin | assistant | team
  managementRole: text("management_role"),
  // Invite flow fields
  inviteToken: text("invite_token"),
  inviteExpiresAt: text("invite_expires_at"),
  inviteSentAt: text("invite_sent_at"),
  inviteAcceptedAt: text("invite_accepted_at"),
  inviteStatus: text("invite_status").default("not_sent"),
  // Temporary password (super-admin-created accounts)
  temporaryPasswordRequired: boolean("temporary_password_required").notNull().default(false),
  temporaryPasswordCreatedAt: text("temporary_password_created_at"),
  temporaryPasswordExpiresAt: text("temporary_password_expires_at"),
  temporaryPasswordLastSentAt: text("temporary_password_last_sent_at"),
  createdBySuperAdmin: boolean("created_by_super_admin").notNull().default(false),
  // Per-admin Fit for Duty email preference: all | flagged_only | off
  fitForDutyEmailPreference: text("fit_for_duty_email_preference").notNull().default("flagged_only"),
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

// Immutable employee fit-for-duty submissions; review fields live separately.
export const fitForDutyVerifications = pgTable("fit_for_duty_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  shiftId: varchar("shift_id"),
  locationId: varchar("location_id"),
  clockInId: varchar("clock_in_id"),
  questionTextSnapshot: text("question_text_snapshot").notNull(),
  answerSnapshot: text("answer_snapshot").notNull(),
  declarationTextSnapshot: text("declaration_text_snapshot").notNull(),
  declarationVersion: text("declaration_version").notNull().default("1"),
  confirmationAccepted: boolean("confirmation_accepted").notNull().default(false),
  acceptedAt: text("accepted_at").notNull(),
  facePhotoPath: text("face_photo_path"),
  facePhotoCapturedAt: text("face_photo_captured_at"),
  status: text("status").notNull().default("flagged"),
  originalSubmission: text("original_submission").notNull(),
});

export const fitForDutyReviews = pgTable("fit_for_duty_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verificationId: varchar("verification_id").notNull(),
  companyId: varchar("company_id").notNull(),
  decision: text("decision").notNull(),
  reviewerId: varchar("reviewer_id").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
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
  // Admin-to-cleaner request fields
  requiresReplyBeforeClockOut: boolean("requires_reply_before_clock_out").notNull().default(false),
  cleanerViewedAt: text("cleaner_viewed_at"),
  adminReadReplyAt: text("admin_read_reply_at"),
  clientReadAt: text("client_read_at"),
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
  priorityAlertId: varchar("priority_alert_id"),
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
export const insertFitForDutyVerificationSchema = createInsertSchema(fitForDutyVerifications).omit({ id: true });
export const insertFitForDutyReviewSchema = createInsertSchema(fitForDutyReviews).omit({ id: true });
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
export type FitForDutyVerification = typeof fitForDutyVerifications.$inferSelect;
export type InsertFitForDutyVerification = z.infer<typeof insertFitForDutyVerificationSchema>;
export type FitForDutyReview = typeof fitForDutyReviews.$inferSelect;
export type InsertFitForDutyReview = z.infer<typeof insertFitForDutyReviewSchema>;
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
  // ── Extended Incident Report fields (13-step wizard) ──────────────────────
  supervisorNotified: boolean("supervisor_notified").default(false),
  supervisorName: text("supervisor_name"),
  incidentTypes: text("incident_types"),            // JSON: string[]
  peopleInvolved: text("people_involved"),          // JSON: {name,role,contact,injured}[]
  narrativeSummary: text("narrative_summary"),      // AI-generated paragraph
  rootCause: text("root_cause"),
  contributingFactors: text("contributing_factors"),// JSON: string[]
  correctiveActionsStructured: text("corrective_actions_structured"), // JSON: {action,responsible,deadline,completed}[]
  clientNotificationDetail: text("client_notification_detail"),       // JSON: object
  witnessList: text("witness_list"),                // JSON: {name,contact,statementAttached}[]
  equipmentInvolved: text("equipment_involved"),    // JSON: {item,damageType,estimatedValue,reportedBy}[]
  areaSecured: boolean("area_secured").default(false),
  attachmentsChecklist: text("attachments_checklist"),// JSON: object
  // Incident workflow configuration (kept on the existing report row)
  incidentMinPhotos: integer("incident_min_photos").notNull().default(0),
  incidentQuestionsJson: text("incident_questions_json"),
  incidentDeclarationText: text("incident_declaration_text"),
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

// ── Incident workflow extensions ────────────────────────────────────────────
// These tables deliberately keep employee-provided content separate from the
// editable report row.  Once submitted, the snapshot is immutable.
export const incidentEmployeeSnapshots = pgTable("incident_employee_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull().unique(),
  companyId: varchar("company_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  employeeIdSnapshot: text("employee_id_snapshot").notNull(),
  employeeNameSnapshot: text("employee_name_snapshot").notNull(),
  positionSnapshot: text("position_snapshot"),
  statementSnapshot: text("statement_snapshot").notNull(),
  answersJson: text("answers_json").notNull().default("{}"),
  declarationTextSnapshot: text("declaration_text_snapshot").notNull(),
  signatureDataUrl: text("signature_data_url").notNull(),
  signedAt: text("signed_at").notNull(),
  submittedAt: text("submitted_at").notNull(),
  createdAt: text("created_at").notNull(),
});
export const incidentEvidence = pgTable("incident_evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull(),
  companyId: varchar("company_id").notNull(),
  storageName: text("storage_name").notNull().unique(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  caption: text("caption"),
  uploadedByUserId: varchar("uploaded_by_user_id").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
});
export const incidentTemplates = pgTable("incident_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  name: text("name").notNull(),
  version: integer("version").notNull().default(1),
  questionsJson: text("questions_json").notNull().default("[]"),
  active: boolean("active").notNull().default(true),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: text("created_at").notNull(),
});
export const incidentAmendments = pgTable("incident_amendments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull(),
  companyId: varchar("company_id").notNull(),
  requestedByUserId: varchar("requested_by_user_id").notNull(),
  requestedByRole: text("requested_by_role").notNull(),
  reason: text("reason").notNull(),
  contentJson: text("content_json").notNull(),
  status: text("status").notNull().default("requested"),
  submittedAt: text("submitted_at"),
  createdAt: text("created_at").notNull(),
});
export const incidentInvestigations = pgTable("incident_investigations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull().unique(),
  companyId: varchar("company_id").notNull(),
  findings: text("findings"),
  correctiveAction: text("corrective_action"),
  finalDecision: text("final_decision"),
  nextSteps: text("next_steps"),
  clientAllowlistJson: text("client_allowlist_json").notNull().default("[]"),
  updatedByUserId: varchar("updated_by_user_id").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const insertIncidentEmployeeSnapshotSchema = createInsertSchema(incidentEmployeeSnapshots).omit({ id: true });
export const insertIncidentEvidenceSchema = createInsertSchema(incidentEvidence).omit({ id: true });
export const insertIncidentTemplateSchema = createInsertSchema(incidentTemplates).omit({ id: true });
export const insertIncidentAmendmentSchema = createInsertSchema(incidentAmendments).omit({ id: true });
export const insertIncidentInvestigationSchema = createInsertSchema(incidentInvestigations).omit({ id: true });
export type IncidentEmployeeSnapshot = typeof incidentEmployeeSnapshots.$inferSelect;
export type IncidentEvidence = typeof incidentEvidence.$inferSelect;
export type IncidentTemplate = typeof incidentTemplates.$inferSelect;
export type IncidentAmendment = typeof incidentAmendments.$inferSelect;
export type IncidentInvestigation = typeof incidentInvestigations.$inferSelect;

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
  sessionSubtype: text("session_subtype").notNull().default("walkthrough_note"),
  title: text("title"),
  pageIntro: text("page_intro"),
  pageSummary: text("page_summary"),
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
  documentMode: text("document_mode").default("standard"),
  visitType: text("visit_type"),
  quoteData: text("quote_data"),
  afterStatus: text("after_status").default("none"),
  afterSummary: text("after_summary"),
  deletedAt: text("deleted_at"),
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
  areaLabel: text("area_label"),
  areaConfidence: text("area_confidence"),
  phase: text("phase").notNull().default("before"),
  isHiddenFromPublic: boolean("is_hidden_from_public").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const fieldNotesTranscriptChunks = pgTable("field_notes_transcript_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  chunkIndex: integer("chunk_index").notNull().default(0),
  startedAt: text("started_at"),
  endedAt: text("ended_at"),
  rawText: text("raw_text").notNull(),
  phase: text("phase").default("before"),
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
  isHiddenFromPublic: boolean("is_hidden_from_public").notNull().default(false),
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

export const fieldNotesPublicDocuments = pgTable("field_notes_public_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  companyId: varchar("company_id").notNull(),
  shareToken: varchar("share_token").notNull(),
  publicShortId: text("public_short_id").unique(),
  title: text("title"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  showTimestamps: boolean("show_timestamps").notNull().default(false),
  showInternalNotes: boolean("show_internal_notes").notNull().default(false),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const fieldNotesTodos = pgTable("field_notes_todos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  text: text("text").notNull(),
  isComplete: boolean("is_complete").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const insertFieldNotesSessionSchema = createInsertSchema(fieldNotesSessions).omit({ id: true });
export const insertFieldNotesAssetSchema = createInsertSchema(fieldNotesAssets).omit({ id: true });
export const insertFieldNotesEntrySchema = createInsertSchema(fieldNotesEntries).omit({ id: true });
export const insertFieldNotesTodosSchema = createInsertSchema(fieldNotesTodos).omit({ id: true });

export type FieldNotesSession = typeof fieldNotesSessions.$inferSelect;
export type InsertFieldNotesSession = z.infer<typeof insertFieldNotesSessionSchema>;
export type FieldNotesAsset = typeof fieldNotesAssets.$inferSelect;
export type InsertFieldNotesAsset = z.infer<typeof insertFieldNotesAssetSchema>;
export type FieldNotesTranscriptChunk = typeof fieldNotesTranscriptChunks.$inferSelect;
export type FieldNotesEntry = typeof fieldNotesEntries.$inferSelect;
export type InsertFieldNotesEntry = z.infer<typeof insertFieldNotesEntrySchema>;
export type FieldNotesEntryTag = typeof fieldNotesEntryTags.$inferSelect;
export type FieldNotesTodo = typeof fieldNotesTodos.$inferSelect;
export type InsertFieldNotesTodo = z.infer<typeof insertFieldNotesTodosSchema>;

// ── Attendance Adjustments ────────────────────────────────────────────────────
export const attendanceAdjustments = pgTable("attendance_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  timeEntryId: varchar("time_entry_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  adjustmentMinutes: integer("adjustment_minutes").notNull(),
  reason: text("reason").notNull(),
  note: text("note"),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: text("created_at").notNull(),
  isVoided: boolean("is_voided").notNull().default(false),
  voidedByUserId: varchar("voided_by_user_id"),
  voidedAt: text("voided_at"),
});

export const insertAttendanceAdjustmentSchema = createInsertSchema(attendanceAdjustments).omit({ id: true });
export type AttendanceAdjustment = typeof attendanceAdjustments.$inferSelect;
export type InsertAttendanceAdjustment = z.infer<typeof insertAttendanceAdjustmentSchema>;

// ── Priority Clean Alerts ─────────────────────────────────────────────────────
export const priorityCleanAlerts = pgTable("priority_clean_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  locationId: varchar("location_id"),
  submissionId: varchar("submission_id"),
  title: text("title").notNull(),
  message: text("message"),
  status: text("status").notNull().default("open"),
  visibleOnPublicLink: boolean("visible_on_public_link").notNull().default(true),
  assignedEmployeeId: varchar("assigned_employee_id"),
  resolvedAt: text("resolved_at"),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const priorityCleanPhotos = pgTable("priority_clean_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertId: varchar("alert_id").notNull(),
  fileUrl: text("file_url").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertPriorityCleanAlertSchema = createInsertSchema(priorityCleanAlerts).omit({ id: true });
export const insertPriorityCleanPhotoSchema = createInsertSchema(priorityCleanPhotos).omit({ id: true });

export type PriorityCleanAlert = typeof priorityCleanAlerts.$inferSelect;
export type InsertPriorityCleanAlert = z.infer<typeof insertPriorityCleanAlertSchema>;
export type PriorityCleanPhoto = typeof priorityCleanPhotos.$inferSelect;
export type InsertPriorityCleanPhoto = z.infer<typeof insertPriorityCleanPhotoSchema>;

// ── Supplies ──────────────────────────────────────────────────────────────────
export const supplies = pgTable("supplies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  locationId: varchar("location_id"),
  locationName: text("location_name"),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  imageData: text("image_data"),
  status: text("status").notNull().default("in_stock"),
  quantityLabel: text("quantity_label"),
  isActive: boolean("is_active").notNull().default(true),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  // Inventory integration fields (additive)
  inventoryItemId: varchar("inventory_item_id"),
  requestedQuantity: integer("requested_quantity"),
  fulfilledQuantity: integer("fulfilled_quantity").notNull().default(0),
  linkedExpenseId: varchar("linked_expense_id"),
  urgency: text("urgency").default("normal"), // normal, urgent, critical
});

export const supplyUpdates = pgTable("supply_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplyId: varchar("supply_id").notNull(),
  companyId: varchar("company_id").notNull(),
  locationId: varchar("location_id"),
  employeeId: varchar("employee_id"),
  employeeName: text("employee_name"),
  updatedByRole: text("updated_by_role").notNull(),
  updatedByUserId: varchar("updated_by_user_id"),
  updatedByName: text("updated_by_name"),
  updateType: text("update_type").notNull(),
  note: text("note"),
  photoData: text("photo_data"),
  photos: text("photos"),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  adminResponse: text("admin_response"),
  adminRespondedAt: text("admin_responded_at"),
  adminRespondedBy: text("admin_responded_by"),
  seenByEmployee: integer("seen_by_employee").default(0),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
  resolvedBy: text("resolved_by"),
});

// ── Inventory Items ──────────────────────────────────────────────────────────
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  imageData: text("image_data"),
  currentQuantity: integer("current_quantity").notNull().default(0),
  unitPrice: text("unit_price").notNull().default("0"),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(2),
  status: text("status").notNull().default("in_stock"), // in_stock, running_low, out_of_stock
  supplierName: text("supplier_name"),
  notes: text("notes"),
  createdByAdminId: varchar("created_by_admin_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Inventory Purchases ───────────────────────────────────────────────────────
export const inventoryPurchases = pgTable("inventory_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  inventoryItemId: varchar("inventory_item_id").notNull(),
  inventoryItemName: text("inventory_item_name"),
  quantityAdded: integer("quantity_added").notNull(),
  unitPrice: text("unit_price").notNull(),
  totalCost: text("total_cost").notNull(),
  supplierName: text("supplier_name"),
  purchaseDate: text("purchase_date").notNull(),
  notes: text("notes"),
  createdByAdminId: varchar("created_by_admin_id").notNull(),
  createdByAdminName: text("created_by_admin_name"),
  createdAt: text("created_at").notNull(),
});

// ── Inventory Movements ───────────────────────────────────────────────────────
export const inventoryMovements = pgTable("inventory_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  inventoryItemId: varchar("inventory_item_id").notNull(),
  inventoryItemName: text("inventory_item_name"),
  movementType: text("movement_type").notNull(), // purchase, assigned_to_location, manual_adjustment, returned_to_inventory, damaged, missing
  quantity: integer("quantity").notNull(),
  unitPriceAtTime: text("unit_price_at_time").notNull(),
  totalValue: text("total_value").notNull(),
  locationId: varchar("location_id"),
  locationName: text("location_name"),
  supplyRequestId: varchar("supply_request_id"),
  notes: text("notes"),
  createdByAdminId: varchar("created_by_admin_id").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── Location Supply Expenses ──────────────────────────────────────────────────
export const locationSupplyExpenses = pgTable("location_supply_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  locationId: varchar("location_id").notNull(),
  locationName: text("location_name"),
  inventoryItemId: varchar("inventory_item_id").notNull(),
  inventoryItemName: text("inventory_item_name"),
  category: text("category").notNull(),
  supplyRequestId: varchar("supply_request_id"),
  quantity: integer("quantity").notNull(),
  unitPriceAtTime: text("unit_price_at_time").notNull(),
  totalExpense: text("total_expense").notNull(),
  assignedDate: text("assigned_date").notNull(),
  assignedByAdminId: varchar("assigned_by_admin_id").notNull(),
  assignedByAdminName: text("assigned_by_admin_name"),
  assignedEmployeeId: varchar("assigned_employee_id"),
  assignedEmployeeName: text("assigned_employee_name"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

export const insertSupplySchema = createInsertSchema(supplies).omit({ id: true });
export const insertSupplyUpdateSchema = createInsertSchema(supplyUpdates).omit({ id: true });
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true });
export const insertInventoryPurchaseSchema = createInsertSchema(inventoryPurchases).omit({ id: true });
export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({ id: true });
export const insertLocationSupplyExpenseSchema = createInsertSchema(locationSupplyExpenses).omit({ id: true });

export type Supply = typeof supplies.$inferSelect;
export type InsertSupply = z.infer<typeof insertSupplySchema>;
export type SupplyUpdate = typeof supplyUpdates.$inferSelect;
export type InsertSupplyUpdate = z.infer<typeof insertSupplyUpdateSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryPurchase = typeof inventoryPurchases.$inferSelect;
export type InsertInventoryPurchase = z.infer<typeof insertInventoryPurchaseSchema>;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = z.infer<typeof insertInventoryMovementSchema>;
export type LocationSupplyExpense = typeof locationSupplyExpenses.$inferSelect;
export type InsertLocationSupplyExpense = z.infer<typeof insertLocationSupplyExpenseSchema>;

// ── Publications ──────────────────────────────────────────────────────────────
export const publications = pgTable("publications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  slug: text("slug").notNull(),
  status: text("status").notNull().default("draft"),
  coverImageData: text("cover_image_data"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  introText: text("intro_text"),
  category: text("category"),
  helpfulVotingEnabled: boolean("helpful_voting_enabled").notNull().default(true),
  contactCtaEnabled: boolean("contact_cta_enabled").notNull().default(true),
  contactUseDefault: boolean("contact_use_default").notNull().default(true),
  contactCompanyName: text("contact_company_name"),
  contactAddress: text("contact_address"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  contactWebsite: text("contact_website"),
  contactCtaText: text("contact_cta_text"),
  contactCtaLink: text("contact_cta_link"),
  createdBy: varchar("created_by").notNull(),
  publishedAt: text("published_at"),
  brandingSource: text("branding_source").notNull().default("company"),
  customBrandName: text("custom_brand_name"),
  customBrandLogoUrl: text("custom_brand_logo_url"),
  publicationFormat: text("publication_format").notNull().default("standard"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const publicationSections = pgTable("publication_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  publicationId: varchar("publication_id").notNull(),
  sectionType: text("section_type").notNull().default("text"),
  title: text("title"),
  body: text("body"),
  sortOrder: integer("sort_order").notNull().default(0),
  pricingItems: text("pricing_items"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const publicationMedia = pgTable("publication_media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  publicationId: varchar("publication_id").notNull(),
  sectionId: varchar("section_id"),
  imageData: text("image_data").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const publicationPricing = pgTable("publication_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  publicationId: varchar("publication_id").notNull(),
  itemName: text("item_name").notNull(),
  description: text("description"),
  price: text("price"),
  unit: text("unit"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const publicationVotes = pgTable("publication_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  publicationId: varchar("publication_id").notNull(),
  vote: text("vote").notNull(),
  sessionId: text("session_id"),
  createdAt: text("created_at").notNull(),
});

export const insertPublicationSchema = createInsertSchema(publications).omit({ id: true });
export const insertPublicationSectionSchema = createInsertSchema(publicationSections).omit({ id: true });
export const insertPublicationMediaSchema = createInsertSchema(publicationMedia).omit({ id: true });
export const insertPublicationPricingSchema = createInsertSchema(publicationPricing).omit({ id: true });
export const insertPublicationVoteSchema = createInsertSchema(publicationVotes).omit({ id: true });

export type Publication = typeof publications.$inferSelect;
export type InsertPublication = z.infer<typeof insertPublicationSchema>;
export type PublicationSection = typeof publicationSections.$inferSelect;
export type InsertPublicationSection = z.infer<typeof insertPublicationSectionSchema>;
export type PublicationMedia = typeof publicationMedia.$inferSelect;
export type InsertPublicationMedia = z.infer<typeof insertPublicationMediaSchema>;
export type PublicationPricing = typeof publicationPricing.$inferSelect;
export type InsertPublicationPricing = z.infer<typeof insertPublicationPricingSchema>;
export type PublicationVote = typeof publicationVotes.$inferSelect;
export type InsertPublicationVote = z.infer<typeof insertPublicationVoteSchema>;

// ── Quote Forms ────────────────────────────────────────────────────────────
export type FormFieldType = "text" | "email" | "tel" | "number" | "select" | "textarea" | "checkbox" | "date";
export type FormField = {
  id: string; label: string; type: FormFieldType;
  required: boolean; enabled: boolean;
  placeholder?: string; options?: string[]; column: "full" | "half";
  visibilityRule?: "always" | "residential_only" | "commercial_only";
  // Generic conditional: field shown only when another field has one of the listed values
  showWhenField?: string;
  showWhenValues?: string[];
};
export type FormStep = { id: string; title: string; enabled: boolean; fields: FormField[] };
export type FormConfig = { steps: FormStep[]; smartMode?: string };

export const DEFAULT_FORM_CONFIG: FormConfig = {
  steps: [
    {
      id: "contact", title: "Contact Information", enabled: true,
      fields: [
        { id: "firstName", label: "First Name", type: "text", required: false, enabled: true, placeholder: "Jane", column: "half" },
        { id: "lastName", label: "Last Name", type: "text", required: false, enabled: true, placeholder: "Smith", column: "half" },
        { id: "email", label: "Email Address", type: "email", required: true, enabled: true, placeholder: "jane@example.com", column: "full" },
        { id: "phone", label: "Phone Number", type: "tel", required: false, enabled: true, placeholder: "(555) 000-0000", column: "full" },
        { id: "smsConsent", label: "I agree to receive SMS updates about my service request", type: "checkbox", required: false, enabled: false, placeholder: "", column: "full" },
        { id: "marketingConsent", label: "I'd like to receive marketing emails", type: "checkbox", required: false, enabled: false, placeholder: "", column: "full" },
      ],
    },
    {
      id: "address", title: "Service Address", enabled: true,
      fields: [
        { id: "street", label: "Street Address", type: "text", required: false, enabled: true, placeholder: "123 Main Street", column: "full" },
        { id: "unit", label: "Unit / Suite", type: "text", required: false, enabled: true, placeholder: "Apt 4B", column: "full" },
        { id: "city", label: "City", type: "text", required: false, enabled: true, placeholder: "Winnipeg", column: "half" },
        { id: "province", label: "Province / State", type: "text", required: false, enabled: true, placeholder: "MB", column: "half" },
        { id: "postalCode", label: "Postal Code", type: "text", required: false, enabled: true, placeholder: "R3C 0A1", column: "full" },
      ],
    },
    {
      id: "service", title: "Service Details", enabled: true,
      fields: [
        { id: "serviceType", label: "Service Type", type: "select", required: false, enabled: true, options: ["Regular Cleaning", "Deep Cleaning", "Move-In / Move-Out", "Post-Construction", "Office Cleaning", "Other"], column: "full" },
        { id: "propertyType", label: "Property Type", type: "select", required: false, enabled: true, options: ["Residential", "Commercial"], column: "full" },
        { id: "sqft", label: "Square Footage", type: "number", required: false, enabled: true, placeholder: "e.g. 1500", column: "half" },
        { id: "rooms", label: "Bedrooms", type: "number", required: false, enabled: true, placeholder: "e.g. 3", column: "half" },
        { id: "bathrooms", label: "Bathrooms", type: "number", required: false, enabled: true, placeholder: "e.g. 2", column: "half" },
        // ── Frequency section ──────────────────────────────────────────────
        { id: "frequencyType", label: "Cleaning Frequency", type: "select", required: false, enabled: true, options: ["One-time", "Weekly", "Bi-weekly", "Monthly", "Custom schedule"], column: "half" },
        // One-time sub-fields
        { id: "preferredDate", label: "Preferred Date", type: "date", required: false, enabled: true, placeholder: "", column: "half", showWhenField: "frequencyType", showWhenValues: ["One-time"] },
        { id: "preferredTime", label: "Preferred Time", type: "select", required: false, enabled: true, options: ["Morning (8am–12pm)", "Afternoon (12pm–5pm)", "Evening (5pm–8pm)", "Flexible"], column: "full", showWhenField: "frequencyType", showWhenValues: ["One-time"] },
        // Weekly sub-field
        { id: "daysPerWeek", label: "Days Per Week", type: "select", required: false, enabled: true, options: ["1 day per week", "2 days per week", "3 days per week", "4 days per week", "5 days per week", "6 days per week", "7 days per week"], column: "half", showWhenField: "frequencyType", showWhenValues: ["Weekly"] },
        // Bi-weekly sub-field
        { id: "visitsBiweekly", label: "Visits Every 2 Weeks", type: "select", required: false, enabled: true, options: ["1 visit every 2 weeks", "2 visits every 2 weeks", "3 visits every 2 weeks"], column: "half", showWhenField: "frequencyType", showWhenValues: ["Bi-weekly"] },
        // Monthly sub-field
        { id: "visitsPerMonth", label: "Visits Per Month", type: "select", required: false, enabled: true, options: ["1 visit per month", "2 visits per month", "3 visits per month", "4 visits per month", "Custom"], column: "half", showWhenField: "frequencyType", showWhenValues: ["Monthly"] },
        // Custom sub-fields
        { id: "scheduleDescription", label: "Describe Your Schedule", type: "textarea", required: false, enabled: true, placeholder: "e.g. Twice a week Mon/Thu plus monthly deep clean...", column: "full", showWhenField: "frequencyType", showWhenValues: ["Custom schedule"] },
        { id: "estimatedVisitsPerMonth", label: "Estimated Visits Per Month", type: "number", required: false, enabled: true, placeholder: "e.g. 8", column: "half", showWhenField: "frequencyType", showWhenValues: ["Custom schedule"] },
        // Recurring shared sub-fields (Weekly + Bi-weekly + Monthly + Custom)
        { id: "preferredDays", label: "Preferred Day(s)", type: "text", required: false, enabled: true, placeholder: "e.g. Monday, Wednesday", column: "half", showWhenField: "frequencyType", showWhenValues: ["Weekly", "Bi-weekly", "Monthly"] },
        { id: "contractLength", label: "Service Agreement Length", type: "select", required: false, enabled: true, options: ["Month-to-month", "3 months", "6 months", "12 months", "Custom"], column: "half", showWhenField: "frequencyType", showWhenValues: ["Weekly", "Bi-weekly", "Monthly", "Custom schedule"] },
        { id: "estimateDisplayPreference", label: "Show pricing as", type: "select", required: false, enabled: true, options: ["Monthly estimate", "Per visit + monthly estimate"], column: "full", showWhenField: "frequencyType", showWhenValues: ["Weekly", "Bi-weekly", "Monthly", "Custom schedule"] },
      ],
    },
    {
      id: "extras", title: "Final Details", enabled: true,
      fields: [
        { id: "notes", label: "Special Instructions", type: "textarea", required: false, enabled: true, placeholder: "Anything we should know about your space?", column: "full" },
        { id: "budget", label: "Budget Range (optional)", type: "text", required: false, enabled: true, placeholder: "e.g. $150–$200", column: "full" },
      ],
    },
  ],
};

export const SMART_CLEANING_CONFIG: FormConfig = {
  smartMode: "cleaning",
  steps: [
    {
      id: "contact", title: "Contact Information", enabled: true,
      fields: [
        { id: "firstName", label: "First Name", type: "text", required: true, enabled: true, placeholder: "Jane", column: "half" },
        { id: "lastName", label: "Last Name", type: "text", required: true, enabled: true, placeholder: "Smith", column: "half" },
        { id: "email", label: "Email Address", type: "email", required: true, enabled: true, placeholder: "jane@example.com", column: "full" },
        { id: "phone", label: "Phone Number", type: "tel", required: false, enabled: true, placeholder: "(555) 000-0000", column: "full" },
        { id: "companyName", label: "Company Name (if commercial)", type: "text", required: false, enabled: true, placeholder: "ABC Corp", column: "full", visibilityRule: "commercial_only" },
        { id: "preferredContact", label: "Preferred Contact Method", type: "select", required: false, enabled: true, options: ["Email", "Phone", "Text/SMS"], column: "full" },
      ],
    },
    {
      id: "service", title: "Service Type", enabled: true,
      fields: [
        { id: "propertyType", label: "Property Type", type: "select", required: true, enabled: true, options: ["Residential", "Commercial"], column: "full" },
        { id: "serviceType", label: "Service Needed", type: "select", required: true, enabled: true, options: ["Regular Cleaning", "Deep Cleaning", "Move-In / Move-Out", "Post-Construction", "Office Cleaning", "Restaurant Cleaning", "Retail Cleaning", "Other"], column: "full" },
        // ── Frequency section ──────────────────────────────────────────────
        { id: "frequencyType", label: "Cleaning Frequency", type: "select", required: true, enabled: true, options: ["One-time", "Weekly", "Bi-weekly", "Monthly", "Custom schedule"], column: "full" },
        // One-time sub-fields
        { id: "preferredDate", label: "Preferred Cleaning Date", type: "date", required: false, enabled: true, placeholder: "", column: "half", showWhenField: "frequencyType", showWhenValues: ["One-time"] },
        { id: "preferredTime", label: "Preferred Time", type: "select", required: false, enabled: true, options: ["Morning (8am–12pm)", "Afternoon (12pm–5pm)", "Evening (5pm–8pm)", "Flexible"], column: "half", showWhenField: "frequencyType", showWhenValues: ["One-time"] },
        { id: "oneTimeNote", label: "One-Time Service Note (optional)", type: "textarea", required: false, enabled: true, placeholder: "e.g. Move-out clean, post-renovation deep clean...", column: "full", showWhenField: "frequencyType", showWhenValues: ["One-time"] },
        // Weekly sub-field
        { id: "daysPerWeek", label: "Days Per Week", type: "select", required: false, enabled: true, options: ["1 day per week", "2 days per week", "3 days per week", "4 days per week", "5 days per week", "6 days per week", "7 days per week"], column: "half", showWhenField: "frequencyType", showWhenValues: ["Weekly"] },
        // Bi-weekly sub-field
        { id: "visitsBiweekly", label: "Visits Every 2 Weeks", type: "select", required: false, enabled: true, options: ["1 visit every 2 weeks", "2 visits every 2 weeks", "3 visits every 2 weeks"], column: "half", showWhenField: "frequencyType", showWhenValues: ["Bi-weekly"] },
        // Monthly sub-field
        { id: "visitsPerMonth", label: "Visits Per Month", type: "select", required: false, enabled: true, options: ["1 visit per month", "2 visits per month", "3 visits per month", "4 visits per month", "Custom"], column: "half", showWhenField: "frequencyType", showWhenValues: ["Monthly"] },
        // Custom schedule sub-fields
        { id: "scheduleDescription", label: "Describe Your Schedule", type: "textarea", required: false, enabled: true, placeholder: "e.g. Twice a week Mon/Thu plus monthly deep clean...", column: "full", showWhenField: "frequencyType", showWhenValues: ["Custom schedule"] },
        { id: "estimatedVisitsPerMonth", label: "Estimated Visits Per Month", type: "number", required: false, enabled: true, placeholder: "e.g. 8", column: "half", showWhenField: "frequencyType", showWhenValues: ["Custom schedule"] },
        // Recurring shared sub-fields
        { id: "preferredDays", label: "Preferred Day(s)", type: "text", required: false, enabled: true, placeholder: "e.g. Monday, Wednesday", column: "half", showWhenField: "frequencyType", showWhenValues: ["Weekly", "Bi-weekly", "Monthly"] },
        { id: "contractLength", label: "Service Agreement Length", type: "select", required: false, enabled: true, options: ["Month-to-month", "3 months", "6 months", "12 months", "Custom"], column: "half", showWhenField: "frequencyType", showWhenValues: ["Weekly", "Bi-weekly", "Monthly", "Custom schedule"] },
        { id: "estimateDisplayPreference", label: "How would you like to see pricing?", type: "select", required: false, enabled: true, options: ["Monthly estimate", "Per visit + monthly estimate"], column: "full", showWhenField: "frequencyType", showWhenValues: ["Weekly", "Bi-weekly", "Monthly", "Custom schedule"] },
      ],
    },
    {
      id: "details", title: "Property Details", enabled: true,
      fields: [
        // Shared
        { id: "serviceAddress", label: "Service Address", type: "text", required: true, enabled: true, placeholder: "123 Main Street", column: "full" },
        { id: "city", label: "City", type: "text", required: false, enabled: true, placeholder: "Winnipeg", column: "half" },
        { id: "province", label: "Province", type: "text", required: false, enabled: true, placeholder: "MB", column: "half" },
        { id: "sqft", label: "Square Footage", type: "number", required: false, enabled: true, placeholder: "e.g. 1500", column: "half" },
        // Residential only
        { id: "homeType", label: "Home Type", type: "select", required: false, enabled: true, options: ["House", "Apartment", "Condo", "Townhouse", "Other"], column: "half", visibilityRule: "residential_only" },
        { id: "bedrooms", label: "Bedrooms", type: "number", required: false, enabled: true, placeholder: "e.g. 3", column: "half", visibilityRule: "residential_only" },
        { id: "bathrooms", label: "Bathrooms", type: "number", required: false, enabled: true, placeholder: "e.g. 2", column: "half", visibilityRule: "residential_only" },
        { id: "hasBasement", label: "Basement to be cleaned", type: "checkbox", required: false, enabled: true, placeholder: "", column: "full", visibilityRule: "residential_only" },
        { id: "moveInOut", label: "Move-in / Move-out clean", type: "checkbox", required: false, enabled: true, placeholder: "", column: "full", visibilityRule: "residential_only" },
        { id: "deepClean", label: "Deep cleaning required", type: "checkbox", required: false, enabled: true, placeholder: "", column: "full", visibilityRule: "residential_only" },
        { id: "hasPets", label: "Pets in home", type: "checkbox", required: false, enabled: true, placeholder: "", column: "full", visibilityRule: "residential_only" },
        { id: "suppliesNeeded", label: "Please bring cleaning supplies", type: "checkbox", required: false, enabled: true, placeholder: "", column: "full", visibilityRule: "residential_only" },
        // Commercial only
        { id: "businessType", label: "Type of Business", type: "select", required: false, enabled: true, options: ["Office", "Restaurant", "Retail", "Medical / Clinic", "Warehouse", "School / Daycare", "Gym / Fitness", "Other"], column: "full", visibilityRule: "commercial_only" },
        { id: "washrooms", label: "Number of Washrooms", type: "number", required: false, enabled: true, placeholder: "e.g. 4", column: "half", visibilityRule: "commercial_only" },
        { id: "offices", label: "Number of Offices / Rooms", type: "number", required: false, enabled: true, placeholder: "e.g. 10", column: "half", visibilityRule: "commercial_only" },
        { id: "floors", label: "Number of Floors", type: "number", required: false, enabled: true, placeholder: "e.g. 2", column: "half", visibilityRule: "commercial_only" },
        { id: "floorType", label: "Floor Type", type: "select", required: false, enabled: true, options: ["Carpet", "Tile", "Hardwood", "Concrete", "Vinyl", "Mixed"], column: "half", visibilityRule: "commercial_only" },
        { id: "afterHours", label: "After-hours cleaning required", type: "checkbox", required: false, enabled: true, placeholder: "", column: "full", visibilityRule: "commercial_only" },
        { id: "garbageRemoval", label: "Garbage removal needed", type: "checkbox", required: false, enabled: true, placeholder: "", column: "full", visibilityRule: "commercial_only" },
        { id: "securityInstructions", label: "Security / Alarm Instructions", type: "textarea", required: false, enabled: true, placeholder: "Alarm code, access notes…", column: "full", visibilityRule: "commercial_only" },
      ],
    },
    {
      id: "extras", title: "Final Details", enabled: true,
      fields: [
        { id: "additionalAreas", label: "Areas to Clean", type: "textarea", required: false, enabled: true, placeholder: "Kitchen, living room, master bedroom…", column: "full" },
        { id: "specialRequests", label: "Special Instructions or Requests", type: "textarea", required: false, enabled: true, placeholder: "Anything else we should know?", column: "full" },
        { id: "budget", label: "Approximate Budget (optional)", type: "text", required: false, enabled: true, placeholder: "e.g. $150–$250", column: "half" },
        { id: "howHeard", label: "How did you hear about us?", type: "select", required: false, enabled: true, options: ["Google", "Facebook", "Instagram", "Referral", "Flyer", "Other"], column: "half" },
        { id: "consent", label: "I agree to be contacted about this service request", type: "checkbox", required: true, enabled: true, placeholder: "", column: "full" },
      ],
    },
  ],
};

export const quoteForms = pgTable("quote_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  config: text("config").notNull(),
  createdAt: text("created_at").notNull(),
});

export const quoteFormSubmissions = pgTable("quote_form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formId: varchar("form_id").notNull(),
  companyId: varchar("company_id").notNull(),
  data: text("data").notNull(),
  status: text("status").notNull().default("new"),
  submittedAt: text("submitted_at").notNull(),
  // CRM fields (extracted from form data for easy querying)
  clientName: text("client_name"),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  serviceType: text("service_type"),
  serviceAddress: text("service_address"),
  // Pipeline & estimate tracking
  pipelineStage: text("pipeline_stage").notNull().default("new_request"),
  estimateStatus: text("estimate_status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  assignedTo: varchar("assigned_to"),
  archivedAt: text("archived_at"),
  // Email tracking
  confirmationEmailSentAt: text("confirmation_email_sent_at"),
  estimateEmailSentAt: text("estimate_email_sent_at"),
  quoteEmailSentAt: text("quote_email_sent_at"),
});

// ── AI Estimates ───────────────────────────────────────────────────────────
export const aiEstimates = pgTable("ai_estimates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull(),
  companyId: varchar("company_id").notNull(),
  status: text("status").notNull().default("pending"),
  priceMin: decimal("price_min", { precision: 10, scale: 2 }),
  priceMax: decimal("price_max", { precision: 10, scale: 2 }),
  recommendedPrice: decimal("recommended_price", { precision: 10, scale: 2 }),
  laborHours: decimal("labor_hours", { precision: 6, scale: 2 }),
  crewSize: integer("crew_size"),
  suggestedServices: text("suggested_services"),
  addOns: text("add_ons"),
  suppliesNeeded: text("supplies_needed"),
  riskNotes: text("risk_notes"),
  followUpQuestions: text("follow_up_questions"),
  confidenceLevel: text("confidence_level"),
  confidenceNote: text("confidence_note"),
  rawResponse: text("raw_response"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Form Quotes (auto-generated from AI estimate) ─────────────────────────
export const formQuotes = pgTable("form_quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull(),
  companyId: varchar("company_id").notNull(),
  status: text("status").notNull().default("draft"),
  price: decimal("price", { precision: 10, scale: 2 }),
  scopeOfWork: text("scope_of_work"),
  addOns: text("add_ons"),
  estimatedDuration: text("estimated_duration"),
  terms: text("terms"),
  notes: text("notes"),
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Estimator Settings (per company) ──────────────────────────────────────
export const estimatorSettings = pgTable("estimator_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().unique(),
  // ── Residential Pricing ────────────────────────────────────────────────
  hourlyRate: decimal("hourly_rate", { precision: 8, scale: 2 }).default("25"),
  minimumJobPrice: decimal("minimum_job_price", { precision: 8, scale: 2 }).default("80"),
  pricePerSqft: decimal("price_per_sqft", { precision: 6, scale: 4 }).default("0.08"),
  pricePerBathroom: decimal("price_per_bathroom", { precision: 8, scale: 2 }).default("15"),
  pricePerRoom: decimal("price_per_room", { precision: 8, scale: 2 }).default("20"),
  kitchenAddOn: decimal("kitchen_add_on", { precision: 8, scale: 2 }).default("25"),
  basementAddOn: decimal("basement_add_on", { precision: 8, scale: 2 }).default("40"),
  petFee: decimal("pet_fee", { precision: 8, scale: 2 }).default("15"),
  deepCleanMultiplier: decimal("deep_clean_multiplier", { precision: 4, scale: 2 }).default("1.5"),
  moveInOutMultiplier: decimal("move_in_out_multiplier", { precision: 4, scale: 2 }).default("1.75"),
  postConstructionMultiplier: decimal("post_construction_multiplier", { precision: 4, scale: 2 }).default("2.0"),
  commercialMultiplier: decimal("commercial_multiplier", { precision: 4, scale: 2 }).default("1.2"),
  afterHoursMultiplier: decimal("after_hours_multiplier", { precision: 4, scale: 2 }).default("1.25"),
  supplyFee: decimal("supply_fee", { precision: 8, scale: 2 }).default("15"),
  travelFee: decimal("travel_fee", { precision: 8, scale: 2 }).default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("5"),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }).default("20"),
  currency: text("currency").notNull().default("CAD"),
  defaultCrewSize: integer("default_crew_size").default(2),
  productivityRate: decimal("productivity_rate", { precision: 6, scale: 2 }).default("300"),
  serviceAreas: text("service_areas"),
  customRules: text("custom_rules"),
  // ── Commercial Pricing ─────────────────────────────────────────────────
  commHourlyRate: decimal("comm_hourly_rate", { precision: 8, scale: 2 }).default("35"),
  commMinimumJobPrice: decimal("comm_minimum_job_price", { precision: 8, scale: 2 }).default("150"),
  commPricePerSqft: decimal("comm_price_per_sqft", { precision: 6, scale: 4 }).default("0.06"),
  commPricePerWashroom: decimal("comm_price_per_washroom", { precision: 8, scale: 2 }).default("20"),
  commPricePerOffice: decimal("comm_price_per_office", { precision: 8, scale: 2 }).default("15"),
  commPricePerFloor: decimal("comm_price_per_floor", { precision: 8, scale: 2 }).default("30"),
  commKitchenAddOn: decimal("comm_kitchen_add_on", { precision: 8, scale: 2 }).default("35"),
  commGarbageAddOn: decimal("comm_garbage_add_on", { precision: 8, scale: 2 }).default("25"),
  commRestockAddOn: decimal("comm_restock_add_on", { precision: 8, scale: 2 }).default("20"),
  commFloorCareAddOn: decimal("comm_floor_care_add_on", { precision: 8, scale: 2 }).default("50"),
  commWindowCleanAddOn: decimal("comm_window_clean_add_on", { precision: 8, scale: 2 }).default("45"),
  commAfterHoursMultiplier: decimal("comm_after_hours_multiplier", { precision: 4, scale: 2 }).default("1.35"),
  commDailyServiceMultiplier: decimal("comm_daily_service_multiplier", { precision: 4, scale: 2 }).default("0.85"),
  commCommercialMultiplier: decimal("comm_commercial_multiplier", { precision: 4, scale: 2 }).default("1.2"),
  commSupplyFee: decimal("comm_supply_fee", { precision: 8, scale: 2 }).default("25"),
  commTravelFee: decimal("comm_travel_fee", { precision: 8, scale: 2 }).default("0"),
  commTaxRate: decimal("comm_tax_rate", { precision: 5, scale: 2 }).default("5"),
  commProfitMargin: decimal("comm_profit_margin", { precision: 5, scale: 2 }).default("20"),
  commDefaultCrewSize: integer("comm_default_crew_size").default(3),
  commProductivityRate: decimal("comm_productivity_rate", { precision: 6, scale: 2 }).default("400"),
  commCustomRules: text("comm_custom_rules"),
  updatedAt: text("updated_at").notNull(),
});

// ── Form Email Settings (per company) ─────────────────────────────────────
export const formEmailSettings = pgTable("form_email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().unique(),
  confirmationEnabled: boolean("confirmation_enabled").notNull().default(true),
  confirmationSubject: text("confirmation_subject").notNull().default("We received your request!"),
  confirmationBody: text("confirmation_body").notNull().default("Hi {client_first_name},\n\nThank you for reaching out to {company_name}! We've received your request and will get back to you shortly with a quote.\n\nBest regards,\n{company_name}"),
  estimateEnabled: boolean("estimate_enabled").notNull().default(false),
  estimateSubject: text("estimate_subject").notNull().default("Your estimate from {company_name}"),
  estimateBody: text("estimate_body").notNull().default("Hi {client_first_name},\n\nBased on the details you provided, here is your estimate:\n\nEstimated price: {estimated_price}\nService: {service_type}\nAddress: {service_address}\n\nPlease reply to this email if you have any questions.\n\nBest regards,\n{company_name}"),
  quoteReadyEnabled: boolean("quote_ready_enabled").notNull().default(false),
  quoteReadySubject: text("quote_ready_subject").notNull().default("Your quote is ready — {company_name}"),
  quoteReadyBody: text("quote_ready_body").notNull().default("Hi {client_first_name},\n\nYour quote is ready! Please contact us to review the details.\n\nBest regards,\n{company_name}"),
  replyTo: text("reply_to"),
  signature: text("signature"),
  updatedAt: text("updated_at").notNull(),
});

// ── Lead Activity Timeline ─────────────────────────────────────────────────
export const leadActivity = pgTable("lead_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull(),
  companyId: varchar("company_id").notNull(),
  eventType: text("event_type").notNull(),
  eventData: text("event_data").notNull().default("{}"),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: text("created_at").notNull(),
});

export const insertQuoteFormSchema = createInsertSchema(quoteForms).omit({ id: true });
export const insertQuoteFormSubmissionSchema = createInsertSchema(quoteFormSubmissions).omit({ id: true });
export const insertAiEstimateSchema = createInsertSchema(aiEstimates).omit({ id: true });
export const insertFormQuoteSchema = createInsertSchema(formQuotes).omit({ id: true });
export const insertEstimatorSettingsSchema = createInsertSchema(estimatorSettings).omit({ id: true });
export const insertFormEmailSettingsSchema = createInsertSchema(formEmailSettings).omit({ id: true });
export const insertLeadActivitySchema = createInsertSchema(leadActivity).omit({ id: true });

export type QuoteForm = typeof quoteForms.$inferSelect;
export type InsertQuoteForm = z.infer<typeof insertQuoteFormSchema>;
export type QuoteFormSubmission = typeof quoteFormSubmissions.$inferSelect;
export type InsertQuoteFormSubmission = z.infer<typeof insertQuoteFormSubmissionSchema>;
export type AiEstimate = typeof aiEstimates.$inferSelect;
export type InsertAiEstimate = z.infer<typeof insertAiEstimateSchema>;
export type FormQuote = typeof formQuotes.$inferSelect;
export type InsertFormQuote = z.infer<typeof insertFormQuoteSchema>;
export type EstimatorSettings = typeof estimatorSettings.$inferSelect;
export type InsertEstimatorSettings = z.infer<typeof insertEstimatorSettingsSchema>;
export type FormEmailSettings = typeof formEmailSettings.$inferSelect;
export type InsertFormEmailSettings = z.infer<typeof insertFormEmailSettingsSchema>;
export type LeadActivity = typeof leadActivity.$inferSelect;
export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;

// ── Proposals & Quotes ─────────────────────────────────────────────────────
export type ProposalStatus =
  | "draft" | "sent" | "viewed" | "accepted" | "rejected"
  | "thinking" | "expired" | "converted" | "cancelled" | "archived";

export type BusinessSnapshot = {
  name: string;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  brandColor: string | null;
};

export type ServiceDetails = {
  serviceType: string;
  frequency: string;
  daysPerWeek: string;
  hoursPerVisit: string;
  numCleaners: string;
  preferredTime: string;
  contractLength: string;
  proposedStartDate: string;
};

export type ScopeBullet = { id: string; text: string };
export type ScopeSection = { id: string; title: string; items: ScopeBullet[] };

export type IncludedItem = {
  id: string;
  label: string;
  status: "included" | "not_included" | "extra_cost";
};

export type PricingLineItem = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
};

export type TaxConfig = {
  type: "none" | "gst" | "pst" | "hst" | "custom";
  rate: number;
  label: string;
};

export type PricingConfig = {
  lineItems: PricingLineItem[];
  taxConfig: TaxConfig;
  subtotalOverride: number | null;
  notes: string;
  billingType?: string | null;
  billingLabel?: string | null;
  billingSuffix?: string | null;
};

export type ClientResponse = {
  name?: string;
  email?: string;
  note?: string;
  preferredStartDate?: string | null;
  rejectionReason?: string;
  followUpDate?: string | null;
  signature?: string | null;
  confirmedCheckbox?: boolean;
};

export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  proposalNumber: text("proposal_number").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  // Sales pipeline connections (nullable — additive only)
  submissionId: varchar("submission_id"),
  walkthroughId: varchar("walkthrough_id"),
  convertedClientId: varchar("converted_client_id"),
  // Client info
  clientId: varchar("client_id"),
  clientName: text("client_name").notNull().default(""),
  clientCompany: text("client_company").notNull().default(""),
  clientEmail: text("client_email").notNull().default(""),
  clientPhone: text("client_phone").notNull().default(""),
  serviceAddress: text("service_address").notNull().default(""),
  billingAddress: text("billing_address").notNull().default(""),
  contactPerson: text("contact_person").notNull().default(""),
  leadSource: text("lead_source").notNull().default(""),
  // Dates
  proposalDate: text("proposal_date").notNull(),
  expiryDate: text("expiry_date").notNull(),
  preparedByUserId: varchar("prepared_by_user_id"),
  // JSON content (stored as text, consistent with codebase pattern)
  businessSnapshot: text("business_snapshot").notNull().default("{}"),
  serviceDetails: text("service_details").notNull().default("{}"),
  scopeSections: text("scope_sections").notNull().default("[]"),
  includedItems: text("included_items").notNull().default("[]"),
  pricingConfig: text("pricing_config").notNull().default("{}"),
  termsText: text("terms_text").notNull().default(""),
  internalNotes: text("internal_notes").notNull().default(""),
  // Public sharing
  publicToken: text("public_token").notNull().unique(),
  // Tracking timestamps
  sentAt: text("sent_at"),
  viewedAt: text("viewed_at"),
  acceptedAt: text("accepted_at"),
  rejectedAt: text("rejected_at"),
  thinkingAt: text("thinking_at"),
  // Client response data
  clientResponse: text("client_response").notNull().default("{}"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const proposalActivityLogs = pgTable("proposal_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").notNull(),
  companyId: varchar("company_id").notNull(),
  eventType: text("event_type").notNull(),
  eventData: text("event_data").notNull().default("{}"),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: text("created_at").notNull(),
});

export const insertProposalSchema = createInsertSchema(proposals).omit({ id: true });
export const insertProposalActivityLogSchema = createInsertSchema(proposalActivityLogs).omit({ id: true });
export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type ProposalActivityLog = typeof proposalActivityLogs.$inferSelect;
export type InsertProposalActivityLog = z.infer<typeof insertProposalActivityLogSchema>;

// ── Agreement Templates ───────────────────────────────────────────────────────
export const agreementTemplates = pgTable("agreement_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  name: text("name").notNull(),
  title: text("title").notNull().default("Service Agreement"),
  body: text("body").notNull().default(""),
  termsText: text("terms_text").notNull().default(""),
  paymentTerms: text("payment_terms").notNull().default(""),
  contractDuration: text("contract_duration").notNull().default(""),
  cancellationPolicy: text("cancellation_policy").notNull().default(""),
  witnessEnabled: boolean("witness_enabled").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Agreements ────────────────────────────────────────────────────────────────
export const agreements = pgTable("agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  proposalId: varchar("proposal_id"),
  templateId: varchar("template_id"),
  title: text("title").notNull().default("Service Agreement"),
  content: text("content").notNull().default(""),
  status: text("status").notNull().default("draft"),
  // Client info
  clientName: text("client_name").notNull().default(""),
  clientEmail: text("client_email").notNull().default(""),
  clientCompany: text("client_company").notNull().default(""),
  clientPhone: text("client_phone").notNull().default(""),
  serviceAddress: text("service_address").notNull().default(""),
  // Public sharing
  publicToken: text("public_token").notNull().unique(),
  // Tracking
  sentAt: text("sent_at"),
  viewedAt: text("viewed_at"),
  signedAt: text("signed_at"),
  declinedAt: text("declined_at"),
  // Signature data
  signerName: text("signer_name").notNull().default(""),
  signerIp: text("signer_ip").notNull().default(""),
  signatureImage: text("signature_image").notNull().default(""),
  // Witness
  witnessEnabled: boolean("witness_enabled").notNull().default(false),
  witnessName: text("witness_name").notNull().default(""),
  witnessContact: text("witness_contact").notNull().default(""),
  witnessSignature: text("witness_signature").notNull().default(""),
  witnessSignedAt: text("witness_signed_at"),
  // Structured sections (JSON)
  sectionsData: json("sections_data"),
  // Provider signature
  providerName: text("provider_name").notNull().default(""),
  providerSignature: text("provider_signature").notNull().default(""),
  providerSignedAt: text("provider_signed_at"),
  // Internal
  internalNotes: text("internal_notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Agreement Activity Logs ───────────────────────────────────────────────────
export const agreementActivityLogs = pgTable("agreement_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agreementId: varchar("agreement_id").notNull(),
  companyId: varchar("company_id").notNull(),
  eventType: text("event_type").notNull(),
  eventData: text("event_data").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export const insertAgreementTemplateSchema = createInsertSchema(agreementTemplates).omit({ id: true });
export const insertAgreementSchema = createInsertSchema(agreements).omit({ id: true });
export const insertAgreementActivityLogSchema = createInsertSchema(agreementActivityLogs).omit({ id: true });
export type AgreementTemplate = typeof agreementTemplates.$inferSelect;
export type InsertAgreementTemplate = z.infer<typeof insertAgreementTemplateSchema>;
export type Agreement = typeof agreements.$inferSelect;
export type InsertAgreement = z.infer<typeof insertAgreementSchema>;
export type AgreementActivityLog = typeof agreementActivityLogs.$inferSelect;

// ── Quote Request Walkthroughs ─────────────────────────────────────────────────
export const quoteRequestWalkthroughs = pgTable("quote_request_walkthroughs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id"),
  companyId: varchar("company_id").notNull(),
  durationSeconds: integer("duration_seconds"),
  audioUrl: text("audio_url"),
  transcript: text("transcript"),
  aiTitle: text("ai_title"),
  aiSummary: text("ai_summary"),
  aiStatus: text("ai_status").notNull().default("not_started"),
  aiRaw: text("ai_raw"),
  photoCount: integer("photo_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const quoteRequestWalkthroughPhotos = pgTable("quote_request_walkthrough_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walkthroughId: varchar("walkthrough_id").notNull(),
  submissionId: varchar("submission_id"),
  companyId: varchar("company_id").notNull(),
  fileUrl: text("file_url").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  capturedAt: text("captured_at").notNull(),
  timestampSeconds: integer("timestamp_seconds"),
  aiLabel: text("ai_label"),
  aiDescription: text("ai_description"),
  adminLabel: text("admin_label"),
  adminDescription: text("admin_description"),
  createdAt: text("created_at").notNull(),
});

export const quoteRequestWalkthroughSections = pgTable("quote_request_walkthrough_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walkthroughId: varchar("walkthrough_id").notNull(),
  submissionId: varchar("submission_id"),
  companyId: varchar("company_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  orderIndex: integer("order_index").notNull().default(0),
  photoIds: text("photo_ids").notNull().default("[]"),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  adminEdited: boolean("admin_edited").notNull().default(false),
  adminNotes: text("admin_notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertQuoteRequestWalkthroughSchema = createInsertSchema(quoteRequestWalkthroughs).omit({ id: true });
export const insertQuoteRequestWalkthroughPhotoSchema = createInsertSchema(quoteRequestWalkthroughPhotos).omit({ id: true });
export const insertQuoteRequestWalkthroughSectionSchema = createInsertSchema(quoteRequestWalkthroughSections).omit({ id: true });
export type QuoteRequestWalkthrough = typeof quoteRequestWalkthroughs.$inferSelect;
export type InsertQuoteRequestWalkthrough = z.infer<typeof insertQuoteRequestWalkthroughSchema>;
export type QuoteRequestWalkthroughPhoto = typeof quoteRequestWalkthroughPhotos.$inferSelect;
export type InsertQuoteRequestWalkthroughPhoto = z.infer<typeof insertQuoteRequestWalkthroughPhotoSchema>;
export type QuoteRequestWalkthroughSection = typeof quoteRequestWalkthroughSections.$inferSelect;
export type InsertQuoteRequestWalkthroughSection = z.infer<typeof insertQuoteRequestWalkthroughSectionSchema>;

// ── Scheduled Field Notes Module ─────────────────────────────────────────────
export const scheduledFieldNoteTemplates = pgTable("scheduled_field_note_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  clientId: varchar("client_id"),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  templateType: text("template_type").notNull().default("commercial"),
  frequency: text("frequency").notNull().default("daily"),
  requiredBeforeClockOut: boolean("required_before_clock_out").notNull().default(true),
  introText: text("intro_text").notNull().default(""),
  outroText: text("outro_text").notNull().default(""),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const scheduledFieldNoteSections = pgTable("scheduled_field_note_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  companyId: varchar("company_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const scheduledFieldNoteSteps = pgTable("scheduled_field_note_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  sectionId: varchar("section_id").notNull(),
  companyId: varchar("company_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  areaCategory: text("area_category"),
  areaName: text("area_name"),
  itemType: text("item_type"),
  customAreaName: text("custom_area_name"),
  customItemType: text("custom_item_type"),
  referenceImageUrl: text("reference_image_url"),
  isRequired: boolean("is_required").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const scheduledFieldNoteAssignments = pgTable("scheduled_field_note_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  companyId: varchar("company_id").notNull(),
  cleanerId: varchar("cleaner_id").notNull(),
  clientId: varchar("client_id"),
  scheduleId: varchar("schedule_id"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
});

export const scheduledFieldNoteSubmissions = pgTable("scheduled_field_note_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  assignmentId: varchar("assignment_id").notNull(),
  companyId: varchar("company_id").notNull(),
  clientId: varchar("client_id"),
  cleanerId: varchar("cleaner_id").notNull(),
  clockInId: varchar("clock_in_id"),
  submissionDate: text("submission_date").notNull(),
  status: text("status").notNull().default("in_progress"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  totalSteps: integer("total_steps").notNull().default(0),
  completedSteps: integer("completed_steps").notNull().default(0),
  publicId: varchar("public_id").unique(),
  publicEnabled: boolean("public_enabled").notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const scheduledFieldNoteStepSubmissions = pgTable("scheduled_field_note_step_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull(),
  templateId: varchar("template_id").notNull(),
  sectionId: varchar("section_id").notNull(),
  stepId: varchar("step_id").notNull(),
  companyId: varchar("company_id").notNull(),
  cleanerId: varchar("cleaner_id").notNull(),
  submittedImageUrl: text("submitted_image_url").notNull(),
  submittedAt: text("submitted_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertScheduledFieldNoteTemplateSchema = createInsertSchema(scheduledFieldNoteTemplates).omit({ id: true });
export const insertScheduledFieldNoteSectionSchema = createInsertSchema(scheduledFieldNoteSections).omit({ id: true });
export const insertScheduledFieldNoteStepSchema = createInsertSchema(scheduledFieldNoteSteps).omit({ id: true });
export const insertScheduledFieldNoteAssignmentSchema = createInsertSchema(scheduledFieldNoteAssignments).omit({ id: true });
export const insertScheduledFieldNoteSubmissionSchema = createInsertSchema(scheduledFieldNoteSubmissions).omit({ id: true });
export const insertScheduledFieldNoteStepSubmissionSchema = createInsertSchema(scheduledFieldNoteStepSubmissions).omit({ id: true });

export type ScheduledFieldNoteTemplate = typeof scheduledFieldNoteTemplates.$inferSelect;
export type InsertScheduledFieldNoteTemplate = z.infer<typeof insertScheduledFieldNoteTemplateSchema>;
export type ScheduledFieldNoteSection = typeof scheduledFieldNoteSections.$inferSelect;
export type InsertScheduledFieldNoteSection = z.infer<typeof insertScheduledFieldNoteSectionSchema>;
export type ScheduledFieldNoteStep = typeof scheduledFieldNoteSteps.$inferSelect;
export type InsertScheduledFieldNoteStep = z.infer<typeof insertScheduledFieldNoteStepSchema>;
export type ScheduledFieldNoteAssignment = typeof scheduledFieldNoteAssignments.$inferSelect;
export type InsertScheduledFieldNoteAssignment = z.infer<typeof insertScheduledFieldNoteAssignmentSchema>;
export type ScheduledFieldNoteSubmission = typeof scheduledFieldNoteSubmissions.$inferSelect;
export type InsertScheduledFieldNoteSubmission = z.infer<typeof insertScheduledFieldNoteSubmissionSchema>;
export type ScheduledFieldNoteStepSubmission = typeof scheduledFieldNoteStepSubmissions.$inferSelect;
export type InsertScheduledFieldNoteStepSubmission = z.infer<typeof insertScheduledFieldNoteStepSubmissionSchema>;

// ── Hiring Packages ───────────────────────────────────────────────────────────
export const hiringPackages = pgTable("hiring_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  employeeName: text("employee_name").notNull().default(""),
  employeeEmail: text("employee_email").notNull().default(""),
  employeePhone: text("employee_phone").notNull().default(""),
  employeeAddress: text("employee_address").notNull().default(""),
  jobTitle: text("job_title").notNull().default(""),
  startDate: text("start_date").notNull().default(""),
  status: text("status").notNull().default("draft"),
  publicToken: text("public_token").notNull().unique(),
  templateData: json("template_data"),
  employeeResponse: json("employee_response"),
  policyAcceptances: json("policy_acceptances"),
  uploadedDocuments: json("uploaded_documents"),
  signatureData: text("signature_data").notNull().default(""),
  internalNotes: text("internal_notes").notNull().default(""),
  missingDocsMessage: text("missing_docs_message"),
  statusNote: text("status_note"),
  sentAt: text("sent_at"),
  viewedAt: text("viewed_at"),
  completedAt: text("completed_at"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertHiringPackageSchema = createInsertSchema(hiringPackages).omit({ id: true });
export type HiringPackage = typeof hiringPackages.$inferSelect;
export type InsertHiringPackage = z.infer<typeof insertHiringPackageSchema>;

// ── Employee Hiring (New Clean Implementation) ────────────────────────────────
export const employeeHiringTemplates = pgTable("employee_hiring_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  name: text("name").notNull().default("Default Template"),
  policies: json("policies"),
  bootReimbursementAmount: text("boot_reimbursement_amount").notNull().default("60.00"),
  requireDateOfBirth: boolean("require_date_of_birth").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const employeeHiringPackages = pgTable("employee_hiring_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  templateId: varchar("template_id"),
  employeeName: text("employee_name").notNull().default(""),
  employeeEmail: text("employee_email").notNull().default(""),
  position: text("position").notNull().default(""),
  publicToken: text("public_token").notNull().unique(),
  status: text("status").notNull().default("draft"),
  sentAt: text("sent_at"),
  expiresAt: text("expires_at"),
  createdBy: varchar("created_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const employeeHiringSubmissions = pgTable("employee_hiring_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  packageId: varchar("package_id").notNull(),
  publicToken: text("public_token").notNull(),
  currentStep: integer("current_step").notNull().default(1),
  status: text("status").notNull().default("started"),
  reviewStatus: text("review_status"),
  personalInfoJson: json("personal_info_json"),
  emergencyContactsJson: json("emergency_contacts_json"),
  medicalInfoJson: json("medical_info_json"),
  finalAcknowledgement: boolean("final_acknowledgement").notNull().default(false),
  signatureData: text("signature_data"),
  signatureUploadedAt: text("signature_uploaded_at"),
  submittedAt: text("submitted_at"),
  lastSavedAt: text("last_saved_at"),
  adminNotes: text("admin_notes"),
  missingDocsMessage: text("missing_docs_message"),
  requestedMissingDocs: json("requested_missing_docs"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const employeeHiringPolicyAcceptances = pgTable("employee_hiring_policy_acceptances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  submissionId: varchar("submission_id").notNull(),
  policyId: text("policy_id").notNull(),
  policyTitle: text("policy_title").notNull(),
  policyVersion: text("policy_version").notNull().default("1.0"),
  policyContentSnapshot: text("policy_content_snapshot").notNull(),
  acceptedAt: text("accepted_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull(),
});

export const employeeHiringDocuments = pgTable("employee_hiring_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  submissionId: varchar("submission_id").notNull(),
  documentType: text("document_type").notNull(),
  originalName: text("original_name").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull().default(""),
  fileSize: integer("file_size").notNull().default(0),
  fileData: text("file_data").notNull(),
  required: boolean("required").notNull().default(false),
  uploadedAt: text("uploaded_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertEmployeeHiringTemplateSchema = createInsertSchema(employeeHiringTemplates).omit({ id: true });
export type EmployeeHiringTemplate = typeof employeeHiringTemplates.$inferSelect;
export type InsertEmployeeHiringTemplate = z.infer<typeof insertEmployeeHiringTemplateSchema>;

export const insertEmployeeHiringPackageSchema = createInsertSchema(employeeHiringPackages).omit({ id: true });
export type EmployeeHiringPackage = typeof employeeHiringPackages.$inferSelect;
export type InsertEmployeeHiringPackage = z.infer<typeof insertEmployeeHiringPackageSchema>;

export const insertEmployeeHiringSubmissionSchema = createInsertSchema(employeeHiringSubmissions).omit({ id: true });
export type EmployeeHiringSubmission = typeof employeeHiringSubmissions.$inferSelect;
export type InsertEmployeeHiringSubmission = z.infer<typeof insertEmployeeHiringSubmissionSchema>;

export const insertEmployeeHiringPolicyAcceptanceSchema = createInsertSchema(employeeHiringPolicyAcceptances).omit({ id: true });
export type EmployeeHiringPolicyAcceptance = typeof employeeHiringPolicyAcceptances.$inferSelect;
export type InsertEmployeeHiringPolicyAcceptance = z.infer<typeof insertEmployeeHiringPolicyAcceptanceSchema>;

export const insertEmployeeHiringDocumentSchema = createInsertSchema(employeeHiringDocuments).omit({ id: true });
export type EmployeeHiringDocument = typeof employeeHiringDocuments.$inferSelect;
export type InsertEmployeeHiringDocument = z.infer<typeof insertEmployeeHiringDocumentSchema>;

// ── Training Hub ──────────────────────────────────────────────────────────────

export const trainingCourses = pgTable("training_courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  thumbnailData: text("thumbnail_data"),
  isRequired: boolean("is_required").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(false),
  publicLinkEnabled: boolean("public_link_enabled").notNull().default(false),
  publicId: text("public_id").unique(),
  certificateEnabled: boolean("certificate_enabled").notNull().default(true),
  estimatedDuration: text("estimated_duration"),
  createdBy: varchar("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const trainingModules = pgTable("training_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  companyId: varchar("company_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  youtubeUrl: text("youtube_url"),
  youtubeEmbedId: text("youtube_embed_id"),
  lessonText: text("lesson_text"),
  sortOrder: integer("sort_order").notNull().default(0),
  isRequired: boolean("is_required").notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const trainingModuleAssets = pgTable("training_module_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").notNull(),
  assetData: text("asset_data").notNull(),
  assetType: text("asset_type").notNull().default("image"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const trainingAssignments = pgTable("training_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  companyId: varchar("company_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  assignedBy: varchar("assigned_by").notNull(),
  dueDate: text("due_date"),
  status: text("status").notNull().default("assigned"),
  createdAt: text("created_at").notNull(),
  emailNotificationSentAt: text("email_notification_sent_at"),
  lastReminderEmailSentAt: text("last_reminder_email_sent_at"),
});

export const trainingProgress = pgTable("training_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  moduleId: varchar("module_id").notNull(),
  companyId: varchar("company_id").notNull(),
  employeeId: varchar("employee_id"),
  publicLearnerId: varchar("public_learner_id"),
  completedAt: text("completed_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const trainingPublicLearners = pgTable("training_public_learners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  companyId: varchar("company_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
});

export const trainingCertificates = pgTable("training_certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  companyId: varchar("company_id").notNull(),
  employeeId: varchar("employee_id"),
  publicLearnerId: varchar("public_learner_id"),
  learnerName: text("learner_name").notNull(),
  certificateCode: text("certificate_code").notNull().unique(),
  issuedAt: text("issued_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertTrainingCourseSchema = createInsertSchema(trainingCourses).omit({ id: true });
export type TrainingCourse = typeof trainingCourses.$inferSelect;
export type InsertTrainingCourse = z.infer<typeof insertTrainingCourseSchema>;

export const insertTrainingModuleSchema = createInsertSchema(trainingModules).omit({ id: true });
export type TrainingModule = typeof trainingModules.$inferSelect;
export type InsertTrainingModule = z.infer<typeof insertTrainingModuleSchema>;

export const insertTrainingModuleAssetSchema = createInsertSchema(trainingModuleAssets).omit({ id: true });
export type TrainingModuleAsset = typeof trainingModuleAssets.$inferSelect;
export type InsertTrainingModuleAsset = z.infer<typeof insertTrainingModuleAssetSchema>;

export const insertTrainingAssignmentSchema = createInsertSchema(trainingAssignments).omit({ id: true });
export type TrainingAssignment = typeof trainingAssignments.$inferSelect;
export type InsertTrainingAssignment = z.infer<typeof insertTrainingAssignmentSchema>;

export const insertTrainingProgressSchema = createInsertSchema(trainingProgress).omit({ id: true });
export type TrainingProgress = typeof trainingProgress.$inferSelect;
export type InsertTrainingProgress = z.infer<typeof insertTrainingProgressSchema>;

export const insertTrainingPublicLearnerSchema = createInsertSchema(trainingPublicLearners).omit({ id: true });
export type TrainingPublicLearner = typeof trainingPublicLearners.$inferSelect;
export type InsertTrainingPublicLearner = z.infer<typeof insertTrainingPublicLearnerSchema>;

export const insertTrainingCertificateSchema = createInsertSchema(trainingCertificates).omit({ id: true });
export type TrainingCertificate = typeof trainingCertificates.$inferSelect;
export type InsertTrainingCertificate = z.infer<typeof insertTrainingCertificateSchema>;

// ── Training Quizzes ──────────────────────────────────────────────────────────

export const trainingQuizzes = pgTable("training_quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().unique(),
  companyId: varchar("company_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  passingScore: integer("passing_score").notNull().default(80),
  allowRetake: boolean("allow_retake").notNull().default(true),
  showCorrectAnswers: boolean("show_correct_answers").notNull().default(false),
  isRequired: boolean("is_required").notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const trainingQuizQuestions = pgTable("training_quiz_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: varchar("quiz_id").notNull(),
  questionText: text("question_text").notNull(),
  questionType: text("question_type").notNull().default("multiple_choice"),
  optionsJson: text("options_json"),
  correctAnswerJson: text("correct_answer_json").notNull(),
  explanation: text("explanation"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const trainingQuizAttempts = pgTable("training_quiz_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: varchar("quiz_id").notNull(),
  courseId: varchar("course_id").notNull(),
  companyId: varchar("company_id").notNull(),
  employeeId: varchar("employee_id"),
  publicLearnerId: varchar("public_learner_id"),
  score: integer("score"),
  passed: boolean("passed").notNull().default(false),
  answersJson: text("answers_json"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
});

export const insertTrainingQuizSchema = createInsertSchema(trainingQuizzes).omit({ id: true });
export type TrainingQuiz = typeof trainingQuizzes.$inferSelect;
export type InsertTrainingQuiz = z.infer<typeof insertTrainingQuizSchema>;

export const insertTrainingQuizQuestionSchema = createInsertSchema(trainingQuizQuestions).omit({ id: true });
export type TrainingQuizQuestion = typeof trainingQuizQuestions.$inferSelect;
export type InsertTrainingQuizQuestion = z.infer<typeof insertTrainingQuizQuestionSchema>;

export const insertTrainingQuizAttemptSchema = createInsertSchema(trainingQuizAttempts).omit({ id: true });
export type TrainingQuizAttempt = typeof trainingQuizAttempts.$inferSelect;
export type InsertTrainingQuizAttempt = z.infer<typeof insertTrainingQuizAttemptSchema>;

// ── Training Lesson Blocks ───────────────────────────────────────────────────
// Multiple ordered content blocks per module. Backwards-compatible: old
// modules with only `lessonText` continue to render via fallback.
//
// type values:
//   "text"           — paragraph(s) in `content`
//   "image"          — single image (assetData), with optional caption
//   "gallery"        — multiple images stored as JSON in galleryJson
//   "safety_tip"     — highlighted safety/warning text in `content`
//   "checklist"      — JSON array of strings in checklistJson
//   "step_by_step"   — JSON array of {title, description} in stepsJson
//   "ai_explanation" — AI-generated explanation in `content`
//   "image_prompt"   — placeholder describing an image to upload (in imagePrompt)
// imageSize controls how an "image" block renders: small | medium | large | hero
export const trainingLessonBlocks = pgTable("training_lesson_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").notNull(),
  companyId: varchar("company_id").notNull(),
  type: text("type").notNull(),
  title: text("title"),
  content: text("content"),
  assetData: text("asset_data"),
  caption: text("caption"),
  imagePrompt: text("image_prompt"),
  imageSize: text("image_size"),
  galleryJson: text("gallery_json"),
  checklistJson: text("checklist_json"),
  stepsJson: text("steps_json"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertTrainingLessonBlockSchema = createInsertSchema(trainingLessonBlocks).omit({ id: true });
export type TrainingLessonBlock = typeof trainingLessonBlocks.$inferSelect;
export type InsertTrainingLessonBlock = z.infer<typeof insertTrainingLessonBlockSchema>;

// ── Training Module Audio Cache ──────────────────────────────────────────────
// Caches premium OpenAI TTS output per module. Keyed by (moduleId, contentHash).
// Regenerated when contentHash changes (i.e. module content edited).
export const trainingModuleAudio = pgTable("training_module_audio", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").notNull(),
  companyId: varchar("company_id").notNull(),
  contentHash: text("content_hash").notNull(),
  voice: text("voice").notNull().default("alloy"),
  format: text("format").notNull().default("mp3"),
  audioData: text("audio_data").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertTrainingModuleAudioSchema = createInsertSchema(trainingModuleAudio).omit({ id: true });
export type TrainingModuleAudio = typeof trainingModuleAudio.$inferSelect;
export type InsertTrainingModuleAudio = z.infer<typeof insertTrainingModuleAudioSchema>;

// ── Training Image Cache ─────────────────────────────────────────────────────
// Caches AI-generated images per (companyId, promptHash). Reused across blocks
// so admins regenerating with the same prompt do not pay twice.
export const trainingImageCache = pgTable("training_image_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  promptHash: text("prompt_hash").notNull(),
  prompt: text("prompt").notNull(),
  style: text("style"),
  imageData: text("image_data").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertTrainingImageCacheSchema = createInsertSchema(trainingImageCache).omit({ id: true });
export type TrainingImageCache = typeof trainingImageCache.$inferSelect;
export type InsertTrainingImageCache = z.infer<typeof insertTrainingImageCacheSchema>;

// ── Employee Documents ───────────────────────────────────────────────────────
// HR/profile documents (resume, ID, certifications, contracts, etc.)
// Files are stored as base64 in fileData (consistent with trainingModuleAssets).

export const employeeDocuments = pgTable("employee_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("other"),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  fileData: text("file_data").notNull(),
  notes: text("notes"),
  uploadedBy: varchar("uploaded_by").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
});

export const insertEmployeeDocumentSchema = createInsertSchema(employeeDocuments).omit({ id: true });
export type EmployeeDocument = typeof employeeDocuments.$inferSelect;
export type InsertEmployeeDocument = z.infer<typeof insertEmployeeDocumentSchema>;

// ── Jobsite Walk ─────────────────────────────────────────────────────────────
export const jobsiteWalks = pgTable("jobsite_walks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  clientId: varchar("client_id"),
  submissionId: varchar("submission_id"),
  title: text("title").notNull(),
  siteType: text("site_type").notNull().default("commercial"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  totalEstimatedSqft: text("total_estimated_sqft"),
  totalConfirmedSqft: text("total_confirmed_sqft"),
  summaryJson: text("summary_json"),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const jobsiteWalkPhotos = pgTable("jobsite_walk_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walkId: varchar("walk_id").notNull(),
  imageBase64: text("image_base64").notNull(),
  areaName: text("area_name"),
  notes: text("notes"),
  transcript: text("transcript"),
  aiAnalysisJson: text("ai_analysis_json"),
  createdAt: text("created_at").notNull(),
});

export const jobsiteWalkMeasurements = pgTable("jobsite_walk_measurements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoId: varchar("photo_id").notNull(),
  walkId: varchar("walk_id").notNull(),
  label: text("label").notNull(),
  measurementType: text("measurement_type").notNull().default("square_footage"),
  aiEstimatedValue: text("ai_estimated_value"),
  confirmedValue: text("confirmed_value"),
  unit: text("unit").notNull().default("sq ft"),
  confidenceScore: text("confidence_score"),
  status: text("status").notNull().default("ai_estimated"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const insertJobsiteWalkSchema = createInsertSchema(jobsiteWalks).omit({ id: true });
export const insertJobsiteWalkPhotoSchema = createInsertSchema(jobsiteWalkPhotos).omit({ id: true });
export const insertJobsiteWalkMeasurementSchema = createInsertSchema(jobsiteWalkMeasurements).omit({ id: true });
export type JobsiteWalk = typeof jobsiteWalks.$inferSelect;
export type InsertJobsiteWalk = z.infer<typeof insertJobsiteWalkSchema>;
export type JobsiteWalkPhoto = typeof jobsiteWalkPhotos.$inferSelect;
export type InsertJobsiteWalkPhoto = z.infer<typeof insertJobsiteWalkPhotoSchema>;
export type JobsiteWalkMeasurement = typeof jobsiteWalkMeasurements.$inferSelect;
export type InsertJobsiteWalkMeasurement = z.infer<typeof insertJobsiteWalkMeasurementSchema>;

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  clientId: varchar("client_id"),
  locationId: varchar("location_id"),
  bookingRequestId: varchar("booking_request_id"),
  title: text("title").notNull(),
  serviceType: text("service_type").notNull().default("General Service Request"),
  scheduledDate: text("scheduled_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  assignedEmployeeIds: text("assigned_employee_ids").array().notNull().default(sql`'{}'`),
  status: text("status").notNull().default("draft"),
  checklist: json("checklist").notNull().default(sql`'[]'`),
  requiredPhotoSections: json("required_photo_sections").notNull().default(sql`'[]'`),
  internalNotes: text("internal_notes"),
  clientNotes: text("client_notes"),
  accessInstructions: text("access_instructions"),
  priority: text("priority").notNull().default("normal"),
  fieldNoteId: varchar("field_note_id"),
  workReportId: varchar("work_report_id"),
  createdBy: varchar("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true });
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

// ─── Booking Requests ─────────────────────────────────────────────────────────
export const bookingRequests = pgTable("booking_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  clientId: varchar("client_id"),
  name: text("name").notNull(),
  companyName: text("company_name"),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  bestContactMethod: text("best_contact_method"),
  bestContactTime: text("best_contact_time"),
  serviceAddress: text("service_address").notNull(),
  unitOrSuite: text("unit_or_suite"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  accessInstructions: text("access_instructions"),
  parkingInstructions: text("parking_instructions"),
  entryInstructions: text("entry_instructions"),
  alarmInstructions: text("alarm_instructions"),
  serviceType: text("service_type").notNull(),
  customerType: text("customer_type").notNull().default("commercial"),
  preferredDate: text("preferred_date").notNull(),
  preferredTime: text("preferred_time").notNull(),
  alternateDate: text("alternate_date"),
  alternateTime: text("alternate_time"),
  frequency: text("frequency").notNull().default("one_time"),
  urgency: text("urgency").notNull().default("normal"),
  siteVisitPreference: text("site_visit_preference").default("no"),
  siteVisitDate: text("site_visit_date"),
  siteVisitTime: text("site_visit_time"),
  siteVisitContact: text("site_visit_contact"),
  commercialDetails: json("commercial_details"),
  residentialDetails: json("residential_details"),
  postConstructionDetails: json("post_construction_details"),
  moveInOutDetails: json("move_in_out_details"),
  uploadedPhotos: json("uploaded_photos"),
  uploadedFiles: json("uploaded_files"),
  notes: text("notes"),
  specialInstructions: text("special_instructions"),
  areasAttention: text("areas_attention"),
  areasAvoid: text("areas_avoid"),
  healthSafetyConcerns: text("health_safety_concerns"),
  clientExpectations: text("client_expectations"),
  consentGiven: boolean("consent_given").default(false),
  status: text("status").notNull().default("new"),
  estimateId: varchar("estimate_id"),
  quoteId: varchar("quote_id"),
  convertedJobId: varchar("converted_job_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const insertBookingRequestSchema = createInsertSchema(bookingRequests).omit({ id: true });
export type BookingRequest = typeof bookingRequests.$inferSelect;
export type InsertBookingRequest = z.infer<typeof insertBookingRequestSchema>;

// ─── Booking Estimates ────────────────────────────────────────────────────────
export const bookingEstimates = pgTable("booking_estimates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  bookingRequestId: varchar("booking_request_id").notNull(),
  inputSnapshot: json("input_snapshot"),
  estimatedHours: decimal("estimated_hours"),
  suggestedWorkerCount: integer("suggested_worker_count"),
  suggestedLowPrice: decimal("suggested_low_price"),
  suggestedHighPrice: decimal("suggested_high_price"),
  recommendedPrice: decimal("recommended_price"),
  minimumPriceWarning: boolean("minimum_price_warning").default(false),
  suggestedChecklist: json("suggested_checklist"),
  suggestedSupplies: json("suggested_supplies"),
  aiSummary: text("ai_summary"),
  adminFinalPrice: decimal("admin_final_price"),
  createdBy: varchar("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const insertBookingEstimateSchema = createInsertSchema(bookingEstimates).omit({ id: true });
export type BookingEstimate = typeof bookingEstimates.$inferSelect;
export type InsertBookingEstimate = z.infer<typeof insertBookingEstimateSchema>;

// ─── Booking Quotes ───────────────────────────────────────────────────────────
export const bookingQuotes = pgTable("booking_quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  bookingRequestId: varchar("booking_request_id").notNull(),
  clientId: varchar("client_id"),
  quoteNumber: varchar("quote_number").notNull(),
  title: text("title").notNull(),
  clientName: text("client_name").notNull(),
  companyName: text("company_name"),
  email: text("email").notNull(),
  phone: text("phone"),
  serviceAddress: text("service_address").notNull(),
  serviceType: text("service_type").notNull(),
  customerType: text("customer_type"),
  scopeOfWork: text("scope_of_work"),
  checklist: json("checklist"),
  frequency: text("frequency"),
  price: decimal("price").notNull(),
  taxes: decimal("taxes"),
  discount: decimal("discount"),
  deposit: decimal("deposit"),
  terms: text("terms"),
  includedItems: text("included_items"),
  excludedItems: text("excluded_items"),
  internalNotes: text("internal_notes"),
  publicLinkSlug: varchar("public_link_slug").notNull(),
  status: text("status").notNull().default("draft"),
  sentAt: text("sent_at"),
  viewedAt: text("viewed_at"),
  acceptedAt: text("accepted_at"),
  declinedAt: text("declined_at"),
  declineReason: text("decline_reason"),
  expiresAt: text("expires_at"),
  preferredDate: text("preferred_date"),
  preferredTime: text("preferred_time"),
  siteVisitNote: text("site_visit_note"),
  createdBy: varchar("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const insertBookingQuoteSchema = createInsertSchema(bookingQuotes).omit({ id: true });
export type BookingQuote = typeof bookingQuotes.$inferSelect;
export type InsertBookingQuote = z.infer<typeof insertBookingQuoteSchema>;
