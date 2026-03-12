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

  // ── Admin Management ─────────────────────────────────────────────────────
  app.get("/api/admins", requireRole("admin"), async (req, res) => {
    const user = req.user as any;
    const admins = await storage.getAdminsByCompany(user.companyId);
    const safe = admins.map(({ password: _, tempPin: __, ...a }) => a);
    res.json(safe);
  });

  app.post("/api/admins/invite", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { firstName, lastName, email, phone, tempPin: customPin } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      if (!firstName || !lastName) return res.status(400).json({ message: "Full name is required" });

      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(400).json({ message: "A user with this email already exists" });

      const pin = customPin && customPin.length >= 4 ? customPin : generateTempPin();
      const hashedPin = await hashPassword(pin);

      const admin = await storage.createUser({
        companyId: user.companyId,
        email,
        password: hashedPin,
        role: "admin",
        firstName,
        lastName,
        phone: phone || null,
        loginEnabled: true,
        accountStatus: "pending_activation",
        mustChangePassword: true,
        tempPin: pin,
        createdAt: new Date().toISOString(),
      });

      const { password: _, tempPin: __, ...safe } = admin;
      res.json({ ...safe, tempPin: pin });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admins/:id/reset-pin", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getUser(req.params.id);
      if (!target || target.companyId !== user.companyId || target.role !== "admin") {
        return res.status(404).json({ message: "Not found" });
      }

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

  app.patch("/api/admins/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getUser(req.params.id);
      if (!target || target.companyId !== user.companyId || target.role !== "admin") {
        return res.status(404).json({ message: "Not found" });
      }

      const { isActive } = req.body;
      const updates: any = {};
      if (typeof isActive === "boolean") {
        updates.isActive = isActive;
        if (!isActive) {
          updates.accountStatus = "disabled";
          updates.loginEnabled = false;
        } else {
          updates.loginEnabled = true;
          if (target.accountStatus === "disabled") {
            updates.accountStatus = "active";
          }
        }
      }

      const updated = await storage.updateUser(req.params.id, updates);
      if (!updated) return res.status(404).json({ message: "Not found" });
      const { password: _, tempPin: __, ...safe } = updated;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Client Login Enablement ─────────────────────────────────────────────
  app.post("/api/clients/:id/enable-login", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const client = await storage.getClient(req.params.id);
      if (!client || client.companyId !== user.companyId) {
        return res.status(404).json({ message: "Client not found" });
      }

      if (!client.contactEmail) {
        return res.status(400).json({ message: "Client must have a contact email to enable login" });
      }

      const existingUser = await storage.getUserByEmail(client.contactEmail);
      if (existingUser && existingUser.id !== client.userId) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }

      const pin = generateTempPin();
      const hashedPin = await hashPassword(pin);

      let clientUser;
      if (client.userId) {
        clientUser = await storage.updateUser(client.userId, {
          password: hashedPin,
          tempPin: pin,
          isActive: true,
          loginEnabled: true,
          accountStatus: "pending_activation",
          mustChangePassword: true,
        });
      } else {
        clientUser = await storage.createUser({
          companyId: user.companyId,
          email: client.contactEmail,
          password: hashedPin,
          role: "client",
          firstName: client.contactName || client.name,
          lastName: "",
          loginEnabled: true,
          accountStatus: "pending_activation",
          mustChangePassword: true,
          tempPin: pin,
        });
        await storage.updateClient(client.id, { userId: clientUser.id });
      }

      res.json({ email: client.contactEmail, tempPin: pin });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clients/:id/reset-pin", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const client = await storage.getClient(req.params.id);
      if (!client || client.companyId !== user.companyId) {
        return res.status(404).json({ message: "Client not found" });
      }
      if (!client.userId) {
        return res.status(400).json({ message: "Client does not have a login account" });
      }

      const targetUser = await storage.getUser(client.userId);
      if (!targetUser || targetUser.companyId !== user.companyId || targetUser.role !== "client") {
        return res.status(400).json({ message: "Invalid client account link" });
      }

      const pin = generateTempPin();
      const hashedPin = await hashPassword(pin);

      await storage.updateUser(client.userId, {
        password: hashedPin,
        tempPin: pin,
        mustChangePassword: true,
        accountStatus: "pending_activation",
      });

      res.json({ email: client.contactEmail, tempPin: pin });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clients/:id/disable-login", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const client = await storage.getClient(req.params.id);
      if (!client || client.companyId !== user.companyId) {
        return res.status(404).json({ message: "Client not found" });
      }
      if (!client.userId) {
        return res.status(400).json({ message: "Client does not have a login account" });
      }

      const targetUser = await storage.getUser(client.userId);
      if (!targetUser || targetUser.companyId !== user.companyId || targetUser.role !== "client") {
        return res.status(400).json({ message: "Invalid client account link" });
      }

      await storage.updateUser(client.userId, {
        isActive: false,
        loginEnabled: false,
        accountStatus: "disabled",
      });

      res.json({ message: "Client login disabled" });
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
      const clients = await storage.getClientsByCompany(user.companyId);
      const enriched = await Promise.all(clients.map(async (client: any) => {
        if (client.userId) {
          const linkedUser = await storage.getUser(client.userId);
          return { ...client, loginEnabled: linkedUser?.loginEnabled ?? false, userAccountStatus: linkedUser?.accountStatus };
        }
        return { ...client, loginEnabled: false, userAccountStatus: null };
      }));
      res.json(enriched);
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

  app.patch("/api/locations/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getLocation(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const { name, address, clientId, notes } = req.body;
      const updated = await storage.updateLocation(req.params.id, {
        ...(name !== undefined && { name: name.trim() }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(clientId !== undefined && { clientId: clientId || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Shifts ────────────────────────────────────────────────────────────────
  // Admin: all shifts for company (supports ?employeeId filter); Employee: own shifts
  app.get("/api/shifts", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { employeeId } = req.query;

      if (user.role === "admin") {
        if (employeeId && typeof employeeId === "string") {
          res.json(await storage.getShiftsByEmployee(employeeId));
        } else {
          res.json(await storage.getShiftsByCompany(user.companyId));
        }
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
      const { employeeId } = req.query;

      if (user.role === "admin") {
        if (employeeId && typeof employeeId === "string") {
          res.json(await storage.getTimeEntriesByEmployee(employeeId));
        } else {
          res.json(await storage.getTimeEntriesByCompany(user.companyId));
        }
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
      } else if (user.role === "employee") {
        res.json(await storage.getClientRequestsByEmployee(user.id));
      } else {
        res.status(403).json({ message: "Forbidden" });
      }
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/client-requests", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { title, description, requestType, priority, photos } = req.body;
      if (!title?.trim()) return res.status(400).json({ message: "Title is required" });

      let clientId: string | null = null;
      let employeeId: string | null = null;
      let visibilityScope = "admin_and_client";

      if (user.role === "client") {
        const clientRecord = await storage.getClientByUserId(user.id);
        if (!clientRecord) return res.status(400).json({ message: "Client profile not found" });
        clientId = clientRecord.id;
        visibilityScope = "admin_and_client";
      } else if (user.role === "employee") {
        employeeId = user.id;
        visibilityScope = "admin_and_employee";
      } else if (user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const request = await storage.createClientRequest({
        companyId: user.companyId,
        clientId: clientId || undefined,
        employeeId: employeeId || undefined,
        createdByUserId: user.id,
        createdByRole: user.role,
        title: title.trim(),
        description: description?.trim() || null,
        requestType: requestType || "service_request",
        priority: priority || "normal",
        status: "new",
        visibilityScope,
        createdAt: new Date().toISOString(),
      });

      // Create initial message with description + photos
      if (description?.trim() || (photos && photos.length > 0)) {
        const msg = await storage.createRequestMessage({
          requestId: request.id,
          authorUserId: user.id,
          authorRole: user.role,
          body: description?.trim() || null,
          messageType: "initial_request",
          isVisibleToClient: true,
          isVisibleToEmployee: true,
          isStatusUpdate: false,
          statusValue: null,
          createdAt: new Date().toISOString(),
        });
        if (photos && Array.isArray(photos)) {
          for (const photo of photos) {
            if (photo.dataUrl) {
              await storage.createRequestAttachment({
                requestMessageId: msg.id,
                fileUrl: photo.dataUrl,
                fileType: "image",
                caption: photo.caption || null,
                uploadedByUserId: user.id,
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
      }

      res.status(201).json(request);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/client-requests/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getClientRequest(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateClientRequest(req.params.id, { ...req.body, updatedAt: new Date().toISOString() });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Request Thread Messages ───────────────────────────────────────────────
  app.get("/api/client-requests/:id/messages", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getClientRequest(req.params.id);
      if (!target) return res.status(404).json({ message: "Not found" });
      // Visibility: admin sees all; client sees their own; employee sees their own
      if (user.role === "admin" && target.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });
      if (user.role === "client") {
        const clientRecord = await storage.getClientByUserId(user.id);
        if (!clientRecord || target.clientId !== clientRecord.id) return res.status(403).json({ message: "Forbidden" });
      }
      if (user.role === "employee" && target.employeeId !== user.id) return res.status(403).json({ message: "Forbidden" });

      const msgs = await storage.getRequestMessages(req.params.id);
      // Filter visibility for non-admins
      const visible = user.role === "admin" ? msgs :
        user.role === "client" ? msgs.filter(m => m.isVisibleToClient) :
        msgs.filter(m => m.isVisibleToEmployee);

      const messageIds = visible.map(m => m.id);
      const attachments = await storage.getRequestAttachmentsByMessageIds(messageIds);
      const attByMsg: Record<string, any[]> = {};
      for (const att of attachments) {
        if (!attByMsg[att.requestMessageId]) attByMsg[att.requestMessageId] = [];
        attByMsg[att.requestMessageId].push(att);
      }

      res.json(visible.map(m => ({ ...m, attachments: attByMsg[m.id] || [] })));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/client-requests/:id/messages", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getClientRequest(req.params.id);
      if (!target) return res.status(404).json({ message: "Not found" });
      // Check access
      if (user.role === "client") {
        const clientRecord = await storage.getClientByUserId(user.id);
        if (!clientRecord || target.clientId !== clientRecord.id) return res.status(403).json({ message: "Forbidden" });
      } else if (user.role === "employee" && target.employeeId !== user.id) {
        return res.status(403).json({ message: "Forbidden" });
      } else if (user.role === "admin" && target.companyId !== user.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { body, photos, statusChange, isVisibleToClient = true, isVisibleToEmployee = true } = req.body;
      const isStatusUpdate = !!statusChange;
      const now = new Date().toISOString();

      const msg = await storage.createRequestMessage({
        requestId: req.params.id,
        authorUserId: user.id,
        authorRole: user.role,
        body: body?.trim() || null,
        messageType: isStatusUpdate ? "status_change" : "reply",
        isVisibleToClient: user.role === "admin" ? isVisibleToClient : true,
        isVisibleToEmployee: user.role === "admin" ? isVisibleToEmployee : true,
        isStatusUpdate,
        statusValue: statusChange || null,
        createdAt: now,
      });

      if (photos && Array.isArray(photos)) {
        for (const photo of photos) {
          if (photo.dataUrl) {
            await storage.createRequestAttachment({
              requestMessageId: msg.id,
              fileUrl: photo.dataUrl,
              fileType: "image",
              caption: photo.caption || null,
              uploadedByUserId: user.id,
              createdAt: now,
            });
          }
        }
      }

      // Update request status if admin changes it
      if (user.role === "admin" && statusChange) {
        const resolvedAt = statusChange === "resolved" ? now : undefined;
        await storage.updateClientRequest(req.params.id, {
          status: statusChange,
          updatedAt: now,
          ...(resolvedAt ? { resolvedAt } : {}),
        });
      } else if (!isStatusUpdate) {
        // Auto-update status when non-admin replies
        if (user.role !== "admin" && (target.status === "new" || target.status === "resolved")) {
          // Don't auto-change; keep current
        } else if (user.role === "admin" && target.status !== "resolved") {
          await storage.updateClientRequest(req.params.id, { status: "replied", updatedAt: now });
        }
      }

      const attachments = await storage.getRequestAttachmentsByMessage(msg.id);
      res.status(201).json({ ...msg, attachments });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Recurring Schedules ──────────────────────────────────────────────────
  const DAY_MAP: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

  function generateShiftsFromSchedule(schedule: any, companyId: string, daysAhead = 90): any[] {
    const results: any[] = [];
    const repeatDays: number[] = (schedule.repeatDays || []).map((d: string) => DAY_MAP[d.toLowerCase()]).filter((n: number) => n !== undefined);
    const start = new Date(schedule.startDate + "T12:00:00");
    const end = schedule.isContinuous ? null : (schedule.endDate ? new Date(schedule.endDate + "T23:59:59") : null);
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + daysAhead);
    const effectiveEnd = end && end < windowEnd ? end : windowEnd;
    const cursor = new Date(Math.max(start.getTime(), Date.now() - 86400000));
    cursor.setHours(12, 0, 0, 0);
    const biweeklyStart = new Date(schedule.startDate + "T12:00:00");
    while (cursor <= effectiveEnd) {
      const dayOfWeek = cursor.getDay();
      if (repeatDays.includes(dayOfWeek)) {
        if (schedule.repeatFrequency === "biweekly") {
          const weeksDiff = Math.floor((cursor.getTime() - biweeklyStart.getTime()) / (7 * 86400000));
          if (weeksDiff % 2 !== 0) { cursor.setDate(cursor.getDate() + 1); continue; }
        }
        const dateStr = cursor.toISOString().split("T")[0];
        const startAt = `${dateStr}T${schedule.scheduledStartTime}:00`;
        const endAt = `${dateStr}T${schedule.scheduledEndTime}:00`;
        const hours = (new Date(endAt).getTime() - new Date(startAt).getTime()) / 3600000;
        results.push({
          companyId,
          employeeId: schedule.employeeId,
          clientId: schedule.clientId || null,
          locationId: schedule.locationId || null,
          shiftDate: dateStr,
          scheduledStartAt: startAt,
          scheduledEndAt: endAt,
          expectedHours: hours > 0 ? hours.toFixed(2) : null,
          gracePeriodMinutes: 15,
          shiftNotes: schedule.shiftNotes || null,
          shiftLabel: schedule.shiftLabel || null,
          shiftType: "recurring",
          recurringScheduleId: schedule.id,
          status: "scheduled",
          createdBy: schedule.createdBy,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return results;
  }

  app.get("/api/recurring-schedules", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { employeeId } = req.query;

      if (employeeId && typeof employeeId === "string") {
        res.json(await storage.getRecurringSchedulesByEmployee(employeeId));
      } else {
        res.json(await storage.getRecurringSchedulesByCompany(user.companyId));
      }
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/recurring-schedules", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { employeeId, clientId, locationId, startDate, endDate, isContinuous, repeatFrequency, repeatDays, scheduledStartTime, scheduledEndTime, shiftLabel, shiftNotes } = req.body;
      if (!employeeId || !startDate || !scheduledStartTime || !scheduledEndTime || !repeatDays?.length) {
        return res.status(400).json({ message: "Employee, start date, times, and repeat days are required" });
      }
      const schedule = await storage.createRecurringSchedule({
        companyId: user.companyId,
        employeeId,
        clientId: clientId || null,
        locationId: locationId || null,
        startDate,
        endDate: endDate || null,
        isContinuous: isContinuous !== false,
        repeatFrequency: repeatFrequency || "weekly",
        repeatDays,
        scheduledStartTime,
        scheduledEndTime,
        shiftLabel: shiftLabel || null,
        shiftNotes: shiftNotes || null,
        status: "active",
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        generatedUpTo: null,
      });
      const shiftsToCreate = generateShiftsFromSchedule(schedule, user.companyId, 90);
      for (const s of shiftsToCreate) {
        await storage.createShift(s);
      }
      const windowEnd = new Date();
      windowEnd.setDate(windowEnd.getDate() + 90);
      await storage.updateRecurringSchedule(schedule.id, { generatedUpTo: windowEnd.toISOString().split("T")[0] });
      res.status(201).json({ schedule, shiftsCreated: shiftsToCreate.length });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/recurring-schedules/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getRecurringSchedule(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateRecurringSchedule(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/recurring-schedules/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getRecurringSchedule(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const today = new Date().toISOString().split("T")[0];
      const futureShifts = (await storage.getShiftsByRecurringSchedule(req.params.id))
        .filter(s => s.shiftDate >= today && s.status === "scheduled");
      for (const s of futureShifts) await storage.deleteShift(s.id);
      await storage.deleteRecurringSchedule(req.params.id);
      res.json({ message: "Deleted", futureShiftsRemoved: futureShifts.length });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Payroll History ──────────────────────────────────────────────────────
  app.get("/api/payroll/employees/:employeeId/history", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const employee = await storage.getUser(req.params.employeeId);
      if (!employee || employee.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });

      const company = await storage.getCompany(user.companyId);
      const allEntries = await storage.getTimeEntriesByEmployee(req.params.employeeId);
      const completed = allEntries.filter(e => e.status === "completed" && e.clockInTime);

      const rate = parseFloat(employee.hourlyRate as string || "0");
      const overtimeRate = parseFloat(employee.overtimeRate as string || "0") || rate * 1.5;
      const overtimeEnabled = company?.overtimeEnabled ?? false;

      const anchorDateStr = company?.payrollCycleStartDate || "2025-01-01";
      const anchor = new Date(anchorDateStr + "T00:00:00");

      function getPeriodIndex(dateStr: string): number {
        const d = new Date(dateStr + "T00:00:00");
        const diffDays = Math.floor((d.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
        return Math.floor(diffDays / 14);
      }

      function getPeriodDates(index: number): { start: string; end: string } {
        const startMs = anchor.getTime() + index * 14 * 24 * 60 * 60 * 1000;
        const endMs = startMs + 13 * 24 * 60 * 60 * 1000;
        const fmt = (ms: number) => new Date(ms).toISOString().split("T")[0];
        return { start: fmt(startMs), end: fmt(endMs) };
      }

      const periodMap = new Map<number, any[]>();
      for (const entry of completed) {
        const dateStr = entry.clockInTime!.toString().substring(0, 10);
        const idx = getPeriodIndex(dateStr);
        if (!periodMap.has(idx)) periodMap.set(idx, []);
        periodMap.get(idx)!.push(entry);
      }

      const todayIdx = getPeriodIndex(new Date().toISOString().split("T")[0]);
      const allIdxs = [...new Set([...periodMap.keys(), todayIdx])].sort((a, b) => b - a);

      const periods = allIdxs.map(idx => {
        const { start, end } = getPeriodDates(idx);
        const entries = periodMap.get(idx) || [];
        const totalMinutes = entries.reduce((s: number, e: any) => s + (e.workedMinutes || 0), 0);
        const hours = totalMinutes / 60;
        const regularHours = Math.min(hours, overtimeEnabled ? (company?.overtimeThresholdWeekly || 40) * 2 : hours);
        const overtimeHours = overtimeEnabled ? Math.max(0, hours - regularHours) : 0;
        const regularPay = regularHours * rate;
        const otPay = overtimeHours * overtimeRate;
        const grossPay = regularPay + otPay;
        const tax = grossPay * 0.05;
        const netPay = grossPay - tax;
        return {
          index: idx,
          periodStart: start,
          periodEnd: end,
          isCurrent: idx === todayIdx,
          hours: +hours.toFixed(2),
          regularHours: +regularHours.toFixed(2),
          overtimeHours: +overtimeHours.toFixed(2),
          regularPay: +regularPay.toFixed(2),
          overtimePay: +otPay.toFixed(2),
          grossPay: +grossPay.toFixed(2),
          taxAmount: +tax.toFixed(2),
          netPay: +netPay.toFixed(2),
          entriesCount: entries.length,
        };
      });

      const currentPeriod = periods.find(p => p.isCurrent) || periods[0];
      res.json({
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          hourlyRate: rate,
          overtimeRate,
        },
        currentPeriod,
        periods,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Payroll Deductions ────────────────────────────────────────────────────
  app.get("/api/payroll-deductions", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      res.json(await storage.getPayrollDeductionsByCompany(user.companyId));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/payroll-deductions", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { label, type, value } = req.body;
      if (!label?.trim()) return res.status(400).json({ message: "Label is required" });
      const deduction = await storage.createPayrollDeduction({
        companyId: user.companyId,
        label: label.trim(),
        type: type || "percent",
        value: value?.toString() || "0",
        isActive: true,
      });
      res.status(201).json(deduction);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/payroll-deductions/:id", requireRole("admin"), async (req, res) => {
    try {
      const updated = await storage.updatePayrollDeduction(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Deduction not found" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/payroll-deductions/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deletePayrollDeduction(req.params.id);
      res.status(204).end();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  return httpServer;
}

