import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, requireAuth, requireRole } from "./auth";
import passport from "passport";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, companyName } = req.body;
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(400).json({ message: "Email already exists" });

      const company = await storage.createCompany({ name: companyName });
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        companyId: company.id,
        email,
        password: hashedPassword,
        role: "admin",
        firstName,
        lastName,
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        const { password: _, ...safeUser } = user;
        return res.json(safeUser);
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
      req.login(user, (err) => {
        if (err) return next(err);
        const { password: _, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const { password: _, ...safeUser } = req.user as any;
    res.json(safeUser);
  });

  // Employees
  app.get("/api/employees", requireRole("admin"), async (req, res) => {
    const user = req.user as any;
    const employees = await storage.getEmployeesByCompany(user.companyId);
    const safe = employees.map(({ password: _, ...e }) => e);
    res.json(safe);
  });

  app.post("/api/employees", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const hashedPassword = await hashPassword(req.body.password || "password123");
      const employee = await storage.createUser({
        ...req.body,
        companyId: user.companyId,
        role: "employee",
        password: hashedPassword,
      });
      const { password: _, ...safe } = employee;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/employees/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getUser(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const employee = await storage.updateUser(req.params.id, req.body);
      if (!employee) return res.status(404).json({ message: "Not found" });
      const { password: _, ...safe } = employee;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Clients
  app.get("/api/clients", requireAuth, async (req, res) => {
    const user = req.user as any;
    const result = await storage.getClientsByCompany(user.companyId);
    res.json(result);
  });

  app.post("/api/clients", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const clientData: any = { ...req.body, companyId: user.companyId };

      if (req.body.contactEmail) {
        const existingUser = await storage.getUserByEmail(req.body.contactEmail);
        if (!existingUser) {
          const hashedPassword = await hashPassword("client123");
          const clientUser = await storage.createUser({
            companyId: user.companyId,
            email: req.body.contactEmail,
            password: hashedPassword,
            role: "client",
            firstName: req.body.contactName?.split(" ")[0] || req.body.name,
            lastName: req.body.contactName?.split(" ").slice(1).join(" ") || "",
            phone: req.body.contactPhone,
          });
          clientData.userId = clientUser.id;
        }
      }

      const client = await storage.createClient(clientData);
      res.json(client);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/clients/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getClient(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const client = await storage.updateClient(req.params.id, req.body);
      if (!client) return res.status(404).json({ message: "Not found" });
      res.json(client);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Locations
  app.get("/api/locations", requireAuth, async (req, res) => {
    const user = req.user as any;
    const result = await storage.getLocationsByCompany(user.companyId);
    res.json(result);
  });

  app.post("/api/locations", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const location = await storage.createLocation({ ...req.body, companyId: user.companyId });
      res.json(location);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Shifts
  app.get("/api/shifts", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (user.role === "admin") {
      const result = await storage.getShiftsByCompany(user.companyId);
      res.json(result);
    } else {
      const result = await storage.getShiftsByEmployee(user.id);
      res.json(result);
    }
  });

  app.get("/api/shifts/date/:date", requireAuth, async (req, res) => {
    const user = req.user as any;
    const result = await storage.getShiftsByDate(user.companyId, req.params.date);
    res.json(result);
  });

  app.post("/api/shifts", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const shift = await storage.createShift({ ...req.body, companyId: user.companyId, createdBy: user.id });
      res.json(shift);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/shifts/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getShift(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const shift = await storage.updateShift(req.params.id, req.body);
      if (!shift) return res.status(404).json({ message: "Not found" });
      res.json(shift);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/shifts/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getShift(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.deleteShift(req.params.id);
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Time Entries
  app.get("/api/time-entries", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (user.role === "admin") {
      const result = await storage.getTimeEntriesByCompany(user.companyId);
      res.json(result);
    } else {
      const result = await storage.getTimeEntriesByEmployee(user.id);
      res.json(result);
    }
  });

  app.get("/api/time-entries/active", requireAuth, async (req, res) => {
    const user = req.user as any;
    const entry = await storage.getActiveTimeEntry(user.id);
    res.json(entry || null);
  });

  app.post("/api/time-entries/clock-in", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const active = await storage.getActiveTimeEntry(user.id);
      if (active) return res.status(400).json({ message: "Already clocked in" });

      const now = new Date().toISOString();
      const flags: string[] = [];

      let shiftId = req.body.shiftId || null;
      let clientId = req.body.clientId || null;
      let locationId = req.body.locationId || null;

      if (shiftId) {
        const shift = await storage.getShift(shiftId);
        if (!shift || shift.employeeId !== user.id || shift.companyId !== user.companyId) {
          return res.status(403).json({ message: "Shift not assigned to you" });
        }
        clientId = shift.clientId;
        locationId = shift.locationId;
        const scheduledStart = new Date(shift.scheduledStartAt);
        const clockIn = new Date(now);
        const gracePeriod = shift.gracePeriodMinutes * 60 * 1000;
        if (clockIn.getTime() > scheduledStart.getTime() + gracePeriod) {
          flags.push("late_clock_in");
        }
        if (clockIn.getTime() < scheduledStart.getTime() - 30 * 60 * 1000) {
          flags.push("early_clock_in");
        }
        await storage.updateShift(shiftId, { status: "in_progress" });
      } else {
        flags.push("unscheduled_clock_in");
      }

      const entry = await storage.createTimeEntry({
        companyId: user.companyId,
        employeeId: user.id,
        shiftId,
        clientId,
        locationId,
        clockInAt: now,
        status: "active",
        flags: flags.length > 0 ? flags : null,
      });

      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/time-entries/clock-out", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const active = await storage.getActiveTimeEntry(user.id);
      if (!active) return res.status(400).json({ message: "Not clocked in" });

      const now = new Date().toISOString();
      const clockIn = new Date(active.clockInAt);
      const clockOut = new Date(now);
      const totalMinutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);
      const workedMinutes = totalMinutes - (active.breakTotalMinutes || 0);

      const flags = [...(active.flags || [])];

      if (active.shiftId) {
        const shift = await storage.getShift(active.shiftId);
        if (shift) {
          const scheduledEnd = new Date(shift.scheduledEndAt);
          if (clockOut.getTime() < scheduledEnd.getTime() - 15 * 60 * 1000) {
            flags.push("left_early");
          }
          const expectedMin = parseFloat(shift.expectedHours || "0") * 60;
          if (expectedMin > 0 && workedMinutes > expectedMin * 1.1) {
            flags.push("overtime");
          }
          await storage.updateShift(active.shiftId, { status: "completed" });
        }
      }

      const entry = await storage.updateTimeEntry(active.id, {
        clockOutAt: now,
        workedMinutes,
        status: "completed",
        flags: flags.length > 0 ? flags : null,
      });

      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Client Requests
  app.get("/api/client-requests", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (user.role === "admin") {
      const result = await storage.getClientRequestsByCompany(user.companyId);
      res.json(result);
    } else if (user.role === "client") {
      const client = await storage.getClientByUserId(user.id);
      if (client) {
        const result = await storage.getClientRequestsByClient(client.id);
        res.json(result);
      } else {
        res.json([]);
      }
    } else {
      res.json([]);
    }
  });

  app.post("/api/client-requests", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      let clientId = req.body.clientId;

      if (user.role === "client") {
        const client = await storage.getClientByUserId(user.id);
        if (client) clientId = client.id;
      }

      const request = await storage.createClientRequest({
        ...req.body,
        clientId,
        companyId: user.companyId,
        createdAt: new Date().toISOString(),
      });
      res.json(request);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/client-requests/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getClientRequest(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const request = await storage.updateClientRequest(req.params.id, req.body);
      if (!request) return res.status(404).json({ message: "Not found" });
      res.json(request);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Company settings
  app.get("/api/company", requireAuth, async (req, res) => {
    const user = req.user as any;
    const company = await storage.getCompany(user.companyId);
    res.json(company);
  });

  app.patch("/api/company", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { db } = await import("./db");
      const { companies } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [company] = await db.update(companies).set(req.body).where(eq(companies.id, user.companyId)).returning();
      res.json(company);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Dashboard stats for admin
  app.get("/api/dashboard/stats", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const today = new Date().toISOString().split("T")[0];

      const allEntries = await storage.getTimeEntriesByCompany(user.companyId);
      const todayShifts = await storage.getShiftsByDate(user.companyId, today);
      const employees = await storage.getEmployeesByCompany(user.companyId);
      const requests = await storage.getClientRequestsByCompany(user.companyId);

      const activeNow = allEntries.filter(e => e.status === "active").length;
      const lateToday = allEntries.filter(e => e.flags?.includes("late_clock_in") && e.clockInAt.startsWith(today)).length;
      const missedToday = todayShifts.filter(s => s.status === "missed" || s.status === "no_show").length;
      const totalEmployees = employees.length;
      const openRequests = requests.filter(r => r.status === "new" || r.status === "open").length;

      const todayEntries = allEntries.filter(e => e.clockInAt.startsWith(today));
      let totalWorkedToday = 0;
      for (const e of todayEntries) {
        if (e.workedMinutes) totalWorkedToday += e.workedMinutes;
        else if (e.status === "active") {
          const elapsed = Math.round((Date.now() - new Date(e.clockInAt).getTime()) / 60000);
          totalWorkedToday += elapsed;
        }
      }

      res.json({
        activeNow,
        lateToday,
        missedToday,
        totalEmployees,
        openRequests,
        totalWorkedToday,
        todayShiftsCount: todayShifts.length,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
