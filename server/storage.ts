import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  companies, users, clients, locations, recurringSchedules, shifts, timeEntries, clientRequests,
  type Company, type InsertCompany,
  type User, type InsertUser,
  type Client, type InsertClient,
  type Location, type InsertLocation,
  type RecurringSchedule, type InsertRecurringSchedule,
  type Shift, type InsertShift,
  type TimeEntry, type InsertTimeEntry,
  type ClientRequest, type InsertClientRequest,
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
  updateClientRequest(id: string, data: Partial<InsertClientRequest>): Promise<ClientRequest | undefined>;
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

  async updateClientRequest(id: string, data: Partial<InsertClientRequest>): Promise<ClientRequest | undefined> {
    const [request] = await db.update(clientRequests).set(data).where(eq(clientRequests.id, id)).returning();
    return request;
  }
}

export const storage = new DatabaseStorage();
