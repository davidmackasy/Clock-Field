import { db } from "./db";
import { eq, and, desc, sql, inArray, or, isNull, gte } from "drizzle-orm";
import {
  companies, users, clients, locations, recurringSchedules, shifts, timeEntries, clientRequests, payrollDeductions,
  requestMessages, requestAttachments,
  timesheets,
  workSubmissions, workSubmissionItems, workSubmissionPhotos, workSubmissionReviews,
  platformMessages,
  payRuns, payStubs, payStubEarnings, payStubDeductions, payStubAuditLog,
  type Company, type InsertCompany,
  type User, type InsertUser,
  type Client, type InsertClient,
  type Location, type InsertLocation,
  type RecurringSchedule, type InsertRecurringSchedule,
  type Shift, type InsertShift,
  type TimeEntry, type InsertTimeEntry,
  type ClientRequest, type InsertClientRequest,
  type PayrollDeduction, type InsertPayrollDeduction,
  type RequestMessage, type InsertRequestMessage,
  type RequestAttachment, type InsertRequestAttachment,
  type Timesheet, type InsertTimesheet,
  type WorkSubmission, type InsertWorkSubmission,
  type WorkSubmissionItem, type InsertWorkSubmissionItem,
  type WorkSubmissionPhoto, type InsertWorkSubmissionPhoto,
  type WorkSubmissionReview, type InsertWorkSubmissionReview,
  type PlatformMessage, type InsertPlatformMessage,
  type PayRun, type InsertPayRun,
  type PayStub, type InsertPayStub,
  type PayStubEarning, type InsertPayStubEarning,
  type PayStubDeduction, type InsertPayStubDeduction,
  type PayStubAuditLog,
} from "@shared/schema";

export interface IStorage {
  createCompany(data: InsertCompany): Promise<Company>;
  getCompany(id: string): Promise<Company | undefined>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  incrementEmployeeIdCounter(companyId: string): Promise<number>;

  createUser(data: InsertUser): Promise<User>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmployeeId(employeeId: string): Promise<User | undefined>;
  getEmployeesByCompany(companyId: string): Promise<User[]>;
  getAdminsByCompany(companyId: string): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  createClient(data: InsertClient): Promise<Client>;
  getClient(id: string): Promise<Client | undefined>;
  getClientByUserId(userId: string): Promise<Client | undefined>;
  getClientsByCompany(companyId: string): Promise<Client[]>;
  updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined>;

  createLocation(data: InsertLocation): Promise<Location>;
  getLocation(id: string): Promise<Location | undefined>;
  getLocationsByCompany(companyId: string): Promise<Location[]>;
  updateLocation(id: string, data: Partial<InsertLocation>): Promise<Location | undefined>;

  createRecurringSchedule(data: InsertRecurringSchedule): Promise<RecurringSchedule>;
  getRecurringSchedule(id: string): Promise<RecurringSchedule | undefined>;
  getRecurringSchedulesByCompany(companyId: string): Promise<RecurringSchedule[]>;
  getRecurringSchedulesByEmployee(employeeId: string): Promise<RecurringSchedule[]>;
  updateRecurringSchedule(id: string, data: Partial<InsertRecurringSchedule>): Promise<RecurringSchedule | undefined>;
  deleteRecurringSchedule(id: string): Promise<void>;
  getShiftsByRecurringSchedule(recurringScheduleId: string): Promise<Shift[]>;

  createShift(data: InsertShift): Promise<Shift>;
  getShift(id: string): Promise<Shift | undefined>;
  getShiftsByCompany(companyId: string): Promise<Shift[]>;
  getShiftsByEmployee(employeeId: string): Promise<Shift[]>;
  getShiftsByDate(companyId: string, date: string): Promise<Shift[]>;
  updateShift(id: string, data: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: string): Promise<void>;

  createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry>;
  getTimeEntry(id: string): Promise<TimeEntry | undefined>;
  getActiveTimeEntry(employeeId: string): Promise<TimeEntry | undefined>;
  getTimeEntriesByCompany(companyId: string): Promise<TimeEntry[]>;
  getTimeEntriesByEmployee(employeeId: string): Promise<TimeEntry[]>;
  updateTimeEntry(id: string, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;

  createClientRequest(data: InsertClientRequest): Promise<ClientRequest>;
  getClientRequest(id: string): Promise<ClientRequest | undefined>;
  getClientRequestsByCompany(companyId: string): Promise<ClientRequest[]>;
  getClientRequestsByClient(clientId: string): Promise<ClientRequest[]>;
  getClientRequestsByEmployee(employeeId: string): Promise<ClientRequest[]>;
  updateClientRequest(id: string, data: Partial<InsertClientRequest>): Promise<ClientRequest | undefined>;

  createRequestMessage(data: InsertRequestMessage): Promise<RequestMessage>;
  getRequestMessage(id: string): Promise<RequestMessage | undefined>;
  getRequestMessages(requestId: string): Promise<RequestMessage[]>;
  createRequestAttachment(data: InsertRequestAttachment): Promise<RequestAttachment>;
  getRequestAttachment(id: string): Promise<RequestAttachment | undefined>;
  getRequestAttachmentsByMessage(messageId: string): Promise<RequestAttachment[]>;
  getRequestAttachmentsByMessageIds(messageIds: string[]): Promise<RequestAttachment[]>;

  createTimesheet(data: InsertTimesheet): Promise<Timesheet>;
  getTimesheet(id: string): Promise<Timesheet | undefined>;
  getTimesheetByEmployeeAndPeriod(employeeId: string, periodStart: string): Promise<Timesheet | undefined>;
  getTimesheetsByCompany(companyId: string): Promise<Timesheet[]>;
  getTimesheetsByEmployee(employeeId: string): Promise<Timesheet[]>;
  updateTimesheet(id: string, data: Partial<InsertTimesheet>): Promise<Timesheet | undefined>;

  getPayrollDeductionsByCompany(companyId: string): Promise<PayrollDeduction[]>;
  createPayrollDeduction(data: InsertPayrollDeduction): Promise<PayrollDeduction>;
  updatePayrollDeduction(id: string, data: Partial<InsertPayrollDeduction>): Promise<PayrollDeduction | undefined>;
  deletePayrollDeduction(id: string): Promise<void>;

  // Work Submissions
  createWorkSubmission(data: InsertWorkSubmission): Promise<WorkSubmission>;
  getWorkSubmission(id: string): Promise<WorkSubmission | undefined>;
  getWorkSubmissionsByEmployee(employeeId: string): Promise<WorkSubmission[]>;
  getWorkSubmissionsByCompany(companyId: string): Promise<WorkSubmission[]>;
  updateWorkSubmission(id: string, data: Partial<InsertWorkSubmission>): Promise<WorkSubmission | undefined>;
  deleteWorkSubmission(id: string): Promise<void>;
  generateWorkSubmissionShareToken(id: string): Promise<WorkSubmission | undefined>;
  getWorkSubmissionByToken(token: string): Promise<WorkSubmission | undefined>;

  createWorkSubmissionItem(data: InsertWorkSubmissionItem): Promise<WorkSubmissionItem>;
  getWorkSubmissionItem(id: string): Promise<WorkSubmissionItem | undefined>;
  getWorkSubmissionItems(submissionId: string): Promise<WorkSubmissionItem[]>;
  updateWorkSubmissionItem(id: string, data: Partial<InsertWorkSubmissionItem>): Promise<WorkSubmissionItem | undefined>;
  deleteWorkSubmissionItem(id: string): Promise<void>;

  createWorkSubmissionPhoto(data: InsertWorkSubmissionPhoto): Promise<WorkSubmissionPhoto>;
  getWorkSubmissionPhoto(id: string): Promise<WorkSubmissionPhoto | undefined>;
  getWorkSubmissionPhotosByItem(submissionItemId: string): Promise<WorkSubmissionPhoto[]>;
  getWorkSubmissionPhotosByItemIds(itemIds: string[]): Promise<WorkSubmissionPhoto[]>;
  deleteWorkSubmissionPhoto(id: string): Promise<void>;

  // Super Admin
  getAllCompanies(): Promise<Company[]>;
  getPlatformStats(): Promise<{
    totalBusinesses: number;
    activeBusinesses: number;
    suspendedBusinesses: number;
    pendingBusinesses: number;
    mrr: number;
    arr: number;
  }>;

  // Platform Messages
  createPlatformMessage(data: InsertPlatformMessage): Promise<PlatformMessage>;
  getPlatformMessagesByCompany(companyId: string): Promise<PlatformMessage[]>;
  getBroadcastMessages(): Promise<PlatformMessage[]>;
  getMessagesForCompany(companyId: string): Promise<PlatformMessage[]>;
  markPlatformMessageRead(id: string): Promise<void>;
  getAllPlatformMessages(): Promise<PlatformMessage[]>;
  getPlatformMessage(id: string): Promise<PlatformMessage | undefined>;

  // Pay Runs
  createPayRun(data: InsertPayRun): Promise<PayRun>;
  getPayRun(id: string): Promise<PayRun | undefined>;
  getPayRunsByCompany(companyId: string): Promise<PayRun[]>;
  updatePayRun(id: string, data: Partial<InsertPayRun>): Promise<PayRun | undefined>;
  deletePayRun(id: string): Promise<void>;

  // Pay Stubs
  createPayStub(data: InsertPayStub): Promise<PayStub>;
  getPayStub(id: string): Promise<PayStub | undefined>;
  getPayStubsByCompany(companyId: string): Promise<PayStub[]>;
  getPayStubsByPayRun(payRunId: string): Promise<PayStub[]>;
  getPayStubsByEmployee(employeeId: string, companyId: string): Promise<PayStub[]>;
  getPublishedPayStubsByEmployee(employeeId: string, companyId: string): Promise<PayStub[]>;
  updatePayStub(id: string, data: Partial<InsertPayStub>): Promise<PayStub | undefined>;
  deletePayStub(id: string): Promise<void>;

  // Pay Stub Earnings
  createPayStubEarning(data: InsertPayStubEarning): Promise<PayStubEarning>;
  getPayStubEarnings(payStubId: string): Promise<PayStubEarning[]>;
  updatePayStubEarning(id: string, data: Partial<InsertPayStubEarning>): Promise<PayStubEarning | undefined>;
  deletePayStubEarning(id: string): Promise<void>;
  deletePayStubEarningsByStub(payStubId: string): Promise<void>;

  // Pay Stub Deductions
  createPayStubDeduction(data: InsertPayStubDeduction): Promise<PayStubDeduction>;
  getPayStubDeductions(payStubId: string): Promise<PayStubDeduction[]>;
  updatePayStubDeduction(id: string, data: Partial<InsertPayStubDeduction>): Promise<PayStubDeduction | undefined>;
  deletePayStubDeduction(id: string): Promise<void>;
  deletePayStubDeductionsByStub(payStubId: string): Promise<void>;

  // Pay Stub Audit Log
  createPayStubAuditLog(data: Omit<PayStubAuditLog, "id">): Promise<PayStubAuditLog>;
  getPayStubAuditLog(payStubId: string): Promise<PayStubAuditLog[]>;

  // Work Submission Reviews
  createWorkSubmissionReview(data: InsertWorkSubmissionReview): Promise<WorkSubmissionReview>;
  getWorkSubmissionReviewBySubmissionId(submissionId: string): Promise<WorkSubmissionReview | undefined>;
  getWorkSubmissionReviewsByCompany(companyId: string): Promise<WorkSubmissionReview[]>;
  getSubmissionIdsWithReviews(companyId: string): Promise<Set<string>>;
}

export class DatabaseStorage implements IStorage {
  async createCompany(data: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(data).returning();
    return company;
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db.update(companies).set(data).where(eq(companies.id, id)).returning();
    return company;
  }

  async incrementEmployeeIdCounter(companyId: string): Promise<number> {
    const [updated] = await db
      .update(companies)
      .set({ employeeIdCounter: sql`${companies.employeeIdCounter} + 1` })
      .where(eq(companies.id, companyId))
      .returning({ counter: companies.employeeIdCounter });
    return updated.counter;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByEmployeeId(employeeId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.employeeId, employeeId));
    return user;
  }

  async getEmployeesByCompany(companyId: string): Promise<User[]> {
    return db.select().from(users).where(
      and(eq(users.companyId, companyId), eq(users.role, "employee"))
    );
  }

  async getAdminsByCompany(companyId: string): Promise<User[]> {
    return db.select().from(users).where(
      and(eq(users.companyId, companyId), eq(users.role, "admin"))
    );
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async createClient(data: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(data).returning();
    return client;
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByUserId(userId: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.userId, userId));
    return client;
  }

  async getClientsByCompany(companyId: string): Promise<Client[]> {
    return db.select().from(clients).where(eq(clients.companyId, companyId));
  }

  async updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
    return client;
  }

  async createLocation(data: InsertLocation): Promise<Location> {
    const [location] = await db.insert(locations).values(data).returning();
    return location;
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location;
  }

  async getLocationsByCompany(companyId: string): Promise<Location[]> {
    return db.select().from(locations).where(eq(locations.companyId, companyId));
  }

  async updateLocation(id: string, data: Partial<InsertLocation>): Promise<Location | undefined> {
    const [location] = await db.update(locations).set(data).where(eq(locations.id, id)).returning();
    return location;
  }

  async createRecurringSchedule(data: InsertRecurringSchedule): Promise<RecurringSchedule> {
    const [schedule] = await db.insert(recurringSchedules).values(data).returning();
    return schedule;
  }

  async getRecurringSchedule(id: string): Promise<RecurringSchedule | undefined> {
    const [schedule] = await db.select().from(recurringSchedules).where(eq(recurringSchedules.id, id));
    return schedule;
  }

  async getRecurringSchedulesByCompany(companyId: string): Promise<RecurringSchedule[]> {
    return db.select().from(recurringSchedules).where(eq(recurringSchedules.companyId, companyId));
  }

  async getRecurringSchedulesByEmployee(employeeId: string): Promise<RecurringSchedule[]> {
    return db.select().from(recurringSchedules).where(eq(recurringSchedules.employeeId, employeeId));
  }

  async updateRecurringSchedule(id: string, data: Partial<InsertRecurringSchedule>): Promise<RecurringSchedule | undefined> {
    const [schedule] = await db.update(recurringSchedules).set(data).where(eq(recurringSchedules.id, id)).returning();
    return schedule;
  }

  async deleteRecurringSchedule(id: string): Promise<void> {
    await db.delete(recurringSchedules).where(eq(recurringSchedules.id, id));
  }

  async getShiftsByRecurringSchedule(recurringScheduleId: string): Promise<Shift[]> {
    return db.select().from(shifts).where(eq(shifts.recurringScheduleId, recurringScheduleId));
  }

  async createShift(data: InsertShift): Promise<Shift> {
    const [shift] = await db.insert(shifts).values(data).returning();
    return shift;
  }

  async getShift(id: string): Promise<Shift | undefined> {
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, id));
    return shift;
  }

  async getShiftsByCompany(companyId: string): Promise<Shift[]> {
    return db.select().from(shifts).where(eq(shifts.companyId, companyId));
  }

  async getShiftsByEmployee(employeeId: string): Promise<Shift[]> {
    return db.select().from(shifts).where(eq(shifts.employeeId, employeeId));
  }

  async getShiftsByDate(companyId: string, date: string): Promise<Shift[]> {
    return db.select().from(shifts).where(
      and(eq(shifts.companyId, companyId), eq(shifts.shiftDate, date))
    );
  }

  async updateShift(id: string, data: Partial<InsertShift>): Promise<Shift | undefined> {
    const [shift] = await db.update(shifts).set(data).where(eq(shifts.id, id)).returning();
    return shift;
  }

  async deleteShift(id: string): Promise<void> {
    await db.delete(shifts).where(eq(shifts.id, id));
  }

  async createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry> {
    const [entry] = await db.insert(timeEntries).values(data).returning();
    return entry;
  }

  async getTimeEntry(id: string): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    return entry;
  }

  async getActiveTimeEntry(employeeId: string): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries).where(
      and(eq(timeEntries.employeeId, employeeId), eq(timeEntries.status, "active"))
    );
    return entry;
  }

  async getTimeEntriesByCompany(companyId: string): Promise<TimeEntry[]> {
    return db.select().from(timeEntries).where(eq(timeEntries.companyId, companyId));
  }

  async getTimeEntriesByEmployee(employeeId: string): Promise<TimeEntry[]> {
    return db.select().from(timeEntries).where(eq(timeEntries.employeeId, employeeId));
  }

  async updateTimeEntry(id: string, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const [entry] = await db.update(timeEntries).set(data).where(eq(timeEntries.id, id)).returning();
    return entry;
  }

  async createClientRequest(data: InsertClientRequest): Promise<ClientRequest> {
    const [request] = await db.insert(clientRequests).values(data).returning();
    return request;
  }

  async getClientRequest(id: string): Promise<ClientRequest | undefined> {
    const [request] = await db.select().from(clientRequests).where(eq(clientRequests.id, id));
    return request;
  }

  async getClientRequestsByCompany(companyId: string): Promise<ClientRequest[]> {
    return db.select().from(clientRequests).where(eq(clientRequests.companyId, companyId));
  }

  async getClientRequestsByClient(clientId: string): Promise<ClientRequest[]> {
    return db.select().from(clientRequests).where(eq(clientRequests.clientId, clientId));
  }

  async getClientRequestsByEmployee(employeeId: string): Promise<ClientRequest[]> {
    return db.select().from(clientRequests).where(eq(clientRequests.employeeId, employeeId));
  }

  async updateClientRequest(id: string, data: Partial<InsertClientRequest>): Promise<ClientRequest | undefined> {
    const [request] = await db.update(clientRequests).set(data).where(eq(clientRequests.id, id)).returning();
    return request;
  }

  async createRequestMessage(data: InsertRequestMessage): Promise<RequestMessage> {
    const [msg] = await db.insert(requestMessages).values(data).returning();
    return msg;
  }

  async getRequestMessage(id: string): Promise<RequestMessage | undefined> {
    const [msg] = await db.select().from(requestMessages).where(eq(requestMessages.id, id));
    return msg;
  }

  async getRequestMessages(requestId: string): Promise<RequestMessage[]> {
    return db.select().from(requestMessages)
      .where(eq(requestMessages.requestId, requestId))
      .orderBy(requestMessages.createdAt);
  }

  async createRequestAttachment(data: InsertRequestAttachment): Promise<RequestAttachment> {
    const [att] = await db.insert(requestAttachments).values(data).returning();
    return att;
  }

  async getRequestAttachmentsByMessage(messageId: string): Promise<RequestAttachment[]> {
    return db.select().from(requestAttachments).where(eq(requestAttachments.requestMessageId, messageId));
  }

  async getRequestAttachmentsByMessageIds(messageIds: string[]): Promise<RequestAttachment[]> {
    if (!messageIds.length) return [];
    const rows = await Promise.all(messageIds.map(id => this.getRequestAttachmentsByMessage(id)));
    return rows.flat();
  }

  async getRequestAttachment(id: string): Promise<RequestAttachment | undefined> {
    const [att] = await db.select().from(requestAttachments).where(eq(requestAttachments.id, id));
    return att;
  }

  async createTimesheet(data: InsertTimesheet): Promise<Timesheet> {
    const [row] = await db.insert(timesheets).values(data).returning();
    return row;
  }
  async getTimesheet(id: string): Promise<Timesheet | undefined> {
    const [row] = await db.select().from(timesheets).where(eq(timesheets.id, id));
    return row;
  }
  async getTimesheetByEmployeeAndPeriod(employeeId: string, periodStart: string): Promise<Timesheet | undefined> {
    const [row] = await db.select().from(timesheets).where(
      and(eq(timesheets.employeeId, employeeId), eq(timesheets.payPeriodStart, periodStart))
    );
    return row;
  }
  async getTimesheetsByCompany(companyId: string): Promise<Timesheet[]> {
    return db.select().from(timesheets).where(eq(timesheets.companyId, companyId)).orderBy(desc(timesheets.payPeriodStart));
  }
  async getTimesheetsByEmployee(employeeId: string): Promise<Timesheet[]> {
    return db.select().from(timesheets).where(eq(timesheets.employeeId, employeeId)).orderBy(desc(timesheets.payPeriodStart));
  }
  async updateTimesheet(id: string, data: Partial<InsertTimesheet>): Promise<Timesheet | undefined> {
    const [row] = await db.update(timesheets).set(data).where(eq(timesheets.id, id)).returning();
    return row;
  }

  async getPayrollDeductionsByCompany(companyId: string): Promise<PayrollDeduction[]> {
    return db.select().from(payrollDeductions).where(eq(payrollDeductions.companyId, companyId));
  }

  async createPayrollDeduction(data: InsertPayrollDeduction): Promise<PayrollDeduction> {
    const [deduction] = await db.insert(payrollDeductions).values(data).returning();
    return deduction;
  }

  async updatePayrollDeduction(id: string, data: Partial<InsertPayrollDeduction>): Promise<PayrollDeduction | undefined> {
    const [deduction] = await db.update(payrollDeductions).set(data).where(eq(payrollDeductions.id, id)).returning();
    return deduction;
  }

  async deletePayrollDeduction(id: string): Promise<void> {
    await db.delete(payrollDeductions).where(eq(payrollDeductions.id, id));
  }

  // ── Work Submissions ────────────────────────────────────────────────────────
  async createWorkSubmission(data: InsertWorkSubmission): Promise<WorkSubmission> {
    const [row] = await db.insert(workSubmissions).values(data).returning();
    return row;
  }
  async getWorkSubmission(id: string): Promise<WorkSubmission | undefined> {
    const [row] = await db.select().from(workSubmissions).where(eq(workSubmissions.id, id));
    return row;
  }
  async getWorkSubmissionsByEmployee(employeeId: string): Promise<WorkSubmission[]> {
    return db.select().from(workSubmissions).where(eq(workSubmissions.employeeId, employeeId)).orderBy(desc(workSubmissions.createdAt));
  }
  async getWorkSubmissionsByCompany(companyId: string): Promise<WorkSubmission[]> {
    return db.select().from(workSubmissions).where(eq(workSubmissions.companyId, companyId)).orderBy(desc(workSubmissions.createdAt));
  }
  async updateWorkSubmission(id: string, data: Partial<InsertWorkSubmission>): Promise<WorkSubmission | undefined> {
    const [row] = await db.update(workSubmissions).set(data).where(eq(workSubmissions.id, id)).returning();
    return row;
  }
  async deleteWorkSubmission(id: string): Promise<void> {
    await db.delete(workSubmissions).where(eq(workSubmissions.id, id));
  }
  async generateWorkSubmissionShareToken(id: string): Promise<WorkSubmission | undefined> {
    const { randomBytes } = await import("crypto");
    const token = randomBytes(32).toString("hex");
    const [row] = await db.update(workSubmissions)
      .set({ publicShareToken: token, publicShareEnabled: true })
      .where(eq(workSubmissions.id, id))
      .returning();
    return row;
  }
  async getWorkSubmissionByToken(token: string): Promise<WorkSubmission | undefined> {
    const [row] = await db.select().from(workSubmissions)
      .where(eq(workSubmissions.publicShareToken, token));
    return row;
  }

  async createWorkSubmissionItem(data: InsertWorkSubmissionItem): Promise<WorkSubmissionItem> {
    const [row] = await db.insert(workSubmissionItems).values(data).returning();
    return row;
  }
  async getWorkSubmissionItem(id: string): Promise<WorkSubmissionItem | undefined> {
    const [row] = await db.select().from(workSubmissionItems).where(eq(workSubmissionItems.id, id));
    return row;
  }
  async getWorkSubmissionItems(submissionId: string): Promise<WorkSubmissionItem[]> {
    return db.select().from(workSubmissionItems).where(eq(workSubmissionItems.submissionId, submissionId)).orderBy(workSubmissionItems.sortOrder);
  }
  async updateWorkSubmissionItem(id: string, data: Partial<InsertWorkSubmissionItem>): Promise<WorkSubmissionItem | undefined> {
    const [row] = await db.update(workSubmissionItems).set(data).where(eq(workSubmissionItems.id, id)).returning();
    return row;
  }
  async deleteWorkSubmissionItem(id: string): Promise<void> {
    await db.delete(workSubmissionItems).where(eq(workSubmissionItems.id, id));
  }

  async createWorkSubmissionPhoto(data: InsertWorkSubmissionPhoto): Promise<WorkSubmissionPhoto> {
    const [row] = await db.insert(workSubmissionPhotos).values(data).returning();
    return row;
  }
  async getWorkSubmissionPhoto(id: string): Promise<WorkSubmissionPhoto | undefined> {
    const [row] = await db.select().from(workSubmissionPhotos).where(eq(workSubmissionPhotos.id, id));
    return row;
  }
  async getWorkSubmissionPhotosByItem(submissionItemId: string): Promise<WorkSubmissionPhoto[]> {
    return db.select().from(workSubmissionPhotos).where(eq(workSubmissionPhotos.submissionItemId, submissionItemId));
  }
  async getWorkSubmissionPhotosByItemIds(itemIds: string[]): Promise<WorkSubmissionPhoto[]> {
    if (!itemIds.length) return [];
    return db.select().from(workSubmissionPhotos).where(inArray(workSubmissionPhotos.submissionItemId, itemIds));
  }
  async deleteWorkSubmissionPhoto(id: string): Promise<void> {
    await db.delete(workSubmissionPhotos).where(eq(workSubmissionPhotos.id, id));
  }

  // ── Super Admin ──────────────────────────────────────────────────────────────
  async getAllCompanies(): Promise<Company[]> {
    return db.select().from(companies).orderBy(companies.name);
  }

  async getPlatformStats(): Promise<{
    totalBusinesses: number;
    activeBusinesses: number;
    suspendedBusinesses: number;
    pendingBusinesses: number;
    mrr: number;
    arr: number;
  }> {
    const allCompanies = await db.select().from(companies);
    const totalBusinesses = allCompanies.length;
    const activeBusinesses = allCompanies.filter(c => c.accountStatus === "active").length;
    const suspendedBusinesses = allCompanies.filter(c => c.accountStatus === "suspended").length;
    const pendingBusinesses = allCompanies.filter(c => c.accountStatus === "pending_activation").length;

    const planPrices: Record<string, number> = {
      starter: 29,
      growth: 79,
      pro: 129,
      legacy: 0,
    };

    let mrr = 0;
    for (const c of allCompanies) {
      if (c.subscriptionStatus === "active" && c.planCode !== "legacy") {
        const monthly = planPrices[c.planCode] ?? 0;
        mrr += c.billingCycle === "yearly" ? Math.round(monthly * 12 * 0.9) / 12 : monthly;
      }
    }

    return {
      totalBusinesses,
      activeBusinesses,
      suspendedBusinesses,
      pendingBusinesses,
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
    };
  }

  // ── Platform Messages ────────────────────────────────────────────────────────
  async createPlatformMessage(data: InsertPlatformMessage): Promise<PlatformMessage> {
    const [msg] = await db.insert(platformMessages).values(data).returning();
    return msg;
  }

  async getPlatformMessagesByCompany(companyId: string): Promise<PlatformMessage[]> {
    return db.select().from(platformMessages)
      .where(eq(platformMessages.companyId, companyId))
      .orderBy(desc(platformMessages.createdAt));
  }

  async getBroadcastMessages(): Promise<PlatformMessage[]> {
    return db.select().from(platformMessages)
      .where(eq(platformMessages.isBroadcast, true))
      .orderBy(desc(platformMessages.createdAt));
  }

  async getMessagesForCompany(companyId: string): Promise<PlatformMessage[]> {
    // Look up the company's creation date so we can filter out broadcasts
    // that were sent before this company existed
    const [company] = await db.select({ createdAt: companies.createdAt })
      .from(companies)
      .where(eq(companies.id, companyId));
    const companyCreatedAt = company?.createdAt ?? null;

    const broadcastCondition = companyCreatedAt
      // New companies: only broadcasts created at or after this company signed up
      ? and(eq(platformMessages.isBroadcast, true), gte(platformMessages.createdAt, companyCreatedAt))
      // Legacy companies without a createdAt: include all broadcasts (backward compatible)
      : eq(platformMessages.isBroadcast, true);

    return db.select().from(platformMessages)
      .where(
        or(
          eq(platformMessages.companyId, companyId),
          broadcastCondition
        )
      )
      .orderBy(desc(platformMessages.createdAt));
  }

  async markPlatformMessageRead(id: string): Promise<void> {
    await db.update(platformMessages).set({ isRead: true }).where(eq(platformMessages.id, id));
  }

  async getAllPlatformMessages(): Promise<PlatformMessage[]> {
    return db.select().from(platformMessages).orderBy(desc(platformMessages.createdAt));
  }

  async getPlatformMessage(id: string): Promise<PlatformMessage | undefined> {
    const [msg] = await db.select().from(platformMessages).where(eq(platformMessages.id, id));
    return msg;
  }

  // ── Pay Runs ─────────────────────────────────────────────────────────────────
  async createPayRun(data: InsertPayRun): Promise<PayRun> {
    const [run] = await db.insert(payRuns).values(data).returning();
    return run;
  }

  async getPayRun(id: string): Promise<PayRun | undefined> {
    const [run] = await db.select().from(payRuns).where(eq(payRuns.id, id));
    return run;
  }

  async getPayRunsByCompany(companyId: string): Promise<PayRun[]> {
    return db.select().from(payRuns).where(eq(payRuns.companyId, companyId)).orderBy(desc(payRuns.periodStart));
  }

  async updatePayRun(id: string, data: Partial<InsertPayRun>): Promise<PayRun | undefined> {
    const [run] = await db.update(payRuns).set(data).where(eq(payRuns.id, id)).returning();
    return run;
  }

  async deletePayRun(id: string): Promise<void> {
    await db.delete(payRuns).where(eq(payRuns.id, id));
  }

  // ── Pay Stubs ─────────────────────────────────────────────────────────────────
  async createPayStub(data: InsertPayStub): Promise<PayStub> {
    const [stub] = await db.insert(payStubs).values(data).returning();
    return stub;
  }

  async getPayStub(id: string): Promise<PayStub | undefined> {
    const [stub] = await db.select().from(payStubs).where(eq(payStubs.id, id));
    return stub;
  }

  async getPayStubsByCompany(companyId: string): Promise<PayStub[]> {
    return db.select().from(payStubs).where(eq(payStubs.companyId, companyId)).orderBy(desc(payStubs.createdAt));
  }

  async getPayStubsByPayRun(payRunId: string): Promise<PayStub[]> {
    return db.select().from(payStubs).where(eq(payStubs.payRunId, payRunId)).orderBy(desc(payStubs.createdAt));
  }

  async getPayStubsByEmployee(employeeId: string, companyId: string): Promise<PayStub[]> {
    return db.select().from(payStubs)
      .where(and(eq(payStubs.employeeId, employeeId), eq(payStubs.companyId, companyId)))
      .orderBy(desc(payStubs.periodStart));
  }

  async getPublishedPayStubsByEmployee(employeeId: string, companyId: string): Promise<PayStub[]> {
    return db.select().from(payStubs)
      .where(and(
        eq(payStubs.employeeId, employeeId),
        eq(payStubs.companyId, companyId),
        sql`${payStubs.status} IN ('confirmed_paid', 'published')`,
        sql`${payStubs.employeeVisibleAt} IS NOT NULL`
      ))
      .orderBy(desc(payStubs.periodStart));
  }

  async updatePayStub(id: string, data: Partial<InsertPayStub>): Promise<PayStub | undefined> {
    const [stub] = await db.update(payStubs).set(data).where(eq(payStubs.id, id)).returning();
    return stub;
  }

  async deletePayStub(id: string): Promise<void> {
    await db.delete(payStubs).where(eq(payStubs.id, id));
  }

  // ── Pay Stub Earnings ─────────────────────────────────────────────────────────
  async createPayStubEarning(data: InsertPayStubEarning): Promise<PayStubEarning> {
    const [earning] = await db.insert(payStubEarnings).values(data).returning();
    return earning;
  }

  async getPayStubEarnings(payStubId: string): Promise<PayStubEarning[]> {
    return db.select().from(payStubEarnings).where(eq(payStubEarnings.payStubId, payStubId)).orderBy(payStubEarnings.displayOrder);
  }

  async updatePayStubEarning(id: string, data: Partial<InsertPayStubEarning>): Promise<PayStubEarning | undefined> {
    const [earning] = await db.update(payStubEarnings).set(data).where(eq(payStubEarnings.id, id)).returning();
    return earning;
  }

  async deletePayStubEarning(id: string): Promise<void> {
    await db.delete(payStubEarnings).where(eq(payStubEarnings.id, id));
  }

  async deletePayStubEarningsByStub(payStubId: string): Promise<void> {
    await db.delete(payStubEarnings).where(eq(payStubEarnings.payStubId, payStubId));
  }

  // ── Pay Stub Deductions ───────────────────────────────────────────────────────
  async createPayStubDeduction(data: InsertPayStubDeduction): Promise<PayStubDeduction> {
    const [deduction] = await db.insert(payStubDeductions).values(data).returning();
    return deduction;
  }

  async getPayStubDeductions(payStubId: string): Promise<PayStubDeduction[]> {
    return db.select().from(payStubDeductions).where(eq(payStubDeductions.payStubId, payStubId)).orderBy(payStubDeductions.displayOrder);
  }

  async updatePayStubDeduction(id: string, data: Partial<InsertPayStubDeduction>): Promise<PayStubDeduction | undefined> {
    const [deduction] = await db.update(payStubDeductions).set(data).where(eq(payStubDeductions.id, id)).returning();
    return deduction;
  }

  async deletePayStubDeduction(id: string): Promise<void> {
    await db.delete(payStubDeductions).where(eq(payStubDeductions.id, id));
  }

  async deletePayStubDeductionsByStub(payStubId: string): Promise<void> {
    await db.delete(payStubDeductions).where(eq(payStubDeductions.payStubId, payStubId));
  }

  // ── Pay Stub Audit Log ────────────────────────────────────────────────────────
  async createPayStubAuditLog(data: Omit<PayStubAuditLog, "id">): Promise<PayStubAuditLog> {
    const [entry] = await db.insert(payStubAuditLog).values(data).returning();
    return entry;
  }

  async getPayStubAuditLog(payStubId: string): Promise<PayStubAuditLog[]> {
    return db.select().from(payStubAuditLog)
      .where(eq(payStubAuditLog.payStubId, payStubId))
      .orderBy(desc(payStubAuditLog.createdAt));
  }

  // ── Work Submission Reviews ────────────────────────────────────────────────────
  async createWorkSubmissionReview(data: InsertWorkSubmissionReview): Promise<WorkSubmissionReview> {
    const withToken = { ...data, reviewShareToken: crypto.randomUUID() };
    const [review] = await db.insert(workSubmissionReviews).values(withToken).returning();
    return review;
  }

  async getWorkSubmissionReviewBySubmissionId(submissionId: string): Promise<WorkSubmissionReview | undefined> {
    const [review] = await db.select().from(workSubmissionReviews)
      .where(eq(workSubmissionReviews.submissionId, submissionId))
      .orderBy(desc(workSubmissionReviews.createdAt))
      .limit(1);
    return review;
  }

  async getWorkSubmissionReviewByShareToken(reviewShareToken: string): Promise<WorkSubmissionReview | undefined> {
    const [review] = await db.select().from(workSubmissionReviews)
      .where(eq(workSubmissionReviews.reviewShareToken, reviewShareToken))
      .limit(1);
    return review;
  }

  async getWorkSubmissionReviewsByCompany(companyId: string): Promise<WorkSubmissionReview[]> {
    return db.select().from(workSubmissionReviews)
      .where(eq(workSubmissionReviews.companyId, companyId))
      .orderBy(desc(workSubmissionReviews.createdAt));
  }

  async getSubmissionIdsWithReviews(companyId: string): Promise<Set<string>> {
    const rows = await db.select({ submissionId: workSubmissionReviews.submissionId })
      .from(workSubmissionReviews)
      .where(eq(workSubmissionReviews.companyId, companyId));
    return new Set(rows.map(r => r.submissionId));
  }
}

export const storage = new DatabaseStorage();
