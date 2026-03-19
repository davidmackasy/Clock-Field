import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, hashPassword, comparePasswords, requireAuth, requireRole } from "./auth";
import passport from "passport";
import { randomBytes } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { isNotNull, eq } from "drizzle-orm";
import { clientRequests } from "@shared/schema";
import { getPlan } from "./plans";

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.role !== "admin" || !user.isSuperAdmin) return res.status(403).json({ message: "Super admin access required" });
  next();
}

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/**
 * Convert a UTC datetime string to a local ISO datetime string (no TZ suffix)
 * in the given IANA timezone, using formatToParts for reliable parsing.
 * Example: ("2026-03-16T06:52:00Z", "America/Winnipeg") → "2026-03-16T01:52:00"
 */
function utcToLocalIso(utcStr: string, timezone: string): string {
  const d = new Date(utcStr);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  // hour12:false with hour:"2-digit" can return "24" at midnight — normalise to "00"
  const hh = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hh}:${p.minute}:${p.second}`;
}

/**
 * Build attendance flags by comparing actual clock-in/out times against scheduled
 * times. Both sides are compared in the company's local timezone so the direction
 * (early vs late) is always correct regardless of the UTC offset.
 */
function buildAttendanceFlags(opts: {
  clockInAtUtc: string;
  clockOutAtUtc?: string | null;
  scheduledStartLocal: string;
  scheduledEndLocal?: string | null;
  timezone: string;
  existingFlags?: string[];
}): string[] {
  const { clockInAtUtc, clockOutAtUtc, scheduledStartLocal, scheduledEndLocal, timezone, existingFlags = [] } = opts;

  // Keep non-timing flags (e.g. unscheduled_clock_in, no_show)
  const flags = existingFlags.filter(f =>
    !["early_clock_in", "late_clock_in", "left_early", "early_clock_out", "late_clock_out"].includes(f)
  );

  // ── Clock-in: convert UTC → local, compare against scheduledStartLocal ────
  const clockInLocal = utcToLocalIso(clockInAtUtc, timezone);
  if (clockInLocal < scheduledStartLocal) {
    flags.push("early_clock_in");
  } else if (clockInLocal > scheduledStartLocal) {
    flags.push("late_clock_in");
  }

  // ── Clock-out: convert UTC → local, compare against scheduledEndLocal ─────
  if (clockOutAtUtc && scheduledEndLocal) {
    const clockOutLocal = utcToLocalIso(clockOutAtUtc, timezone);
    if (clockOutLocal < scheduledEndLocal) {
      flags.push("early_clock_out");
    } else if (clockOutLocal > scheduledEndLocal) {
      flags.push("late_clock_out");
    }
  }

  return flags;
}

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG and PNG files are allowed"));
  },
});

function generateTempPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function migrateUploadsToBase64(): Promise<void> {
  try {
    const allRequests = await db.select().from(clientRequests).where(isNotNull(clientRequests.imageUrls));
    const toMigrate = allRequests.filter(r =>
      r.imageUrls?.some(url => url.startsWith("/uploads/"))
    );
    if (toMigrate.length === 0) return;
    console.log(`[img-migration] Migrating ${toMigrate.length} request(s) with local /uploads/ images to base64 in DB...`);

    for (const req of toMigrate) {
      const uploadUrls = (req.imageUrls || []).filter(u => u.startsWith("/uploads/"));
      const converted: string[] = [];

      for (const url of uploadUrls) {
        const filePath = path.join(process.cwd(), url);
        if (!fs.existsSync(filePath)) {
          console.log(`[img-migration] File not found on disk, skipping: ${filePath}`);
          continue;
        }
        const buf = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === ".png" ? "image/png" : "image/jpeg";
        converted.push(`data:${mime};base64,${buf.toString("base64")}`);
      }

      const messages = await storage.getRequestMessages(req.id);
      let initialMsg = messages.find(m => m.messageType === "initial_request");
      if (!initialMsg) {
        initialMsg = await storage.createRequestMessage({
          requestId: req.id,
          authorUserId: req.createdByUserId || "system",
          authorRole: req.createdByRole || "client",
          body: req.description || null,
          messageType: "initial_request",
          isVisibleToClient: true,
          isVisibleToEmployee: true,
          isStatusUpdate: false,
          statusValue: null,
          createdAt: req.createdAt,
        });
      }

      for (const dataUrl of converted) {
        await storage.createRequestAttachment({
          requestMessageId: initialMsg.id,
          fileUrl: dataUrl,
          fileType: "image",
          caption: null,
          uploadedByUserId: req.createdByUserId || "system",
          createdAt: new Date().toISOString(),
        });
      }

      await db.update(clientRequests).set({ imageUrls: null }).where(eq(clientRequests.id, req.id));
      console.log(`[img-migration] Migrated ${converted.length}/${uploadUrls.length} photo(s) for request ${req.id}`);
    }
    console.log("[img-migration] Done.");
  } catch (err: any) {
    console.error("[img-migration] Migration failed:", err.message);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // ── File Upload ────────────────────────────────────────────────────────────
  app.post("/api/upload", requireAuth, (req, res) => {
    upload.array("photos", 3)(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ message: "Each photo must be under 10MB" });
        if (err.code === "LIMIT_FILE_COUNT") return res.status(400).json({ message: "Maximum 3 photos allowed" });
        return res.status(400).json({ message: err.message || "Upload failed" });
      }
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ message: "No files uploaded" });
      const urls = files.map(f => {
        const ext = f.mimetype === "image/png" ? ".png" : ".jpg";
        const newName = f.filename + ext;
        fs.renameSync(f.path, path.join(UPLOADS_DIR, newName));
        return `/uploads/${newName}`;
      });
      res.json({ urls });
    });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, companyName } = req.body;
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(400).json({ message: "Email already exists" });

      // New businesses start as pending_subscription — must subscribe before accessing the platform
      const company = await storage.createCompany({
        name: companyName,
        accountStatus: "pending_subscription",
        subscriptionStatus: "pending",
        planCode: "starter",
      });
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

  // Company subscription status — used by frontend to determine paywall state
  app.get("/api/auth/company", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });
      res.json({
        id: company.id,
        name: company.name,
        planCode: company.planCode,
        billingCycle: company.billingCycle,
        subscriptionStatus: company.subscriptionStatus,
        accountStatus: company.accountStatus,
        internalBypass: company.internalBypass,
        currentPeriodEnd: company.currentPeriodEnd,
        cancelAtPeriodEnd: company.cancelAtPeriodEnd,
        stripeCustomerId: company.stripeCustomerId,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
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

      // Plan limit enforcement
      const company = await storage.getCompany(user.companyId);
      if (company) {
        const plan = getPlan(company.planCode);
        const existingEmployees = await storage.getEmployeesByCompany(user.companyId);
        if (existingEmployees.length >= plan.maxEmployees) {
          return res.status(403).json({
            message: `Your ${plan.name} plan allows up to ${plan.maxEmployees} employee${plan.maxEmployees === 1 ? "" : "s"}. Upgrade your plan to add more.`,
            code: "PLAN_LIMIT_EMPLOYEES",
            limit: plan.maxEmployees,
            current: existingEmployees.length,
          });
        }
      }

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
      if (req.body.timezone) {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: req.body.timezone });
        } catch {
          return res.status(400).json({ message: "Invalid timezone value" });
        }
      }
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
      // lateToday: time entries with late_clock_in flag from today — exactly what the attendance
      // page shows when filtered to Today + Late Clock-in, so dashboard and click-through match.
      const todayEntries = allEntries.filter(e => e.clockInAt.startsWith(today));
      const lateToday = todayEntries.filter(e =>
        Array.isArray(e.flags) && e.flags.includes("late_clock_in")
      ).length;
      // missedToday: scheduled shifts today where no clock-in has occurred and the shift start
      // is more than 30 minutes in the past (prevents premature counting).
      const MISSED_THRESHOLD_MS = 30 * 60 * 1000;
      const clockedInShiftIds = new Set(allEntries.filter(e => e.clockInAt.startsWith(today)).map(e => e.shiftId).filter(Boolean));
      const missedToday = todayShifts.filter(s => {
        if (s.status === "missed" || s.status === "no_show") return true;
        if (s.status !== "scheduled") return false;
        const start = new Date(s.scheduledStartAt).getTime();
        return now > start + MISSED_THRESHOLD_MS && !clockedInShiftIds.has(s.id);
      }).length;
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

      // Plan limit enforcement
      const company = await storage.getCompany(user.companyId);
      if (company) {
        const plan = getPlan(company.planCode);
        const existingClients = await storage.getClientsByCompany(user.companyId);
        if (existingClients.length >= plan.maxClients) {
          return res.status(403).json({
            message: `Your ${plan.name} plan allows up to ${plan.maxClients} client${plan.maxClients === 1 ? "" : "s"}. Upgrade your plan to add more.`,
            code: "PLAN_LIMIT_CLIENTS",
            limit: plan.maxClients,
            current: existingClients.length,
          });
        }
      }

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
      let flags: string[] = [];
      if (shift) {
        const company = await storage.getCompany(user.companyId);
        const tz = company?.timezone || "UTC";
        flags = buildAttendanceFlags({
          clockInAtUtc: now,
          scheduledStartLocal: shift.scheduledStartAt,
          timezone: tz,
        });
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
      let flags = [...(entry.flags || [])];
      if (entry.shiftId) {
        const shift = await storage.getShift(entry.shiftId);
        if (shift) {
          const company = await storage.getCompany(user.companyId);
          const tz = company?.timezone || "UTC";
          // Rebuild full flags using both clock-in and clock-out now available
          flags = buildAttendanceFlags({
            clockInAtUtc: entry.clockInAt,
            clockOutAtUtc: now,
            scheduledStartLocal: shift.scheduledStartAt,
            scheduledEndLocal: shift.scheduledEndAt,
            timezone: tz,
            existingFlags: entry.flags || [],
          });
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

  // ── Admin Manual Clock-Out ─────────────────────────────────────────────────
  app.post("/api/time-entries/:id/admin-clock-out", requireRole("admin"), async (req, res) => {
    try {
      const admin = req.user as any;
      const { id } = req.params;
      const { clockOutAt, reason } = req.body;

      if (!clockOutAt) return res.status(400).json({ message: "clockOutAt is required" });

      const entry = await storage.getTimeEntry(id);
      if (!entry) return res.status(404).json({ message: "Time entry not found" });
      if (entry.companyId !== admin.companyId) return res.status(403).json({ message: "Access denied" });
      if (entry.status !== "active") return res.status(400).json({ message: "Shift is already closed" });

      const clockOutTime = new Date(clockOutAt).toISOString();
      const clockInTime = new Date(entry.clockInAt);
      if (new Date(clockOutTime) <= clockInTime) {
        return res.status(400).json({ message: "Clock-out time cannot be before clock-in time" });
      }

      const workedMinutes = Math.round((new Date(clockOutTime).getTime() - clockInTime.getTime()) / 60000);

      let flags = [...(entry.flags || [])];
      if (entry.shiftId) {
        const shift = await storage.getShift(entry.shiftId);
        if (shift) {
          const company = await storage.getCompany(admin.companyId);
          const tz = company?.timezone || "UTC";
          flags = buildAttendanceFlags({
            clockInAtUtc: entry.clockInAt,
            clockOutAtUtc: clockOutTime,
            scheduledStartLocal: shift.scheduledStartAt,
            scheduledEndLocal: shift.scheduledEndAt,
            timezone: tz,
            existingFlags: entry.flags || [],
          });
          const expectedMins = parseFloat(shift.expectedHours || "0") * 60;
          if (workedMinutes > expectedMins + 30) flags.push("overtime");
          await storage.updateShift(entry.shiftId, { status: "completed" });
        }
      }

      const now = new Date().toISOString();
      const updated = await storage.updateTimeEntry(entry.id, {
        clockOutAt: clockOutTime,
        workedMinutes,
        status: "completed",
        flags: flags.length ? flags : null,
        manuallyClosedByAdmin: true,
        manualClockOutByUserId: admin.id,
        manualClockOutAt: now,
        manualClockOutReason: reason || "Admin clocked out employee after forgotten clock-out",
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
      const { title, description, requestType, priority, photos, imageUrls } = req.body;
      if (!title?.trim()) return res.status(400).json({ message: "Title is required" });

      // Validate imageUrls (returned by /api/upload)
      if (imageUrls && Array.isArray(imageUrls)) {
        if (imageUrls.length > 10) return res.status(400).json({ message: "Maximum 10 photos allowed per request" });
        for (const url of imageUrls) {
          if (typeof url !== "string" || !url.startsWith("/uploads/")) {
            return res.status(400).json({ message: "Invalid image URL" });
          }
        }
      }

      // Base64 photos (stored as attachments on initial_request message)
      if (photos && Array.isArray(photos)) {
        if (photos.length > 10) return res.status(400).json({ message: "Maximum 10 photos allowed per request" });
        for (const photo of photos) {
          if (!photo.dataUrl) continue;
          const mimeMatch = photo.dataUrl.match(/^data:(image\/(?:jpeg|png|jpg));base64,/);
          if (!mimeMatch) return res.status(400).json({ message: "Only JPG and PNG images are allowed" });
          const base64Data = photo.dataUrl.split(",")[1] || "";
          const sizeBytes = Math.ceil(base64Data.length * 3 / 4);
          if (sizeBytes > 10 * 1024 * 1024) return res.status(400).json({ message: "Each photo must be under 10MB" });
        }
      }

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
        imageUrls: (imageUrls && imageUrls.length > 0) ? imageUrls : undefined,
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
      if (user.role === "admin" && target.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });
      if (user.role === "client") {
        const clientRecord = await storage.getClientByUserId(user.id);
        if (!clientRecord || target.clientId !== clientRecord.id) return res.status(403).json({ message: "Forbidden" });
      }
      if (user.role === "employee" && target.employeeId !== user.id) return res.status(403).json({ message: "Forbidden" });

      const msgs = await storage.getRequestMessages(req.params.id);
      const visible = user.role === "admin" ? msgs :
        user.role === "client" ? msgs.filter(m => m.isVisibleToClient) :
        msgs.filter(m => m.isVisibleToEmployee);

      const messageIds = visible.map(m => m.id);
      const attachments = await storage.getRequestAttachmentsByMessageIds(messageIds);
      const attByMsg: Record<string, any[]> = {};
      for (const att of attachments) {
        if (!attByMsg[att.requestMessageId]) attByMsg[att.requestMessageId] = [];
        // Strip the heavy base64 fileUrl — serve via /api/attachments/:id/image instead
        attByMsg[att.requestMessageId].push({
          id: att.id,
          caption: att.caption,
          fileType: att.fileType,
          createdAt: att.createdAt,
        });
      }

      res.json(visible.map(m => ({ ...m, attachments: attByMsg[m.id] || [] })));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Attachment image endpoint ─────────────────────────────────────────────
  app.get("/api/attachments/:id/image", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const att = await storage.getRequestAttachment(req.params.id);
      if (!att) return res.status(404).json({ message: "Not found" });

      // IDOR protection: verify this attachment belongs to a request the user can access
      const msg = await storage.getRequestMessage(att.requestMessageId);
      if (!msg) return res.status(404).json({ message: "Not found" });
      const requestRecord = await storage.getClientRequest(msg.requestId);
      if (!requestRecord || requestRecord.companyId !== user.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (user.role === "client") {
        const clientRecord = await storage.getClientByUserId(user.id);
        if (!clientRecord || requestRecord.clientId !== clientRecord.id) {
          return res.status(403).json({ message: "Forbidden" });
        }
      } else if (user.role === "employee" && requestRecord.employeeId !== user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const dataUrl = att.fileUrl;
      // Parse data URL: data:image/jpeg;base64,<data>
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) return res.status(400).json({ message: "Invalid image data" });
      const mimeType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, "base64");
      res.set("Content-Type", mimeType);
      res.set("Cache-Control", "private, max-age=86400");
      res.send(buffer);
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

      if (photos && Array.isArray(photos)) {
        if (photos.length > 3) return res.status(400).json({ message: "Maximum 3 photos allowed per reply" });
        for (const photo of photos) {
          if (!photo.dataUrl) continue;
          const mimeMatch = photo.dataUrl.match(/^data:(image\/(?:jpeg|png|jpg));base64,/);
          if (!mimeMatch) return res.status(400).json({ message: "Only JPG and PNG images are allowed" });
          const base64Data = photo.dataUrl.split(",")[1] || "";
          const sizeBytes = Math.ceil(base64Data.length * 3 / 4);
          if (sizeBytes > 10 * 1024 * 1024) return res.status(400).json({ message: "Each photo must be under 10MB" });
        }
      }

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
      // Strip base64 from response — images served via /api/attachments/:id/image
      const attachmentsMeta = attachments.map(({ id, caption, fileType, createdAt, requestMessageId, uploadedByUserId }) =>
        ({ id, caption, fileType, createdAt, requestMessageId, uploadedByUserId })
      );
      res.status(201).json({ ...msg, attachments: attachmentsMeta });
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

  // ── Employee locations (for work submission location selection) ───────────
  app.get("/api/employee/locations", requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const today = new Date().toISOString().split("T")[0];
      const myShifts = await storage.getShiftsByEmployee(user.id);
      const todayShifts = myShifts.filter((s: any) => s.shiftDate === today && s.locationId);
      const locationIds = [...new Set(todayShifts.map((s: any) => s.locationId).filter(Boolean))];
      const allLocations = await storage.getLocationsByCompany(user.companyId);
      const todayLocs = allLocations.filter((l: any) => locationIds.includes(l.id));
      // If no scheduled locations today, return all company locations so they can select
      res.json(todayLocs.length > 0 ? todayLocs : allLocations);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Timesheets ────────────────────────────────────────────────────────────
  function getPayPeriodBounds(cycleStartDate: string | null, periodType: string, referenceDate: string) {
    const periodDays = periodType === "weekly" ? 7 : 14;
    const anchor = cycleStartDate || referenceDate;
    const startDate = new Date(anchor + "T12:00:00");
    const ref = new Date(referenceDate + "T12:00:00");
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((ref.getTime() - startDate.getTime()) / msPerDay);
    const periodIndex = Math.floor(diffDays / periodDays);
    const periodStartMs = startDate.getTime() + periodIndex * periodDays * msPerDay;
    const ps = new Date(periodStartMs);
    const pe = new Date(periodStartMs + (periodDays - 1) * msPerDay);
    return { start: ps.toISOString().split("T")[0], end: pe.toISOString().split("T")[0] };
  }

  async function buildTimesheetForEmployee(
    companyId: string, employeeId: string, periodStart: string, periodEnd: string,
    periodType: string, company: any
  ) {
    const now = new Date().toISOString();
    const allEntries = await storage.getTimeEntriesByEmployee(employeeId);
    const periodEntries = allEntries.filter(e => {
      const d = e.clockInAt.slice(0, 10);
      return d >= periodStart && d <= periodEnd && e.status !== "active";
    });
    const completedPeriodEntries = periodEntries.filter(e => e.clockInAt && e.clockOutAt);
    const totalWorkedMinutes = completedPeriodEntries.reduce((sum, e) => {
      if (e.workedMinutes != null) return sum + e.workedMinutes;
      const diff = (new Date(e.clockOutAt!).getTime() - new Date(e.clockInAt).getTime()) / 60000;
      return sum + Math.max(0, diff);
    }, 0);
    const totalShifts = completedPeriodEntries.length;
    const lateCount = completedPeriodEntries.filter(e => Array.isArray(e.flags) && e.flags.includes("late_clock_in")).length;
    const leftEarlyCount = completedPeriodEntries.filter(e => Array.isArray(e.flags) && (e.flags.includes("left_early") || e.flags.includes("early_clock_out"))).length;
    const allShifts = await storage.getShiftsByEmployee(employeeId);
    const periodShifts = allShifts.filter(s => s.shiftDate >= periodStart && s.shiftDate <= periodEnd);
    const missedShiftCount = periodShifts.filter(s => s.status === "missed" || s.status === "no_show").length;
    const msPerDay = 24 * 60 * 60 * 1000;
    const periodDays = Math.round((new Date(periodEnd + "T12:00:00").getTime() - new Date(periodStart + "T12:00:00").getTime()) / msPerDay) + 1;
    const periodWeeks = periodDays / 7;
    const otEnabled = company.overtimeEnabled;
    const otThresholdMins = (company.overtimeThresholdWeekly || 40) * 60 * periodWeeks;
    const overtimeMinutes = otEnabled ? Math.max(0, totalWorkedMinutes - otThresholdMins) : 0;
    const regularMinutes = totalWorkedMinutes - overtimeMinutes;
    const existing = await storage.getTimesheetByEmployeeAndPeriod(employeeId, periodStart);
    if (existing) {
      const keepStatus = ["submitted", "approved"].includes(existing.status) ? existing.status : "draft";
      return await storage.updateTimesheet(existing.id, {
        totalWorkedMinutes, regularMinutes: Math.round(regularMinutes), overtimeMinutes: Math.round(overtimeMinutes),
        totalShifts, lateCount, leftEarlyCount, missedShiftCount,
        payPeriodEnd: periodEnd, payPeriodType: periodType,
        status: keepStatus, generatedAt: now, updatedAt: now,
      });
    }
    return await storage.createTimesheet({
      companyId, employeeId, payPeriodStart: periodStart, payPeriodEnd: periodEnd, payPeriodType: periodType,
      status: "draft", totalWorkedMinutes, regularMinutes: Math.round(regularMinutes),
      overtimeMinutes: Math.round(overtimeMinutes), totalShifts, lateCount, leftEarlyCount, missedShiftCount,
      generatedAt: now, createdAt: now, updatedAt: now,
    });
  }

  app.get("/api/timesheets/current", requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });
      const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: company.timezone || "UTC" });
      const { start: periodStart, end: periodEnd } = getPayPeriodBounds(
        company.payrollCycleStartDate, company.defaultPayPeriodType, todayLocal
      );
      const existing = await storage.getTimesheetByEmployeeAndPeriod(user.id, periodStart);
      if (existing && ["submitted", "approved"].includes(existing.status)) {
        const allEntries = await storage.getTimeEntriesByEmployee(user.id);
        const entries = allEntries
          .filter(e => { const d = e.clockInAt.slice(0, 10); return d >= periodStart && d <= periodEnd; })
          .sort((a, b) => a.clockInAt.localeCompare(b.clockInAt));
        return res.json({ ...existing, entries });
      }
      const allEntries = await storage.getTimeEntriesByEmployee(user.id);
      const periodEntries = allEntries
        .filter(e => { const d = e.clockInAt.slice(0, 10); return d >= periodStart && d <= periodEnd; })
        .sort((a, b) => a.clockInAt.localeCompare(b.clockInAt));
      const completedEntries = periodEntries.filter(e => e.clockInAt && e.clockOutAt);
      const totalWorkedMinutes = completedEntries.reduce((sum, e) => {
        if (e.workedMinutes != null) return sum + e.workedMinutes;
        const diff = (new Date(e.clockOutAt!).getTime() - new Date(e.clockInAt).getTime()) / 60000;
        return sum + Math.max(0, diff);
      }, 0);
      const totalShifts = completedEntries.length;
      const lateCount = completedEntries.filter(e => Array.isArray(e.flags) && e.flags.includes("late_clock_in")).length;
      const leftEarlyCount = completedEntries.filter(e => Array.isArray(e.flags) && (
        e.flags.includes("early_clock_out") || e.flags.includes("left_early")
      )).length;
      const allShifts = await storage.getShiftsByEmployee(user.id);
      const periodShifts = allShifts.filter(s => s.shiftDate >= periodStart && s.shiftDate <= periodEnd);
      const missedShiftCount = periodShifts.filter(s => s.status === "missed" || s.status === "no_show").length;
      const msPerDay = 24 * 60 * 60 * 1000;
      const periodDays = Math.round(
        (new Date(periodEnd + "T12:00:00").getTime() - new Date(periodStart + "T12:00:00").getTime()) / msPerDay
      ) + 1;
      const periodWeeks = periodDays / 7;
      const otThresholdMins = (company.overtimeThresholdWeekly || 40) * 60 * periodWeeks;
      const overtimeMinutes = company.overtimeEnabled ? Math.max(0, totalWorkedMinutes - otThresholdMins) : 0;
      const regularMinutes = totalWorkedMinutes - overtimeMinutes;
      const isPeriodClosed = todayLocal > periodEnd;
      res.json({
        id: existing?.id || null,
        companyId: user.companyId,
        employeeId: user.id,
        payPeriodStart: periodStart,
        payPeriodEnd: periodEnd,
        payPeriodType: company.defaultPayPeriodType,
        status: isPeriodClosed ? "draft" : "in_progress",
        totalWorkedMinutes,
        regularMinutes: Math.round(regularMinutes),
        overtimeMinutes: Math.round(overtimeMinutes),
        totalShifts,
        lateCount,
        leftEarlyCount,
        missedShiftCount,
        generatedAt: existing?.generatedAt || null,
        submittedAt: existing?.submittedAt || null,
        approvedAt: existing?.approvedAt || null,
        approvedByUserId: existing?.approvedByUserId || null,
        entries: periodEntries,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/timesheets", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      let list = user.role === "admin"
        ? await storage.getTimesheetsByCompany(user.companyId)
        : await storage.getTimesheetsByEmployee(user.id);
      if (req.query.periodStart) list = list.filter(t => t.payPeriodStart === req.query.periodStart);
      res.json(list);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timesheets/generate", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });
      const today = new Date().toISOString().split("T")[0];
      let { employeeId, periodStart, periodEnd } = req.body;
      if (!periodStart || !periodEnd) {
        const p = getPayPeriodBounds(company.payrollCycleStartDate, company.defaultPayPeriodType, today);
        periodStart = p.start; periodEnd = p.end;
      }
      if (user.role === "employee") {
        const ts = await buildTimesheetForEmployee(user.companyId, user.id, periodStart, periodEnd, company.defaultPayPeriodType, company);
        return res.json([ts]);
      }
      if (employeeId) {
        const ts = await buildTimesheetForEmployee(user.companyId, employeeId, periodStart, periodEnd, company.defaultPayPeriodType, company);
        return res.json([ts]);
      }
      const employees = await storage.getEmployeesByCompany(user.companyId);
      const active = employees.filter(e => e.isActive && e.accountStatus !== "profile_only" && e.loginEnabled);
      const results = await Promise.all(active.map(emp =>
        buildTimesheetForEmployee(user.companyId, emp.id, periodStart, periodEnd, company.defaultPayPeriodType, company)
      ));
      res.json(results.filter(Boolean));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/timesheets/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const ts = await storage.getTimesheet(req.params.id);
      if (!ts) return res.status(404).json({ message: "Not found" });
      if (ts.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });
      if (user.role === "employee" && ts.employeeId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const allEntries = await storage.getTimeEntriesByEmployee(ts.employeeId);
      const entries = allEntries
        .filter(e => { const d = e.clockInAt.slice(0, 10); return d >= ts.payPeriodStart && d <= ts.payPeriodEnd; })
        .sort((a, b) => a.clockInAt.localeCompare(b.clockInAt));
      res.json({ ...ts, entries });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timesheets/:id/submit", requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const ts = await storage.getTimesheet(req.params.id);
      if (!ts) return res.status(404).json({ message: "Not found" });
      if (ts.employeeId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (ts.status !== "draft") return res.status(400).json({ message: "Only draft timesheets can be submitted" });
      const now = new Date().toISOString();
      const updated = await storage.updateTimesheet(ts.id, { status: "submitted", submittedAt: now, updatedAt: now });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timesheets/:id/approve", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const ts = await storage.getTimesheet(req.params.id);
      if (!ts) return res.status(404).json({ message: "Not found" });
      if (ts.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });
      const now = new Date().toISOString();
      const updated = await storage.updateTimesheet(ts.id, { status: "approved", approvedAt: now, approvedByUserId: user.id, updatedAt: now });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Work Submissions ──────────────────────────────────────────────────────
  app.get("/api/work-submissions", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role === "admin") {
        const subs = await storage.getWorkSubmissionsByCompany(user.companyId);
        res.json(subs);
      } else {
        const subs = await storage.getWorkSubmissionsByEmployee(user.id);
        res.json(subs);
      }
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/work-submissions", requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const now = new Date().toISOString();
      const today = now.split("T")[0];
      // Auto-link active shift if present
      const activeEntry = await storage.getActiveTimeEntry(user.id);
      const shiftId = activeEntry?.shiftId || null;
      const sub = await storage.createWorkSubmission({
        companyId: user.companyId,
        employeeId: user.id,
        shiftId,
        clientId: req.body.clientId || null,
        locationId: req.body.locationId || null,
        locationName: req.body.locationName || null,
        workDate: today,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        submittedAt: null,
      });
      res.status(201).json(sub);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/work-submissions/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getWorkSubmission(req.params.id);
      if (!sub) return res.status(404).json({ message: "Not found" });
      if (user.role === "employee" && sub.employeeId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (user.role === "admin" && sub.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });
      const items = await storage.getWorkSubmissionItems(sub.id);
      const itemIds = items.map(i => i.id);
      const photos = await storage.getWorkSubmissionPhotosByItemIds(itemIds);
      const photosByItem: Record<string, any[]> = {};
      for (const p of photos) {
        if (!photosByItem[p.submissionItemId]) photosByItem[p.submissionItemId] = [];
        photosByItem[p.submissionItemId].push({ id: p.id, photoType: p.photoType, caption: p.caption, createdAt: p.createdAt });
      }
      res.json({ ...sub, items: items.map(i => ({ ...i, photos: photosByItem[i.id] || [] })) });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/work-submissions/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getWorkSubmission(req.params.id);
      if (!sub) return res.status(404).json({ message: "Not found" });
      if (user.role === "employee" && sub.employeeId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (user.role === "admin" && sub.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });
      const now = new Date().toISOString();
      const updates: any = { ...req.body, updatedAt: now };
      if (req.body.status === "submitted" && !sub.submittedAt) updates.submittedAt = now;
      const updated = await storage.updateWorkSubmission(req.params.id, updates);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/work-submissions/:id", requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getWorkSubmission(req.params.id);
      if (!sub) return res.status(404).json({ message: "Not found" });
      if (sub.employeeId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (sub.status !== "draft") return res.status(400).json({ message: "Cannot delete submitted work" });
      await storage.deleteWorkSubmission(req.params.id);
      res.status(204).end();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Work submission items
  app.post("/api/work-submissions/:id/items", requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getWorkSubmission(req.params.id);
      if (!sub) return res.status(404).json({ message: "Not found" });
      if (sub.employeeId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (sub.status !== "draft") return res.status(400).json({ message: "Submission already submitted" });
      const existing = await storage.getWorkSubmissionItems(sub.id);
      const now = new Date().toISOString();
      const item = await storage.createWorkSubmissionItem({
        submissionId: sub.id,
        section: req.body.section,
        subArea: req.body.subArea,
        notes: req.body.notes || null,
        sortOrder: existing.length,
        createdAt: now,
      });
      // Save photos if provided
      const beforePhotos: string[] = req.body.beforePhotos || [];
      const afterPhotos: string[] = req.body.afterPhotos || [];
      for (const fileUrl of beforePhotos) {
        await storage.createWorkSubmissionPhoto({ submissionItemId: item.id, photoType: "before", fileUrl, caption: null, createdAt: now });
      }
      for (const fileUrl of afterPhotos) {
        await storage.createWorkSubmissionPhoto({ submissionItemId: item.id, photoType: "after", fileUrl, caption: null, createdAt: now });
      }
      await storage.updateWorkSubmission(sub.id, { updatedAt: now });
      const photos = await storage.getWorkSubmissionPhotosByItem(item.id);
      res.status(201).json({ ...item, photos: photos.map(p => ({ id: p.id, photoType: p.photoType, caption: p.caption, createdAt: p.createdAt })) });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/work-submissions/:id/items/:itemId", requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getWorkSubmission(req.params.id);
      if (!sub || sub.employeeId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (sub.status !== "draft") return res.status(400).json({ message: "Submission already submitted" });
      const updated = await storage.updateWorkSubmissionItem(req.params.itemId, {
        section: req.body.section,
        subArea: req.body.subArea,
        notes: req.body.notes,
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/work-submissions/:id/items/:itemId", requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getWorkSubmission(req.params.id);
      if (!sub || sub.employeeId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (sub.status !== "draft") return res.status(400).json({ message: "Submission already submitted" });
      await storage.deleteWorkSubmissionItem(req.params.itemId);
      res.status(204).end();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Work submission photo image endpoint
  app.get("/api/work-submission-photos/:photoId/image", requireAuth, async (req, res) => {
    try {
      const photo = await storage.getWorkSubmissionPhoto(req.params.photoId);
      if (!photo) return res.status(404).json({ message: "Not found" });
      const match = photo.fileUrl.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) return res.status(400).json({ message: "Invalid image data" });
      const buffer = Buffer.from(match[2], "base64");
      res.set("Content-Type", match[1]);
      res.set("Cache-Control", "private, max-age=86400");
      res.send(buffer);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Public Share Links ──────────────────────────────────────────────────────
  // Generate / return share token (admin only)
  app.post("/api/work-submissions/:id/share", requireRole("admin"), async (req, res) => {
    try {
      const sub = await storage.getWorkSubmission(req.params.id);
      if (!sub) return res.status(404).json({ message: "Not found" });
      const user = req.user as any;
      if (sub.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });
      // If token already exists, just return it
      if (sub.publicShareToken && sub.publicShareEnabled) {
        const url = `/public/work-report/${sub.publicShareToken}`;
        return res.json({ token: sub.publicShareToken, url });
      }
      const updated = await storage.generateWorkSubmissionShareToken(req.params.id);
      if (!updated) return res.status(500).json({ message: "Failed to generate link" });
      const url = `/public/work-report/${updated.publicShareToken}`;
      res.json({ token: updated.publicShareToken, url });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Public report data (no auth required)
  app.get("/api/public/work-report/:token", async (req, res) => {
    try {
      const sub = await storage.getWorkSubmissionByToken(req.params.token);
      if (!sub || !sub.publicShareEnabled) return res.status(404).json({ message: "Report not found or no longer active" });
      // Load items + photos
      const items = await storage.getWorkSubmissionItems(sub.id);
      const itemIds = items.map(i => i.id);
      const photos = itemIds.length > 0 ? await storage.getWorkSubmissionPhotosByItemIds(itemIds) : [];
      // Load company name
      const company = await storage.getCompany(sub.companyId);
      // Load employee name
      const employee = sub.employeeId ? await storage.getUser(sub.employeeId) : null;
      const employeeName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : "Staff";
      const itemsWithPhotos = items.map(item => ({
        id: item.id,
        section: item.section,
        subArea: item.subArea,
        notes: item.notes,
        sortOrder: item.sortOrder,
        photos: photos
          .filter(p => p.submissionItemId === item.id)
          .map(p => ({ id: p.id, photoType: p.photoType, caption: p.caption })),
      }));
      res.json({
        id: sub.id,
        workDate: sub.workDate,
        submittedAt: sub.submittedAt,
        locationName: sub.locationName,
        status: sub.status,
        companyName: company?.name || "ClockField",
        employeeName,
        items: itemsWithPhotos,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Public photo serving (no auth, validates via token)
  app.get("/api/public/work-report/:token/photos/:photoId", async (req, res) => {
    try {
      const sub = await storage.getWorkSubmissionByToken(req.params.token);
      if (!sub || !sub.publicShareEnabled) return res.status(404).json({ message: "Not found" });
      const photo = await storage.getWorkSubmissionPhoto(req.params.photoId);
      if (!photo) return res.status(404).json({ message: "Not found" });
      // Verify photo belongs to this submission
      const item = await storage.getWorkSubmissionItem(photo.submissionItemId);
      if (!item || item.submissionId !== sub.id) return res.status(403).json({ message: "Forbidden" });
      const match = photo.fileUrl.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) return res.status(400).json({ message: "Invalid image data" });
      const buffer = Buffer.from(match[2], "base64");
      res.set("Content-Type", match[1]);
      res.set("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Admin Plan / Subscription routes ──────────────────────────────────────
  app.get("/api/admin/plan", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });
      const plan = getPlan(company.planCode);
      const [employees, clientsList] = await Promise.all([
        storage.getEmployeesByCompany(user.companyId),
        storage.getClientsByCompany(user.companyId),
      ]);
      res.json({
        plan,
        company: {
          planCode: company.planCode,
          billingCycle: company.billingCycle,
          subscriptionStatus: company.subscriptionStatus,
          accountStatus: company.accountStatus,
          currentPeriodEnd: company.currentPeriodEnd,
          cancelAtPeriodEnd: company.cancelAtPeriodEnd,
          stripeCustomerId: company.stripeCustomerId,
        },
        usage: {
          employees: employees.length,
          clients: clientsList.length,
        },
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/admin/platform-messages", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const messages = await storage.getMessagesForCompany(user.companyId);
      res.json(messages);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/platform-messages/:id/read", requireRole("admin"), async (req, res) => {
    try {
      await storage.markPlatformMessageRead(req.params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Super Admin routes ─────────────────────────────────────────────────────
  app.get("/api/super-admin/stats", requireSuperAdmin, async (req, res) => {
    try {
      const stats = await storage.getPlatformStats();
      res.json(stats);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/super-admin/businesses", requireSuperAdmin, async (req, res) => {
    try {
      const allCompanies = await storage.getAllCompanies();
      const results = await Promise.all(allCompanies.map(async (company) => {
        const [employees, clientsList, admins] = await Promise.all([
          storage.getEmployeesByCompany(company.id),
          storage.getClientsByCompany(company.id),
          storage.getAdminsByCompany(company.id),
        ]);
        const plan = getPlan(company.planCode);
        const primaryAdmin = admins[0];
        return {
          ...company,
          planName: plan.name,
          employeeCount: employees.length,
          clientCount: clientsList.length,
          adminName: primaryAdmin ? `${primaryAdmin.firstName} ${primaryAdmin.lastName}` : "—",
          adminEmail: primaryAdmin?.email ?? "—",
        };
      }));
      res.json(results);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/super-admin/businesses/:id", requireSuperAdmin, async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ message: "Not found" });
      const [employees, clientsList, admins] = await Promise.all([
        storage.getEmployeesByCompany(company.id),
        storage.getClientsByCompany(company.id),
        storage.getAdminsByCompany(company.id),
      ]);
      const plan = getPlan(company.planCode);
      res.json({
        ...company,
        planName: plan.name,
        planConfig: plan,
        employees: employees.map(({ password: _, tempPin: __, ...e }) => e),
        clients: clientsList,
        admins: admins.map(({ password: _, tempPin: __, ...a }) => a),
        usage: {
          employees: employees.length,
          clients: clientsList.length,
          maxEmployees: plan.maxEmployees,
          maxClients: plan.maxClients,
        },
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/super-admin/businesses/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { planCode, billingCycle, accountStatus, subscriptionStatus, suspendedReason, internalBypass } = req.body;
      const updates: Record<string, any> = {};
      if (planCode !== undefined) updates.planCode = planCode;
      if (billingCycle !== undefined) updates.billingCycle = billingCycle;
      if (accountStatus !== undefined) {
        updates.accountStatus = accountStatus;
        if (accountStatus === "suspended") updates.suspendedAt = new Date().toISOString();
        if (accountStatus === "active") { updates.activatedAt = new Date().toISOString(); updates.suspendedAt = null; }
      }
      if (subscriptionStatus !== undefined) updates.subscriptionStatus = subscriptionStatus;
      if (suspendedReason !== undefined) updates.suspendedReason = suspendedReason;
      if (internalBypass !== undefined) updates.internalBypass = !!internalBypass;
      const updated = await storage.updateCompany(req.params.id, updates);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/super-admin/businesses/:id/message", requireSuperAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { subject, body, messageType, isBroadcast } = req.body;
      if (!subject?.trim() || !body?.trim()) return res.status(400).json({ message: "Subject and body are required" });
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ message: "Company not found" });
      const msg = await storage.createPlatformMessage({
        companyId: isBroadcast ? null : req.params.id,
        senderUserId: user.id,
        senderRole: "super_admin",
        subject: subject.trim(),
        body: body.trim(),
        messageType: messageType || "announcement",
        isRead: false,
        isBroadcast: isBroadcast ?? false,
        parentMessageId: null,
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(msg);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/super-admin/messages/broadcast", requireSuperAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { subject, body, messageType } = req.body;
      if (!subject?.trim() || !body?.trim()) return res.status(400).json({ message: "Subject and body are required" });
      const msg = await storage.createPlatformMessage({
        companyId: null,
        senderUserId: user.id,
        senderRole: "super_admin",
        subject: subject.trim(),
        body: body.trim(),
        messageType: messageType || "announcement",
        isRead: false,
        isBroadcast: true,
        parentMessageId: null,
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(msg);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/super-admin/messages", requireSuperAdmin, async (req, res) => {
    try {
      const messages = await storage.getAllPlatformMessages();
      res.json(messages);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Grant/revoke super admin
  app.patch("/api/super-admin/users/:id/super-admin", requireSuperAdmin, async (req, res) => {
    try {
      const { isSuperAdmin } = req.body;
      const updated = await storage.updateUser(req.params.id, { isSuperAdmin: !!isSuperAdmin });
      if (!updated) return res.status(404).json({ message: "Not found" });
      const { password: _, tempPin: __, ...safe } = updated;
      res.json(safe);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Stripe Checkout (Phase 2 - creates checkout session)
  app.post("/api/billing/checkout", requireRole("admin"), async (req, res) => {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(503).json({ message: "Stripe not configured" });
      const { planCode, billingCycle } = req.body;
      const plan = getPlan(planCode);
      if (plan.code === "legacy") return res.status(400).json({ message: "Cannot checkout legacy plan" });

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });

      const user = req.user as any;
      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });

      const priceMap: Record<string, Record<string, string>> = {
        starter: { monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || "", yearly: process.env.STRIPE_PRICE_STARTER_YEARLY || "" },
        growth: { monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY || "", yearly: process.env.STRIPE_PRICE_GROWTH_YEARLY || "" },
        pro: { monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || "", yearly: process.env.STRIPE_PRICE_PRO_YEARLY || "" },
      };

      const priceId = priceMap[planCode]?.[billingCycle];
      if (!priceId) return res.status(400).json({ message: "Price not configured for this plan/cycle" });

      let customerId = company.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: company.name,
          metadata: { companyId: company.id },
        });
        customerId = customer.id;
        await storage.updateCompany(company.id, { stripeCustomerId: customerId });
      }

      const origin = req.headers.origin || `https://${req.headers.host}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/admin/subscription?success=true`,
        cancel_url: `${origin}/admin/subscription?canceled=true`,
        metadata: { companyId: company.id, planCode, billingCycle },
      });

      res.json({ url: session.url });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Stripe Subscription Sync — called by frontend on return from Stripe checkout
  // Fetches live subscription state directly from Stripe and updates the DB immediately.
  // This is the most reliable way to handle post-payment state without relying solely on webhooks.
  app.post("/api/billing/sync", requireRole("admin"), async (req, res) => {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(503).json({ message: "Stripe not configured" });

      const user = req.user as any;
      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });

      if (!company.stripeCustomerId) {
        return res.json({ updated: false, message: "No Stripe customer linked yet" });
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });

      // Fetch the most recent subscription for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: company.stripeCustomerId,
        limit: 1,
        expand: ["data.items.data.price"],
      });

      const sub = subscriptions.data[0];
      if (!sub) {
        return res.json({ updated: false, message: "No subscription found for this customer" });
      }

      // Map price ID → plan code
      const priceToCode: Record<string, string> = {
        [process.env.STRIPE_PRICE_STARTER_MONTHLY || "__"]: "starter",
        [process.env.STRIPE_PRICE_STARTER_YEARLY || "__"]: "starter",
        [process.env.STRIPE_PRICE_GROWTH_MONTHLY || "__"]: "growth",
        [process.env.STRIPE_PRICE_GROWTH_YEARLY || "__"]: "growth",
        [process.env.STRIPE_PRICE_PRO_MONTHLY || "__"]: "pro",
        [process.env.STRIPE_PRICE_PRO_YEARLY || "__"]: "pro",
      };

      const priceId = sub.items.data[0]?.price?.id;
      const planCode = (priceId && priceToCode[priceId]) || company.planCode || "starter";
      const interval = sub.items.data[0]?.price?.recurring?.interval;
      const billingCycle = interval === "year" ? "yearly" : "monthly";

      // Treat active + trialing + past_due (grace period) as allowed; map incomplete → pending
      const normalizedStatus = ["active", "trialing"].includes(sub.status) ? "active"
        : sub.status === "past_due" ? "past_due"
        : sub.status;

      const updates: Record<string, any> = {
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        planCode,
        billingCycle,
        subscriptionStatus: normalizedStatus,
        currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };

      if (["active", "trialing"].includes(sub.status)) {
        updates.accountStatus = "active";
        updates.activatedAt = company.activatedAt || new Date().toISOString();
      }

      await storage.updateCompany(company.id, updates);

      res.json({ updated: true, subscriptionStatus: normalizedStatus, planCode, billingCycle });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Stripe Customer Portal
  app.post("/api/billing/portal", requireRole("admin"), async (req, res) => {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(503).json({ message: "Stripe not configured" });
      const user = req.user as any;
      const company = await storage.getCompany(user.companyId);
      if (!company?.stripeCustomerId) return res.status(400).json({ message: "No Stripe customer linked" });

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });
      const origin = req.headers.origin || `https://${req.headers.host}`;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: company.stripeCustomerId,
        return_url: `${origin}/admin/subscription`,
      });
      res.json({ url: portalSession.url });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Stripe Webhook
  app.post("/api/billing/webhook", async (req, res) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeKey) return res.status(503).json({ message: "Stripe not configured" });

    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });

      let event;
      if (webhookSecret) {
        const sig = req.headers["stripe-signature"] as string;
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        event = req.body;
      }

      const data = event.data?.object as any;
      const companyId = data?.metadata?.companyId;

      const allCompanies = await storage.getAllCompanies();

      const findByCustomer = (customerId: string) =>
        allCompanies.find(c => c.stripeCustomerId === customerId);
      const findBySubscription = (subId: string) =>
        allCompanies.find(c => c.stripeSubscriptionId === subId);

      switch (event.type) {
        case "checkout.session.completed": {
          if (companyId && data.subscription) {
            const sub = await stripe.subscriptions.retrieve(data.subscription);
            const subStatus = ["active", "trialing"].includes(sub.status) ? sub.status : "active";
            await storage.updateCompany(companyId, {
              stripeCustomerId: data.customer || undefined,
              stripeSubscriptionId: sub.id,
              stripePriceId: sub.items.data[0]?.price?.id,
              planCode: data.metadata?.planCode || "starter",
              billingCycle: data.metadata?.billingCycle || "monthly",
              subscriptionStatus: subStatus,
              accountStatus: "active",
              currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
              currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
              activatedAt: new Date().toISOString(),
            });
          }
          break;
        }
        case "customer.subscription.created": {
          const sub = data;
          // Try to find by companyId in metadata, then by customer
          const metaCompanyId = sub.metadata?.companyId;
          const company = metaCompanyId
            ? allCompanies.find(c => c.id === metaCompanyId)
            : findByCustomer(sub.customer);
          if (company) {
            const subStatus = ["active", "trialing"].includes(sub.status) ? sub.status : "active";
            await storage.updateCompany(company.id, {
              stripeSubscriptionId: sub.id,
              stripePriceId: sub.items.data[0]?.price?.id,
              subscriptionStatus: subStatus,
              accountStatus: "active",
              currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
              currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
              activatedAt: new Date().toISOString(),
            });
          }
          break;
        }
        case "customer.subscription.updated": {
          const sub = data;
          const company = findBySubscription(sub.id) || findByCustomer(sub.customer);
          if (company) {
            await storage.updateCompany(company.id, {
              subscriptionStatus: sub.status,
              stripePriceId: sub.items.data[0]?.price?.id,
              currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
              currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            });
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub = data;
          const company = findBySubscription(sub.id) || findByCustomer(sub.customer);
          if (company) {
            await storage.updateCompany(company.id, {
              subscriptionStatus: "canceled",
              cancelAtPeriodEnd: false,
            });
          }
          break;
        }
        case "invoice.payment_failed": {
          const company = findByCustomer(data.customer)
            || (data.subscription ? findBySubscription(data.subscription) : undefined);
          if (company) {
            await storage.updateCompany(company.id, { subscriptionStatus: "past_due" });
          }
          break;
        }
        case "invoice.paid": {
          const company = findByCustomer(data.customer)
            || (data.subscription ? findBySubscription(data.subscription) : undefined);
          if (company) {
            await storage.updateCompany(company.id, {
              subscriptionStatus: "active",
              accountStatus: "active",
            });
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // Run once at startup to migrate any /uploads/ imageUrls to base64 in DB
  void migrateUploadsToBase64();

  return httpServer;
}

