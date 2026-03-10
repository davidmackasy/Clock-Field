import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePasswords, requireAuth, requireRole } from "./auth";
import passport from "passport";
import { randomBytes } from "crypto";

function generateTempPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
        loginEnabled: true,
        accountStatus: "active",
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        const { password: _, tempPin: __, ...safeUser } = user;
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
        const { password: _, tempPin: __, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/auth/employee-login", (req, res, next) => {
    passport.authenticate("employee-local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid Employee ID or PIN" });
      req.login(user, (err) => {
        if (err) return next(err);
        const { password: _, tempPin: __, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { currentPassword, newPassword } = req.body;
      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: "New password must be at least 4 characters" });
      }

      // Verify current password (skip check if mustChangePassword and using temp pin)
      if (!user.mustChangePassword) {
        const isValid = await comparePasswords(currentPassword, user.password);
        if (!isValid) return res.status(400).json({ message: "Current password is incorrect" });
      }

      const hashed = await hashPassword(newPassword);
      const updated = await storage.updateUser(user.id, {
        password: hashed,
        mustChangePassword: false,
        tempPin: null,
        accountStatus: "active",
      });
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password: _, tempPin: __, ...safeUser } = updated;
      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const { password: _, tempPin: __, ...safeUser } = req.user as any;
    res.json(safeUser);
  });

  // Employees
  app.get("/api/employees", requireRole("admin"), async (req, res) => {
    const user = req.user as any;
    const employees = await storage.getEmployeesByCompany(user.companyId);
    const safe = employees.map(({ password: _, tempPin: __, ...e }) => e);
    res.json(safe);
  });

  app.post("/api/employees", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { firstName, lastName, email, phone, hourlyRate, overtimeRate, position } = req.body;

      const employee = await storage.createUser({
        companyId: user.companyId,
        email: email || null,
        password: await hashPassword(randomBytes(16).toString("hex")),
        role: "employee",
        firstName,
        lastName,
        phone,
        hourlyRate,
        overtimeRate,
        position,
        loginEnabled: false,
        accountStatus: "profile_only",
        mustChangePassword: false,
      });
      const { password: _, tempPin: __, ...safe } = employee;
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
      const { password: _p, tempPin: _t, employeeId: _e, accountStatus: _a, loginEnabled: _l, mustChangePassword: _m, ...allowedFields } = req.body;
      const employee = await storage.updateUser(req.params.id, allowedFields);
      if (!employee) return res.status(404).json({ message: "Not found" });
      const { password: _, tempPin: __, ...safe } = employee;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Enable employee login access - generates Employee ID + temp PIN
  app.post("/api/employees/:id/enable-access", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getUser(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });

      let empId = target.employeeId;
      if (!empId) {
        // Retry up to 10 times in case of uniqueness conflicts across companies
        for (let attempt = 0; attempt < 10; attempt++) {
          const counter = await storage.incrementEmployeeIdCounter(user.companyId);
          const candidateId = `EMP-${counter}`;
          const existing = await storage.getUserByEmployeeId(candidateId);
          if (!existing) {
            empId = candidateId;
            break;
          }
        }
        if (!empId) return res.status(500).json({ message: "Could not generate unique Employee ID, please try again" });
      }

      const pin = generateTempPin();
      const hashedPin = await hashPassword(pin);

      const updated = await storage.updateUser(req.params.id, {
        employeeId: empId,
        password: hashedPin,
        tempPin: pin,
        loginEnabled: true,
        accountStatus: "pending_activation",
        mustChangePassword: true,
      });
      if (!updated) return res.status(404).json({ message: "Not found" });

      res.json({
        employeeId: empId,
        tempPin: pin,
        accountStatus: "pending_activation",
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Reset employee PIN
  app.post("/api/employees/:id/reset-pin", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getUser(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (!target.loginEnabled) return res.status(400).json({ message: "Login access not enabled for this employee" });

      const pin = generateTempPin();
      const hashedPin = await hashPassword(pin);

      await storage.updateUser(req.params.id, {
        password: hashedPin,
        tempPin: pin,
        mustChangePassword: true,
        accountStatus: "pending_activation",
      });

      res.json({ tempPin: pin });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Disable employee login access
  app.post("/api/employees/:id/disable-access", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getUser(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });

      const updated = await storage.updateUser(req.params.id, {
        loginEnabled: false,
        accountStatus: "disabled",
      });
      if (!updated) return res.status(404).json({ message: "Not found" });
      const { password: _, tempPin: __, ...safe } = updated;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Company ──────────────────────────────────────────────────────────────
  app.get("/api/company", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });
      res.json(company);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/company", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const updated = await storage.updateCompany(user.companyId, req.body);
      if (!updated) return res.status(404).json({ message: "Company not found" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Dashboard stats ───────────────────────────────────────────────────────
  app.get("/api/dashboard/stats", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const today = new Date().toISOString().split("T")[0];
      const [employees, todayShifts, allEntries, openRequests] = await Promise.all([
        storage.getEmployeesByCompany(user.companyId),
        storage.getShiftsByDate(user.companyId, today),
        storage.getTimeEntriesByCompany(user.companyId),
        storage.getClientRequestsByCompany(user.companyId),
      ]);
      const activeEntries = allEntries.filter(e => e.status === "active");
      const now = Date.now();
      const lateToday = todayShifts.filter(s => {
        const start = new Date(s.scheduledStartAt).getTime();
        const grace = (s.gracePeriodMinutes || 15) * 60000;
        return s.status === "scheduled" && now > start + grace;
      }).length;
      const missedToday = todayShifts.filter(s => s.status === "missed" || s.status === "no_show").length;
      const todayEntries = allEntries.filter(e => e.clockInAt.startsWith(today));
      const totalWorkedToday = todayEntries.reduce((sum, e) => sum + (e.workedMinutes || 0), 0);
      const openCount = openRequests.filter(r => ["new", "open", "in_review"].includes(r.status)).length;
      res.json({
        activeNow: activeEntries.length,
        lateToday,
        missedToday,
        totalEmployees: employees.length,
        openRequests: openCount,
        totalWorkedToday,
        todayShiftsCount: todayShifts.length,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Clients ───────────────────────────────────────────────────────────────
  app.get("/api/clients", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      res.json(await storage.getClientsByCompany(user.companyId));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/clients", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { name, contactName, contactEmail, contactPhone } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Company name is required" });
      const client = await storage.createClient({
        companyId: user.companyId,
        name: name.trim(),
        contactName: contactName?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
      });
      res.status(201).json(client);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/clients/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getClient(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateClient(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Locations ─────────────────────────────────────────────────────────────
  app.get("/api/locations", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      res.json(await storage.getLocationsByCompany(user.companyId));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/locations", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { name, address, clientId, notes } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Location name is required" });
      const location = await storage.createLocation({
        companyId: user.companyId,
        name: name.trim(),
        address: address?.trim() || null,
        clientId: clientId || null,
        notes: notes?.trim() || null,
      });
      res.status(201).json(location);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Shifts ────────────────────────────────────────────────────────────────
  // Admin: all shifts for company; Employee: own shifts
  app.get("/api/shifts", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role === "admin") {
        res.json(await storage.getShiftsByCompany(user.companyId));
      } else if (user.role === "employee") {
        res.json(await storage.getShiftsByEmployee(user.id));
      } else {
        res.status(403).json({ message: "Forbidden" });
      }
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/shifts/date/:date", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      res.json(await storage.getShiftsByDate(user.companyId, req.params.date));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/shifts", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { employeeId, clientId, locationId, shiftDate, scheduledStartAt, scheduledEndAt, expectedHours, gracePeriodMinutes, shiftNotes } = req.body;
      if (!employeeId || !shiftDate || !scheduledStartAt || !scheduledEndAt) {
        return res.status(400).json({ message: "Employee, date, start and end times are required" });
      }
      const shift = await storage.createShift({
        companyId: user.companyId,
        employeeId,
        clientId: clientId || null,
        locationId: locationId || null,
        shiftDate,
        scheduledStartAt,
        scheduledEndAt,
        expectedHours: expectedHours || null,
        gracePeriodMinutes: gracePeriodMinutes || 15,
        shiftNotes: shiftNotes || null,
        status: "scheduled",
        createdBy: user.id,
      });
      res.status(201).json(shift);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/shifts/:id", requireRole("admin"), async (req, res) => {
    try {
      const shift = await storage.getShift(req.params.id);
      const user = req.user as any;
      if (!shift || shift.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateShift(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/shifts/:id", requireRole("admin"), async (req, res) => {
    try {
      const shift = await storage.getShift(req.params.id);
      const user = req.user as any;
      if (!shift || shift.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.deleteShift(req.params.id);
      res.json({ message: "Deleted" });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Time Entries ──────────────────────────────────────────────────────────
  app.get("/api/time-entries", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role === "admin") {
        res.json(await storage.getTimeEntriesByCompany(user.companyId));
      } else if (user.role === "employee") {
        res.json(await storage.getTimeEntriesByEmployee(user.id));
      } else {
        res.status(403).json({ message: "Forbidden" });
      }
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/time-entries/active", requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const entry = await storage.getActiveTimeEntry(user.id);
      res.json(entry || null);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/time-entries/clock-in", requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const existing = await storage.getActiveTimeEntry(user.id);
      if (existing) return res.status(400).json({ message: "Already clocked in" });
      const { shiftId } = req.body;
      let shift = shiftId ? await storage.getShift(shiftId) : null;
      const now = new Date().toISOString();
      const flags: string[] = [];
      if (shift) {
        const scheduledStart = new Date(shift.scheduledStartAt).getTime();
        const grace = (shift.gracePeriodMinutes || 15) * 60000;
        if (Date.now() > scheduledStart + grace) flags.push("late_clock_in");
        if (Date.now() < scheduledStart - 5 * 60000) flags.push("early_clock_in");
        await storage.updateShift(shiftId!, { status: "in_progress" });
      } else {
        flags.push("unscheduled_clock_in");
      }
      const entry = await storage.createTimeEntry({
        companyId: user.companyId,
        employeeId: user.id,
        shiftId: shiftId || null,
        clientId: shift?.clientId || null,
        locationId: shift?.locationId || null,
        clockInAt: now,
        status: "active",
        flags: flags.length ? flags : null,
      });
      res.status(201).json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/time-entries/clock-out", requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const entry = await storage.getActiveTimeEntry(user.id);
      if (!entry) return res.status(400).json({ message: "Not clocked in" });
      const now = new Date().toISOString();
      const workedMinutes = Math.round((new Date(now).getTime() - new Date(entry.clockInAt).getTime()) / 60000);
      const flags = [...(entry.flags || [])];
      if (entry.shiftId) {
        const shift = await storage.getShift(entry.shiftId);
        if (shift) {
          const scheduledEnd = new Date(shift.scheduledEndAt).getTime();
          if (new Date(now).getTime() < scheduledEnd - 5 * 60000) flags.push("left_early");
          const expectedMins = parseFloat(shift.expectedHours || "0") * 60;
          if (workedMinutes > expectedMins + 30) flags.push("overtime");
          await storage.updateShift(entry.shiftId, { status: "completed" });
        }
      }
      const updated = await storage.updateTimeEntry(entry.id, {
        clockOutAt: now,
        workedMinutes,
        status: "completed",
        flags: flags.length ? flags : null,
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Client Requests ───────────────────────────────────────────────────────
  app.get("/api/client-requests", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role === "admin") {
        res.json(await storage.getClientRequestsByCompany(user.companyId));
      } else if (user.role === "client") {
        const clientRecord = await storage.getClientByUserId(user.id);
        if (!clientRecord) return res.json([]);
        res.json(await storage.getClientRequestsByClient(clientRecord.id));
      } else {
        res.status(403).json({ message: "Forbidden" });
      }
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/client-requests", requireRole("client"), async (req, res) => {
    try {
      const user = req.user as any;
      const clientRecord = await storage.getClientByUserId(user.id);
      if (!clientRecord) return res.status(400).json({ message: "Client profile not found" });
      const { title, description, requestType, priority } = req.body;
      if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
      const request = await storage.createClientRequest({
        companyId: user.companyId,
        clientId: clientRecord.id,
        title: title.trim(),
        description: description?.trim() || null,
        requestType: requestType || "service_request",
        priority: priority || "normal",
        status: "new",
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(request);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/client-requests/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getClientRequest(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateClientRequest(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  return httpServer;
}

