import { storage } from "./storage";
import { hashPassword } from "./auth";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) return;

  console.log("Seeding database...");

  const company = await storage.createCompany({
    name: "Sparkle Clean Services",
    timezone: "America/New_York",
    defaultGracePeriodMinutes: 15,
    allowUnscheduledClockIns: true,
    requireReports: false,
    requireBeforePhotos: false,
    requireAfterPhotos: false,
    overtimeEnabled: true,
    overtimeThresholdWeekly: 40,
    defaultPayPeriodType: "biweekly",
  });

  const adminPassword = await hashPassword("admin123");
  await storage.createUser({
    companyId: company.id,
    email: "admin@sparkle.com",
    password: adminPassword,
    role: "admin",
    firstName: "Sarah",
    lastName: "Johnson",
    phone: "(555) 100-0001",
  });

  const empPassword = await hashPassword("employee123");

  const emp1 = await storage.createUser({
    companyId: company.id,
    email: "maria@sparkle.com",
    password: empPassword,
    role: "employee",
    firstName: "Maria",
    lastName: "Garcia",
    phone: "(555) 200-0001",
    hourlyRate: "18.50",
  });

  const emp2 = await storage.createUser({
    companyId: company.id,
    email: "james@sparkle.com",
    password: empPassword,
    role: "employee",
    firstName: "James",
    lastName: "Williams",
    phone: "(555) 200-0002",
    hourlyRate: "20.00",
  });

  const emp3 = await storage.createUser({
    companyId: company.id,
    email: "lisa@sparkle.com",
    password: empPassword,
    role: "employee",
    firstName: "Lisa",
    lastName: "Chen",
    phone: "(555) 200-0003",
    hourlyRate: "17.00",
  });

  const clientPassword = await hashPassword("client123");

  const clientUser1 = await storage.createUser({
    companyId: company.id,
    email: "tom@riverside.com",
    password: clientPassword,
    role: "client",
    firstName: "Tom",
    lastName: "Bradley",
    phone: "(555) 300-0001",
  });

  const clientUser2 = await storage.createUser({
    companyId: company.id,
    email: "jennifer@mapleheights.com",
    password: clientPassword,
    role: "client",
    firstName: "Jennifer",
    lastName: "Park",
    phone: "(555) 300-0002",
  });

  const clientUser3 = await storage.createUser({
    companyId: company.id,
    email: "rkim@dtmedical.com",
    password: clientPassword,
    role: "client",
    firstName: "Robert",
    lastName: "Kim",
    phone: "(555) 300-0003",
  });

  const client1 = await storage.createClient({
    companyId: company.id,
    userId: clientUser1.id,
    name: "Riverside Office Park",
    contactName: "Tom Bradley",
    contactEmail: "tom@riverside.com",
    contactPhone: "(555) 300-0001",
  });

  const client2 = await storage.createClient({
    companyId: company.id,
    userId: clientUser2.id,
    name: "Maple Heights Condos",
    contactName: "Jennifer Park",
    contactEmail: "jennifer@mapleheights.com",
    contactPhone: "(555) 300-0002",
  });

  const client3 = await storage.createClient({
    companyId: company.id,
    userId: clientUser3.id,
    name: "Downtown Medical Center",
    contactName: "Dr. Robert Kim",
    contactEmail: "rkim@dtmedical.com",
    contactPhone: "(555) 300-0003",
  });

  const loc1 = await storage.createLocation({
    companyId: company.id,
    clientId: client1.id,
    name: "Riverside Building A",
    address: "100 River Road, Suite 200",
  });

  const loc2 = await storage.createLocation({
    companyId: company.id,
    clientId: client1.id,
    name: "Riverside Building B",
    address: "120 River Road, Suite 100",
  });

  const loc3 = await storage.createLocation({
    companyId: company.id,
    clientId: client2.id,
    name: "Maple Heights Lobby & Common Areas",
    address: "45 Maple Avenue",
  });

  const loc4 = await storage.createLocation({
    companyId: company.id,
    clientId: client3.id,
    name: "Medical Center Main Floor",
    address: "500 Health Blvd",
  });

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterStr = dayAfter.toISOString().split("T")[0];

  await storage.createShift({
    companyId: company.id,
    employeeId: emp1.id,
    clientId: client1.id,
    locationId: loc1.id,
    shiftDate: todayStr,
    scheduledStartAt: `${todayStr}T08:00:00`,
    scheduledEndAt: `${todayStr}T12:00:00`,
    expectedHours: "4.00",
    gracePeriodMinutes: 15,
    shiftNotes: "Regular morning clean - offices and conference rooms",
    status: "scheduled",
  });

  await storage.createShift({
    companyId: company.id,
    employeeId: emp2.id,
    clientId: client2.id,
    locationId: loc3.id,
    shiftDate: todayStr,
    scheduledStartAt: `${todayStr}T09:00:00`,
    scheduledEndAt: `${todayStr}T14:00:00`,
    expectedHours: "5.00",
    gracePeriodMinutes: 15,
    shiftNotes: "Deep clean lobby and hallways",
    status: "scheduled",
  });

  await storage.createShift({
    companyId: company.id,
    employeeId: emp3.id,
    clientId: client3.id,
    locationId: loc4.id,
    shiftDate: todayStr,
    scheduledStartAt: `${todayStr}T18:00:00`,
    scheduledEndAt: `${todayStr}T22:00:00`,
    expectedHours: "4.00",
    gracePeriodMinutes: 15,
    shiftNotes: "Evening sanitization - medical center",
    status: "scheduled",
  });

  await storage.createShift({
    companyId: company.id,
    employeeId: emp1.id,
    clientId: client3.id,
    locationId: loc4.id,
    shiftDate: tomorrowStr,
    scheduledStartAt: `${tomorrowStr}T07:00:00`,
    scheduledEndAt: `${tomorrowStr}T11:00:00`,
    expectedHours: "4.00",
    gracePeriodMinutes: 15,
    shiftNotes: "Morning clean medical center",
    status: "scheduled",
  });

  await storage.createShift({
    companyId: company.id,
    employeeId: emp2.id,
    clientId: client1.id,
    locationId: loc2.id,
    shiftDate: tomorrowStr,
    scheduledStartAt: `${tomorrowStr}T13:00:00`,
    scheduledEndAt: `${tomorrowStr}T17:00:00`,
    expectedHours: "4.00",
    gracePeriodMinutes: 15,
    status: "scheduled",
  });

  await storage.createShift({
    companyId: company.id,
    employeeId: emp3.id,
    clientId: client2.id,
    locationId: loc3.id,
    shiftDate: dayAfterStr,
    scheduledStartAt: `${dayAfterStr}T10:00:00`,
    scheduledEndAt: `${dayAfterStr}T15:00:00`,
    expectedHours: "5.00",
    gracePeriodMinutes: 15,
    status: "scheduled",
  });

  await storage.createClientRequest({
    companyId: company.id,
    clientId: client1.id,
    locationId: loc1.id,
    requestType: "service_request",
    title: "Extra cleaning for board meeting",
    description: "We have an important board meeting next Friday. Please schedule an additional deep clean of the main conference room on Thursday evening.",
    priority: "high",
    status: "new",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  });

  await storage.createClientRequest({
    companyId: company.id,
    clientId: client2.id,
    requestType: "complaint",
    title: "Trash not collected in east wing",
    description: "The trash bins in the east wing hallway on the 3rd floor were not emptied during the last two visits.",
    priority: "normal",
    status: "open",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  });

  await storage.createClientRequest({
    companyId: company.id,
    clientId: client3.id,
    locationId: loc4.id,
    requestType: "special_task",
    title: "Floor waxing requested",
    description: "We need the main floor area waxed and polished. Can this be scheduled for this weekend?",
    priority: "normal",
    status: "new",
    createdAt: new Date().toISOString(),
  });

  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const clockInTime = `${yesterdayStr}T08:05:00`;
  const clockOutTime = `${yesterdayStr}T12:10:00`;
  const workedMins = Math.round((new Date(clockOutTime).getTime() - new Date(clockInTime).getTime()) / 60000);

  await storage.createTimeEntry({
    companyId: company.id,
    employeeId: emp1.id,
    clockInAt: clockInTime,
    clockOutAt: clockOutTime,
    workedMinutes: workedMins,
    status: "completed",
    flags: null,
  });

  const clockInTime2 = `${yesterdayStr}T09:25:00`;
  const clockOutTime2 = `${yesterdayStr}T14:00:00`;
  const workedMins2 = Math.round((new Date(clockOutTime2).getTime() - new Date(clockInTime2).getTime()) / 60000);

  await storage.createTimeEntry({
    companyId: company.id,
    employeeId: emp2.id,
    clockInAt: clockInTime2,
    clockOutAt: clockOutTime2,
    workedMinutes: workedMins2,
    status: "completed",
    flags: ["late_clock_in"],
  });

  console.log("Seed complete!");
  console.log("Admin login: admin@sparkle.com / admin123");
  console.log("Employee login: maria@sparkle.com / employee123");
  console.log("Client login: tom@riverside.com / client123");
}
