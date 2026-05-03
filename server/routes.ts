import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, pool } from "./db";
import { setupAuth, hashPassword, comparePasswords, requireAuth, requireRole } from "./auth";
import OpenAI from "openai";
import { generateCourseDraft, improveText, generateQuizFromCourse, generateModuleContent, isAIAvailable, type ImproveAction, type ToneOption, type AIQuizQuestion } from "./training-ai";
import { sendPasswordResetEmail, sendReportEmail, sendPlatformMessageEmail, sendAttendanceLateClockInEmail, sendAttendanceMissedShiftEmail, sendAdminNewRequestEmail, sendEmployeeRequestReplyEmail, sendAdminRequestReplyEmail, sendTrialAccountEmail, sendProposalEmail, sendHiringPackageEmail } from "./mail";
import { createHash } from "crypto";
import passport from "passport";
import { randomBytes } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { isNotNull, eq, and, isNull, inArray, desc, sql } from "drizzle-orm";
import { clientRequests, companies, reportAccessTokens, reportSignatures, reports, locations, users, fieldNotesAssets, fieldNotesEntryTags, fieldNotesPublicDocuments, supplies, supplyUpdates, inventoryItems, inventoryPurchases, inventoryMovements, locationSupplyExpenses, trainingPublicLearners, trainingCourses, trainingModules, trainingModuleAssets, trainingQuizzes, trainingQuizQuestions } from "@shared/schema";
import { getPlan } from "./plans";
import { generateReviewOgImage } from "./og-image";

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

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

/** Returns today's date string YYYY-MM-DD in the given IANA timezone */
function todayInTz(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz || "UTC" });
}

/**
 * Format a local time string "YYYY-MM-DDTHH:mm:ss" (already in company timezone)
 * into a human-readable string like "Apr 27, 2026 at 5:00 PM".
 * Never re-converts the timezone — the input is already local.
 */
function formatLocalTimeStr(localStr: string): string {
  const m = localStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return localStr;
  const [, yr, mo, dy, hh, mm] = m;
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthName = MONTHS[parseInt(mo) - 1] ?? mo;
  const h = parseInt(hh);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = (h % 12) || 12;
  return `${monthName} ${parseInt(dy)}, ${yr} at ${h12}:${mm} ${ampm}`;
}

/**
 * Format a UTC ISO string into "Apr 27, 2026 at 5:03 PM" in the given IANA timezone.
 */
function formatUtcInTz(utcStr: string, tz: string): string {
  const d = new Date(utcStr);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(d);
  const p: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") p[part.type] = part.value;
  return `${p.month} ${p.day}, ${p.year} at ${p.hour}:${p.minute} ${p.dayPeriod}`;
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

const logoUpload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PNG, JPG, JPEG, or WEBP files are allowed"));
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

// ── Logo to base64 startup migration ──────────────────────────────────────────
async function migrateLogoToBase64(): Promise<void> {
  try {
    const mimeMap: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
    const rows = await db.select({ id: companies.id, companyLogoUrl: companies.companyLogoUrl })
      .from(companies)
      .where(isNotNull(companies.companyLogoUrl));
    const toMigrate = rows.filter(r => r.companyLogoUrl?.startsWith("/uploads/"));
    if (toMigrate.length === 0) return;
    console.log(`[logo-migration] Migrating ${toMigrate.length} company logo(s) from disk to base64 in DB...`);
    for (const row of toMigrate) {
      const filePath = path.join(process.cwd(), row.companyLogoUrl!);
      if (!fs.existsSync(filePath)) {
        // File is gone (e.g. new deployment) — clear the broken URL
        await db.update(companies).set({ companyLogoUrl: null }).where(eq(companies.id, row.id));
        console.log(`[logo-migration] Cleared missing logo for company ${row.id}`);
        continue;
      }
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = mimeMap[ext] || "image/jpeg";
      const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
      await db.update(companies).set({ companyLogoUrl: dataUrl }).where(eq(companies.id, row.id));
      console.log(`[logo-migration] Converted logo for company ${row.id}`);
    }
    console.log("[logo-migration] Done.");
  } catch (err: any) {
    console.error("[logo-migration] Migration failed:", err.message);
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

  // ── Logo Upload ─────────────────────────────────────────────────────────────
  // Converts to base64 data URL so it's stored directly in the DB — no disk dependency.
  app.post("/api/upload/logo", requireRole("admin"), (req, res) => {
    logoUpload.single("logo")(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ message: "Logo must be under 5 MB" });
        return res.status(400).json({ message: err.message || "Upload failed" });
      }
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ message: "No file uploaded" });
      try {
        const buf = fs.readFileSync(file.path);
        const mimeMap: Record<string, string> = {
          "image/png": "image/png",
          "image/jpeg": "image/jpeg",
          "image/jpg": "image/jpeg",
          "image/webp": "image/webp",
        };
        const mime = mimeMap[file.mimetype] || "image/jpeg";
        const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
        // Clean up the temp file — we don't need it on disk
        try { fs.unlinkSync(file.path); } catch { /* ignore */ }
        res.json({ url: dataUrl });
      } catch (e: any) {
        res.status(500).json({ message: "Failed to process logo" });
      }
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
        createdAt: new Date().toISOString(),
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

      // Create one-time welcome message for the new business
      try {
        await storage.createPlatformMessage({
          companyId: company.id,
          senderUserId: "system",
          senderRole: "super_admin",
          subject: "Welcome to ClockField",
          body: `Welcome to ClockField.

We're excited to have you here.

ClockField is designed to help you run your business more smoothly, stay organized, and save time across your daily operations. From scheduling and attendance to work logs, reports, and team management, everything is built to help you manage your workflow in one place with more confidence.

As you get started, take a few moments to explore the platform and set things up in a way that fits your business best. Our goal is to help you work smarter, present your business professionally, and keep your operations clear and efficient.

If you ever have any questions, concerns, or need support, please email us anytime at support@clockfield.com.

Welcome again, and thank you for choosing ClockField.

— The ClockField Team`,
          messageType: "welcome",
          isRead: false,
          isBroadcast: false,
          createdAt: new Date().toISOString(),
        });
      } catch (_) { /* do not fail registration if welcome message fails */ }

      // Send welcome email (non-blocking — failure must not prevent signup)
      if (user.email) {
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
        import("./mail").then(({ sendWelcomeEmailToBusiness }) =>
          sendWelcomeEmailToBusiness({ to: user.email!, businessName: companyName, appUrl })
            .then(result => storage.createWelcomeEmailDelivery({
              businessId: company.id,
              recipientEmail: user.email!,
              status: "sent",
              mailgunMessageId: result.id || null,
              sentAt: new Date().toISOString(),
              failedAt: null,
              errorMessage: null,
              createdAt: new Date().toISOString(),
            }))
            .catch(err => storage.createWelcomeEmailDelivery({
              businessId: company.id,
              recipientEmail: user.email!,
              status: "failed",
              mailgunMessageId: null,
              sentAt: null,
              failedAt: new Date().toISOString(),
              errorMessage: err.message,
              createdAt: new Date().toISOString(),
            }).catch(() => {}))
        ).catch(() => {});
      }

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
        manualAccessEnabled: company.manualAccessEnabled,
        manualAccessExpiresAt: company.manualAccessExpiresAt,
        manualAccessGrantedBy: company.manualAccessGrantedBy,
        manualAccessReason: company.manualAccessReason,
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

  // ── Forgot / Reset Password ────────────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req, res) => {
    const GENERIC = "If an account exists for that email, we sent a reset link.";
    try {
      const rawEmail: string = (req.body.email || "").trim().toLowerCase();
      if (!rawEmail) return res.json({ message: GENERIC });

      const user = await storage.getUserByEmail(rawEmail);
      if (!user || user.role === "employee") return res.json({ message: GENERIC });
      if (!user.isActive) return res.json({ message: GENERIC });

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

      await storage.invalidatePasswordResetTokensForUser(user.id);
      await storage.createPasswordResetToken({
        userId: user.id,
        email: rawEmail,
        tokenHash,
        expiresAt,
        ipAddress: req.ip || undefined,
        userAgent: req.headers["user-agent"] || undefined,
      });

      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

      await sendPasswordResetEmail({
        to: rawEmail,
        resetUrl,
        firstName: user.firstName,
      });
    } catch (err) {
      console.error("forgot-password error:", err);
    }
    res.json({ message: "If an account exists for that email, we sent a reset link." });
  });

  app.get("/api/auth/reset-password/validate", async (req, res) => {
    try {
      const rawToken = (req.query.token as string || "").trim();
      if (!rawToken) return res.json({ valid: false, reason: "missing" });
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const record = await storage.getPasswordResetTokenByHash(tokenHash);
      if (!record) return res.json({ valid: false, reason: "invalid" });
      if (record.usedAt) return res.json({ valid: false, reason: "used" });
      if (new Date(record.expiresAt) < new Date()) return res.json({ valid: false, reason: "expired" });
      return res.json({ valid: true });
    } catch {
      return res.json({ valid: false, reason: "error" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const rawToken = (req.body.token || "").trim();
      const newPassword = req.body.newPassword || "";
      if (!rawToken || !newPassword) return res.status(400).json({ message: "Missing required fields." });
      if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const record = await storage.getPasswordResetTokenByHash(tokenHash);
      if (!record) return res.status(400).json({ message: "This reset link is invalid or has already been used." });
      if (record.usedAt) return res.status(400).json({ message: "This reset link has already been used." });
      if (new Date(record.expiresAt) < new Date()) return res.status(400).json({ message: "This reset link has expired. Please request a new one." });

      const hashed = await hashPassword(newPassword);
      await storage.updateUser(record.userId, { password: hashed });
      await storage.markPasswordResetTokenUsed(record.id);
      await storage.invalidatePasswordResetTokensForUser(record.userId);

      return res.json({ message: "Password reset successfully. You can now sign in." });
    } catch (err) {
      console.error("reset-password error:", err);
      return res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });
  // ──────────────────────────────────────────────────────────────────────────

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
      if (err.message?.includes("users_email_unique") || err.code === "23505") {
        return res.status(409).json({ message: "This email address is already in use by another account. Please use a different email or leave the email field blank." });
      }
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/employees/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getUser(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const { password: _p, tempPin: _t, employeeId: _e, accountStatus: _a, loginEnabled: _l, mustChangePassword: _m, ...allowedFields } = req.body;
      const toNum = (v: any) => {
        if (v === "" || v === undefined || v === null) return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      };
      if ("hourlyRate" in allowedFields) allowedFields.hourlyRate = toNum(allowedFields.hourlyRate);
      if ("overtimeRate" in allowedFields) allowedFields.overtimeRate = toNum(allowedFields.overtimeRate);
      // Skip email update if unchanged (prevents unnecessary uniqueness re-check)
      if ("email" in allowedFields) {
        const incoming = (allowedFields.email || "").trim().toLowerCase();
        const existing = (target.email || "").trim().toLowerCase();
        if (incoming === existing) delete allowedFields.email;
        else if (!incoming) allowedFields.email = null;
      }
      const employee = await storage.updateUser(req.params.id, allowedFields);
      if (!employee) return res.status(404).json({ message: "Not found" });
      const { password: _, tempPin: __, ...safe } = employee;
      res.json(safe);
    } catch (err: any) {
      if (err.message?.includes("users_email_unique") || err.code === "23505") {
        return res.status(409).json({ message: "This email address is already in use by another account. Please use a different email." });
      }
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

  // ── Employee Documents (admin) ───────────────────────────────────────────
  // List documents for an employee (no fileData payload)
  app.get("/api/employees/:id/documents", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getUser(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const docs = await storage.listEmployeeDocuments(req.params.id, user.companyId);
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Upload a document. Body: { name, category?, mimeType, sizeBytes, fileData (base64), notes? }
  app.post("/api/employees/:id/documents", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getUser(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const { name, category, mimeType, fileData, notes } = req.body || {};
      if (!name || typeof name !== "string") return res.status(400).json({ message: "Document name is required" });
      if (!mimeType || typeof mimeType !== "string") return res.status(400).json({ message: "File type is required" });
      if (!fileData || typeof fileData !== "string") return res.status(400).json({ message: "File data is required" });
      // Compute actual decoded size from the base64 payload — never trust a
      // client-supplied sizeBytes (it could be falsified to bypass the cap).
      const padding = (fileData.endsWith("==") ? 2 : fileData.endsWith("=") ? 1 : 0);
      const size = Math.max(0, Math.floor(fileData.length * 3 / 4) - padding);
      // 30MB cap — base64 inflates ~33%, server body limit is 50MB.
      if (size > 30 * 1024 * 1024) return res.status(413).json({ message: "File is too large. Maximum size is 30MB." });
      const doc = await storage.createEmployeeDocument({
        companyId: user.companyId,
        employeeId: req.params.id,
        name: name.trim(),
        category: typeof category === "string" && category ? category : "other",
        mimeType,
        sizeBytes: size,
        fileData,
        notes: typeof notes === "string" ? notes : null,
        uploadedBy: user.id,
        uploadedAt: new Date().toISOString(),
      } as any);
      const { fileData: _omit, ...safe } = doc as any;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get a single document including fileData (used to view/download)
  app.get("/api/employees/:id/documents/:docId", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getUser(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const doc = await storage.getEmployeeDocument(req.params.docId, user.companyId);
      if (!doc || doc.employeeId !== req.params.id) return res.status(404).json({ message: "Not found" });
      res.json(doc);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Delete a document
  app.delete("/api/employees/:id/documents/:docId", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getUser(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      // Resolve the doc first and confirm it belongs to BOTH this employee AND
      // this tenant. Without the employeeId check, an admin could delete a doc
      // belonging to a different employee in the same company by guessing docId.
      const doc = await storage.getEmployeeDocument(req.params.docId, user.companyId);
      if (!doc || doc.employeeId !== req.params.id) return res.status(404).json({ message: "Not found" });
      const ok = await storage.deleteEmployeeDocument(req.params.docId, user.companyId);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Per-Employee Training Summary (admin read-only) ──────────────────────
  app.get("/api/employees/:id/training", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getUser(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const summary = await storage.getEmployeeTrainingSummary(req.params.id, user.companyId);
      res.json(summary);
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
      const { firstName, lastName, email, phone, tempPin: customPin, managementRole, sendEmailInvite } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      if (!firstName || !lastName) return res.status(400).json({ message: "Full name is required" });

      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(400).json({ message: "A user with this email already exists" });

      const pin = customPin && customPin.length >= 4 ? customPin : generateTempPin();
      const hashedPin = await hashPassword(pin);

      // Generate invite token if email invite requested
      const inviteToken = sendEmailInvite ? randomBytes(32).toString("hex") : null;
      const inviteExpiresAt = inviteToken ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : null;

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
        managementRole: managementRole || "admin",
        inviteToken: inviteToken || null,
        inviteExpiresAt,
        inviteStatus: "not_sent",
      } as any);

      // Send invite email (non-blocking)
      let inviteEmailStatus = "not_sent";
      if (sendEmailInvite && inviteToken && admin.email) {
        try {
          const company = await storage.getCompany(user.companyId);
          const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
          const inviteUrl = `${appUrl}/accept-invite/${inviteToken}`;
          const { sendManagementInviteEmail } = await import("./mail");
          await sendManagementInviteEmail({
            to: admin.email,
            firstName: admin.firstName,
            companyName: company?.name || "your company",
            role: managementRole || "admin",
            inviteUrl,
          });
          await storage.updateUser(admin.id, { inviteStatus: "sent", inviteSentAt: new Date().toISOString() } as any);
          inviteEmailStatus = "sent";
        } catch (_err) {
          await storage.updateUser(admin.id, { inviteStatus: "failed" } as any).catch(() => {});
          inviteEmailStatus = "failed";
        }
      }

      const { password: _, tempPin: __, ...safe } = admin;
      res.json({ ...safe, tempPin: pin, inviteEmailStatus });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Resend invite
  app.post("/api/admins/:id/resend-invite", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getUser(req.params.id);
      if (!target || target.companyId !== user.companyId || target.role !== "admin") {
        return res.status(404).json({ message: "Not found" });
      }
      if (!target.email) return res.status(400).json({ message: "No email on file" });

      const inviteToken = randomBytes(32).toString("hex");
      const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await storage.updateUser(target.id, { inviteToken, inviteExpiresAt, inviteStatus: "sent", inviteSentAt: new Date().toISOString() } as any);

      const company = await storage.getCompany(user.companyId);
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const inviteUrl = `${appUrl}/accept-invite/${inviteToken}`;
      try {
        const { sendManagementInviteEmail } = await import("./mail");
        await sendManagementInviteEmail({
          to: target.email,
          firstName: target.firstName,
          companyName: company?.name || "your company",
          role: (target as any).managementRole || "admin",
          inviteUrl,
        });
        res.json({ ok: true, inviteStatus: "sent" });
      } catch (err: any) {
        await storage.updateUser(target.id, { inviteStatus: "failed" } as any).catch(() => {});
        res.status(500).json({ message: "Email failed", inviteStatus: "failed" });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Accept invite page (public — no auth required)
  app.get("/api/invite/accept/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const result = await db.select().from(users).where(eq(users.inviteToken, token)).limit(1);
      const target = result?.[0];
      if (!target) return res.status(404).json({ message: "Invite not found or already used" });
      if (target.inviteAcceptedAt) return res.status(400).json({ message: "Invite already accepted" });
      if (target.inviteExpiresAt && new Date(target.inviteExpiresAt) < new Date()) {
        return res.status(400).json({ message: "Invite has expired" });
      }
      const company = await storage.getCompany(target.companyId);
      res.json({
        valid: true,
        firstName: target.firstName,
        lastName: target.lastName,
        email: target.email,
        managementRole: (target as any).managementRole || "admin",
        companyName: company?.name || "",
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Accept invite — set password from invite link
  app.post("/api/invite/accept/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;
      if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

      const result = await db.select().from(users).where(eq(users.inviteToken, token)).limit(1);
      const target = result?.[0];
      if (!target) return res.status(404).json({ message: "Invite not found" });
      if (target.inviteAcceptedAt) return res.status(400).json({ message: "Invite already accepted" });
      if (target.inviteExpiresAt && new Date(target.inviteExpiresAt) < new Date()) {
        return res.status(400).json({ message: "Invite has expired" });
      }

      const hashedPassword = await hashPassword(password);
      await storage.updateUser(target.id, {
        password: hashedPassword,
        mustChangePassword: false,
        accountStatus: "active",
        inviteToken: null,
        inviteAcceptedAt: new Date().toISOString(),
        inviteStatus: "accepted",
      } as any);

      res.json({ ok: true, email: target.email });
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
      // Normalize empty companyLogoUrl to null so we don't store blank strings
      if ("companyLogoUrl" in req.body && !req.body.companyLogoUrl) {
        req.body.companyLogoUrl = null;
      }
      if (req.body.timezone) {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: req.body.timezone });
        } catch {
          return res.status(400).json({ message: "Invalid timezone value" });
        }
      }
      if (req.body.googleReviewUrl !== undefined) {
        const raw = (req.body.googleReviewUrl || "").trim();
        if (raw === "") {
          req.body.googleReviewUrl = null;
        } else {
          let parsed: URL;
          try { parsed = new URL(raw); } catch {
            return res.status(400).json({ message: "Invalid Google review URL. Please enter a valid https link." });
          }
          if (parsed.protocol !== "https:") {
            return res.status(400).json({ message: "Google review URL must use https." });
          }
          const allowed = ["google.com", "www.google.com", "g.page", "goo.gl", "maps.google.com", "maps.app.goo.gl"];
          const isGoogle = allowed.some(h => parsed.hostname === h || parsed.hostname.endsWith("." + h));
          if (!isGoogle) {
            return res.status(400).json({ message: "Please enter a valid Google Business review link (e.g. google.com or g.page)." });
          }
          req.body.googleReviewUrl = raw;
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
      const company = await storage.getCompany(user.companyId);
      const today = todayInTz(company?.timezone || "UTC");
      const [employees, todayShifts, allEntries, openRequests] = await Promise.all([
        storage.getEmployeesByCompany(user.companyId),
        storage.getShiftsByDate(user.companyId, today),
        storage.getTimeEntriesByCompany(user.companyId),
        storage.getClientRequestsByCompany(user.companyId),
      ]);
      const activeEntries = allEntries.filter(e => e.status === "active");
      const tz = company?.timezone || "UTC";
      const now = Date.now();
      // lateToday: time entries with late_clock_in flag from today — exactly what the attendance
      // page shows when filtered to Today + Late Clock-in, so dashboard and click-through match.
      // We convert each clockInAt timestamp into company-local date to avoid UTC day-boundary skew.
      const todayEntries = allEntries.filter(e => {
        try {
          return new Date(e.clockInAt).toLocaleDateString("en-CA", { timeZone: tz }) === today;
        } catch { return false; }
      });
      const lateToday = todayEntries.filter(e =>
        Array.isArray(e.flags) && e.flags.includes("late_clock_in")
      ).length;
      // missedToday: scheduled shifts today where no clock-in has occurred and the shift start
      // is more than 30 minutes in the past (prevents premature counting).
      const MISSED_THRESHOLD_MS = 30 * 60 * 1000;
      const clockedInShiftIds = new Set(
        allEntries.filter(e => {
          try { return new Date(e.clockInAt).toLocaleDateString("en-CA", { timeZone: tz }) === today; }
          catch { return false; }
        }).map(e => e.shiftId).filter(Boolean)
      );
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

      let entries: any[];
      if (user.role === "admin") {
        if (employeeId && typeof employeeId === "string") {
          entries = await storage.getTimeEntriesByEmployee(employeeId);
        } else {
          entries = await storage.getTimeEntriesByCompany(user.companyId);
        }
        const adjustments = await storage.getAttendanceAdjustmentsByCompany(user.companyId);
        const adjMap = new Map<string, number>();
        for (const adj of adjustments) {
          adjMap.set(adj.timeEntryId, (adjMap.get(adj.timeEntryId) || 0) + adj.adjustmentMinutes);
        }
        entries = entries.map(e => ({ ...e, totalAdjustmentMinutes: adjMap.get(e.id) || 0 }));
      } else if (user.role === "employee") {
        entries = await storage.getTimeEntriesByEmployee(user.id);
        const empAdj = await storage.getAttendanceAdjustmentsByEmployee(user.id);
        const empAdjMap = new Map<string, { minutes: number; reasons: string[] }>();
        for (const adj of empAdj) {
          const cur = empAdjMap.get(adj.timeEntryId) || { minutes: 0, reasons: [] };
          cur.minutes += adj.adjustmentMinutes;
          if (adj.reason && !cur.reasons.includes(adj.reason)) cur.reasons.push(adj.reason);
          empAdjMap.set(adj.timeEntryId, cur);
        }
        entries = entries.map(e => {
          const adj = empAdjMap.get(e.id);
          return {
            ...e,
            totalAdjustmentMinutes: adj ? adj.minutes : 0,
            adjustmentReasons: adj ? adj.reasons : [],
          };
        });
      } else {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(entries);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/time-entries/:id/adjustments", requireRole("admin"), async (req, res) => {
    try {
      const adjustments = await storage.getAttendanceAdjustmentsByEntry(req.params.id);
      res.json(adjustments);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/time-entries/:id/adjustments", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const entry = await storage.getTimeEntry(req.params.id);
      if (!entry || entry.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const { adjustmentMinutes, reason, note } = req.body;
      if (typeof adjustmentMinutes !== "number" || adjustmentMinutes === 0) {
        return res.status(400).json({ message: "adjustmentMinutes must be a non-zero integer" });
      }
      if (!reason || typeof reason !== "string" || !reason.trim()) {
        return res.status(400).json({ message: "reason is required" });
      }
      const adj = await storage.createAttendanceAdjustment({
        companyId: user.companyId,
        timeEntryId: entry.id,
        employeeId: entry.employeeId,
        adjustmentMinutes,
        reason: reason.trim(),
        note: note?.trim() || null,
        createdByUserId: user.id,
        createdAt: new Date().toISOString(),
        isVoided: false,
        voidedByUserId: null,
        voidedAt: null,
      });
      res.json(adj);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/attendance-adjustments/:id/void", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const adj = await storage.getAttendanceAdjustmentById(req.params.id);
      if (!adj || adj.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (adj.isVoided) return res.status(400).json({ message: "Already voided" });
      const voided = await storage.voidAttendanceAdjustment(req.params.id, user.id);
      res.json(voided);
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
      // Send late clock-in email alert if enabled
      if (flags.includes("late_clock_in") && shift) {
        try {
          const alertCompany = await storage.getCompany(user.companyId);
          if (alertCompany?.alertLateClockIn) {
            const admins = await storage.getAdminsByCompany(user.companyId);
            const primaryAdmin = admins[0];
            if (primaryAdmin?.email) {
              // Use company timezone as source of truth; fall back to Winnipeg
              const alertTz = alertCompany.timezone || "America/Winnipeg";

              // scheduledStartAt is stored as a local time string "YYYY-MM-DDTHH:mm:ss"
              // — format it directly without any timezone re-conversion
              const scheduledStart = shift.scheduledStartAt
                ? formatLocalTimeStr(shift.scheduledStartAt)
                : "N/A";

              // clockInAt (now) is a UTC ISO string — convert to company local time
              const actualClockIn = formatUtcInTz(now, alertTz);

              // Minutes late: convert both sides to local time strings, then diff.
              // Appending "Z" to both treats them as UTC so Date arithmetic is consistent.
              const clockInLocalStr = utcToLocalIso(now, alertTz);
              const minutesLate = Math.max(0, Math.round(
                (new Date(clockInLocalStr + "Z").getTime() - new Date(shift.scheduledStartAt + "Z").getTime()) / 60000
              ));

              // Deep-link to the exact employee + local business date
              const businessDate = todayInTz(alertTz);
              const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
              const attendanceUrl = `${appUrl}/admin/attendance?employeeId=${user.id}&date=${businessDate}`;

              const location = shift.locationId ? await storage.getLocation(shift.locationId) : null;
              await sendAttendanceLateClockInEmail({
                to: primaryAdmin.email,
                adminName: `${primaryAdmin.firstName} ${primaryAdmin.lastName}`,
                employeeName: `${user.firstName} ${user.lastName}`,
                locationName: location?.name,
                scheduledStart,
                actualClockIn,
                minutesLate,
                attendanceUrl,
              }).catch(e => console.error("[late-alert] Email failed:", e.message));
            }
          }
        } catch (alertErr: any) {
          console.error("[late-alert] Error checking alert settings:", alertErr.message);
        }
      }
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

      // Fire-and-forget email to admin(s) when employee or client submits a request
      if (user.role !== "admin") {
        const requesterName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Staff";
        const hasAttachments = !!(photos && photos.length > 0);
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
        (async () => {
          try {
            const [admins, company] = await Promise.all([
              storage.getAdminsByCompany(user.companyId),
              storage.getCompany(user.companyId),
            ]);
            for (const admin of admins) {
              if (!admin.email) continue;
              await sendAdminNewRequestEmail({
                adminEmail: admin.email,
                adminName: `${admin.firstName || ""} ${admin.lastName || ""}`.trim() || "Admin",
                requesterName,
                requesterRole: user.role,
                requestTitle: request.title,
                requestType: request.requestType,
                priority: request.priority,
                businessName: company?.name || "Your business",
                submittedAt: new Date().toLocaleString("en-CA"),
                hasAttachments,
                messagePreview: description?.trim() || null,
                appUrl,
              });
            }
          } catch (emailErr) {
            console.error("[request-email] Failed to notify admin of new request:", emailErr);
          }
        })();
      }
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

  // ── Admin → Cleaner Requests ─────────────────────────────────────────────
  app.post("/api/admin/cleaner-requests", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const {
        assignedCleanerId, title, requestType, description, complaintDetails,
        requestedAction, locationId, priority, requiresReplyBeforeClockOut, photos,
      } = req.body;
      if (!assignedCleanerId) return res.status(400).json({ message: "Assigned cleaner is required" });
      if (!title?.trim()) return res.status(400).json({ message: "Title is required" });

      const now = new Date().toISOString();
      const request = await storage.createClientRequest({
        companyId: user.companyId,
        clientId: undefined,
        employeeId: assignedCleanerId,
        createdByUserId: user.id,
        createdByRole: "admin",
        title: title.trim(),
        description: [description, complaintDetails, requestedAction].filter(Boolean).join("\n\n") || null,
        requestType: requestType || "complaint_followup",
        priority: priority || "normal",
        status: "new",
        visibilityScope: "admin_and_employee",
        requiresReplyBeforeClockOut: !!requiresReplyBeforeClockOut,
        createdAt: now,
      } as any);

      // Store request body as initial message with photos
      const msgBody = [description, complaintDetails ? `Issue: ${complaintDetails}` : null, requestedAction ? `Required action: ${requestedAction}` : null].filter(Boolean).join("\n\n");
      const msg = await storage.createRequestMessage({
        requestId: request.id,
        authorUserId: user.id,
        authorRole: "admin",
        body: msgBody || null,
        messageType: "initial_request",
        isVisibleToClient: false,
        isVisibleToEmployee: true,
        isStatusUpdate: false,
        statusValue: null,
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
      res.status(201).json(request);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Mark cleaner viewed
  app.post("/api/client-requests/:id/mark-viewed", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getClientRequest(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (user.role !== "employee" || target.employeeId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (!target.cleanerViewedAt) {
        await storage.updateClientRequest(req.params.id, { cleanerViewedAt: new Date().toISOString() } as any);
      }
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Mark admin read reply
  app.post("/api/client-requests/:id/mark-admin-read", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const target = await storage.getClientRequest(req.params.id);
      if (!target || target.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.updateClientRequest(req.params.id, { adminReadReplyAt: new Date().toISOString() } as any);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Employee: get admin-assigned requests pending clock-out check
  app.get("/api/employee/cleaner-requests/clock-out-check", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== "employee") return res.status(403).json({ message: "Forbidden" });
      const all = await storage.getClientRequestsByEmployee(user.id);
      const pending = all.filter((r: any) =>
        r.createdByRole === "admin" &&
        r.requiresReplyBeforeClockOut &&
        !["closed", "resolved"].includes(r.status) &&
        r.status !== "replied"
      );
      res.json({ hasPending: pending.length > 0, count: pending.length, requests: pending });
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
        if (user.role === "employee" && target.createdByRole === "admin") {
          // Employee replying to an admin-assigned request → mark as "replied"
          await storage.updateClientRequest(req.params.id, { status: "replied", updatedAt: now } as any);
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

      // Fire-and-forget email to the request creator when admin replies
      if (user.role === "admin" && !isStatusUpdate && target.createdByUserId && target.createdByRole !== "admin") {
        const replyBody = body?.trim() || null;
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
        (async () => {
          try {
            const [requester, company] = await Promise.all([
              storage.getUser(target.createdByUserId!),
              storage.getCompany(user.companyId),
            ]);
            if (requester?.email) {
              await sendEmployeeRequestReplyEmail({
                to: requester.email,
                recipientName: `${requester.firstName || ""} ${requester.lastName || ""}`.trim() || "there",
                requestTitle: target.title,
                replyPreview: replyBody,
                businessName: company?.name || "Your admin",
                repliedAt: new Date().toLocaleString("en-CA"),
                appUrl,
              });
            }
          } catch (emailErr) {
            console.error("[request-email] Failed to notify requester of admin reply:", emailErr);
          }
        })();
      } else if (user.role !== "admin" && !isStatusUpdate && body?.trim()) {
        // Fire-and-forget email to all company admins when employee/client replies
        const replyBody = body.trim();
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
        (async () => {
          try {
            const [admins, company, replier] = await Promise.all([
              storage.getAdminsByCompany(target.companyId),
              storage.getCompany(target.companyId),
              storage.getUser(user.id),
            ]);
            const replierName = replier
              ? `${replier.firstName || ""} ${replier.lastName || ""}`.trim() || replier.email || "Staff"
              : "Staff";
            const replierRole = user.role === "client" ? "client" : "employee";
            for (const admin of admins) {
              if (!admin.email) continue;
              await sendAdminRequestReplyEmail({
                to: admin.email,
                adminName: `${admin.firstName || ""} ${admin.lastName || ""}`.trim() || "Admin",
                replierName,
                replierRole,
                requestTitle: target.title,
                replyPreview: replyBody,
                businessName: company?.name || "Your company",
                repliedAt: new Date().toLocaleString("en-CA"),
                appUrl,
              });
            }
          } catch (emailErr) {
            console.error("[request-email] Failed to notify admin of employee/client reply:", emailErr);
          }
        })();
      }
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
      const company = await storage.getCompany(user.companyId);
      const today = todayInTz(company?.timezone || "UTC");
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

  // ── Public timezone endpoint (any authenticated user) ─────────────────────
  app.get("/api/settings/timezone", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const company = await storage.getCompany(user.companyId);
      res.json({ timezone: company?.timezone || "UTC" });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Employee locations (for work submission location selection) ───────────
  app.get("/api/employee/locations", requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const company = await storage.getCompany(user.companyId);
      const today = todayInTz(company?.timezone || "UTC");
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
        const reviewIds = await storage.getSubmissionIdsWithReviews(user.companyId);
        res.json(subs.map(s => ({ ...s, hasReview: reviewIds.has(s.id) })));
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
      // Auto-resolve open priority alerts for this location when work is submitted
      if (req.body.status === "submitted" && sub.locationId) {
        try { await storage.resolveAlertsForLocation(sub.locationId, sub.companyId, sub.id); } catch {}
      }
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
      // Save photos in parallel
      const beforePhotos: string[] = req.body.beforePhotos || [];
      const afterPhotos: string[] = req.body.afterPhotos || [];
      await Promise.all([
        ...beforePhotos.map(fileUrl => storage.createWorkSubmissionPhoto({ submissionItemId: item.id, photoType: "before", fileUrl, caption: null, createdAt: now })),
        ...afterPhotos.map(fileUrl => storage.createWorkSubmissionPhoto({ submissionItemId: item.id, photoType: "after", fileUrl, caption: null, createdAt: now })),
      ]);
      await storage.updateWorkSubmission(sub.id, { updatedAt: now });
      const photos = await storage.getWorkSubmissionPhotosByItem(item.id);
      res.status(201).json({ ...item, photos: photos.map(p => ({ id: p.id, photoType: p.photoType, caption: p.caption, createdAt: p.createdAt })) });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Convert a priority alert into a priority work area (copies alert photos as before photos)
  app.post("/api/work-submissions/:id/items/from-priority/:alertId", requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getWorkSubmission(req.params.id);
      if (!sub) return res.status(404).json({ message: "Not found" });
      if (sub.employeeId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (sub.status !== "draft") return res.status(400).json({ message: "Submission already submitted" });
      // Prevent duplicate conversion
      const existingItems = await storage.getWorkSubmissionItems(sub.id);
      const existing = existingItems.find((i: any) => i.priorityAlertId === req.params.alertId);
      if (existing) {
        const photos = await storage.getWorkSubmissionPhotosByItem(existing.id);
        return res.json({ ...existing, photos: photos.map(p => ({ id: p.id, photoType: p.photoType, caption: p.caption, createdAt: p.createdAt })) });
      }
      // Validate alert
      const alert = await storage.getPriorityCleanAlert(req.params.alertId);
      if (!alert || alert.companyId !== user.companyId) return res.status(404).json({ message: "Alert not found" });
      const now = new Date().toISOString();
      // Create the priority work item sorted to the top (sortOrder = -1)
      const item = await storage.createWorkSubmissionItem({
        submissionId: sub.id,
        section: "Priority Required Clean",
        subArea: alert.title,
        notes: null,
        sortOrder: -1,
        priorityAlertId: req.params.alertId,
        createdAt: now,
      } as any);
      // Copy alert photos as before photos
      const alertPhotos = await storage.getPriorityCleanPhotosByAlertId(req.params.alertId);
      await Promise.all(alertPhotos.map(p =>
        storage.createWorkSubmissionPhoto({ submissionItemId: item.id, photoType: "before", fileUrl: p.fileUrl, caption: null, createdAt: now })
      ));
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
      const now = new Date().toISOString();
      const updated = await storage.updateWorkSubmissionItem(req.params.itemId, { notes: req.body.notes });
      // Add new photos and remove old ones in parallel
      const addBefore: string[] = req.body.addBeforePhotos || [];
      const addAfter: string[] = req.body.addAfterPhotos || [];
      const removeIds: string[] = req.body.removePhotoIds || [];
      await Promise.all([
        ...addBefore.map(fileUrl => storage.createWorkSubmissionPhoto({ submissionItemId: req.params.itemId, photoType: "before", fileUrl, caption: null, createdAt: now })),
        ...addAfter.map(fileUrl => storage.createWorkSubmissionPhoto({ submissionItemId: req.params.itemId, photoType: "after", fileUrl, caption: null, createdAt: now })),
        ...removeIds.map(photoId => storage.deleteWorkSubmissionPhoto(photoId)),
      ]);
      await storage.updateWorkSubmission(sub.id, { updatedAt: now });
      const photos = await storage.getWorkSubmissionPhotosByItem(req.params.itemId);
      res.json({ ...updated, photos: photos.map(p => ({ id: p.id, photoType: p.photoType, caption: p.caption, createdAt: p.createdAt })) });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Admin-only: edit submitted item notes and photos ──────────────────────
  app.patch("/api/admin/work-submissions/:id/items/:itemId", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getWorkSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });
      const now = new Date().toISOString();
      const updated = await storage.updateWorkSubmissionItem(req.params.itemId, { notes: req.body.notes ?? null });
      const addBefore: string[] = req.body.addBeforePhotos || [];
      const addAfter: string[] = req.body.addAfterPhotos || [];
      const removeIds: string[] = req.body.removePhotoIds || [];
      await Promise.all([
        ...addBefore.map(fileUrl => storage.createWorkSubmissionPhoto({ submissionItemId: req.params.itemId, photoType: "before", fileUrl, caption: null, createdAt: now })),
        ...addAfter.map(fileUrl => storage.createWorkSubmissionPhoto({ submissionItemId: req.params.itemId, photoType: "after", fileUrl, caption: null, createdAt: now })),
        ...removeIds.map(photoId => storage.deleteWorkSubmissionPhoto(photoId)),
      ]);
      await storage.updateWorkSubmission(sub.id, { updatedAt: now });
      const photos = await storage.getWorkSubmissionPhotosByItem(req.params.itemId);
      res.json({ ...updated, photos: photos.map(p => ({ id: p.id, photoType: p.photoType, caption: p.caption, createdAt: p.createdAt })) });
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

  // ── Priority Clean Alerts ───────────────────────────────────────────────────
  app.post("/api/priority-alerts", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { title, message, locationId, visibleOnPublicLink, photos, assignedEmployeeId } = req.body;
      if (!title || !title.trim()) return res.status(400).json({ message: "Title is required" });
      if (!assignedEmployeeId) return res.status(400).json({ message: "Employee is required" });
      // Verify the employee belongs to this company
      const assignedEmp = await storage.getUser(assignedEmployeeId);
      if (!assignedEmp || assignedEmp.companyId !== user.companyId) return res.status(400).json({ message: "Invalid employee" });
      const now = new Date().toISOString();
      const alert = await storage.createPriorityCleanAlert({
        companyId: user.companyId,
        locationId: locationId || null,
        submissionId: null,
        title: title.trim(),
        message: message ? message.trim() : null,
        status: "open",
        visibleOnPublicLink: visibleOnPublicLink !== false,
        assignedEmployeeId: assignedEmployeeId,
        resolvedAt: null,
        createdByUserId: user.id,
        createdAt: now,
        updatedAt: now,
      });
      if (Array.isArray(photos) && photos.length > 0) {
        await Promise.all(photos.map((fileUrl: string) =>
          storage.createPriorityCleanPhoto({ alertId: alert.id, fileUrl, createdAt: now })
        ));
      }
      res.status(201).json(alert);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/priority-alerts", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const alerts = await storage.getPriorityCleanAlertsByCompany(user.companyId);
      const allPhotos = await Promise.all(alerts.map(a => storage.getPriorityCleanPhotosByAlertId(a.id)));
      const result = alerts.map((a, i) => ({
        ...a,
        photos: allPhotos[i].map(p => ({ id: p.id })),
      }));
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/priority-alerts/location/:locationId", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const alerts = await storage.getOpenPriorityCleanAlertsByLocation(req.params.locationId, user.companyId, user.id);
      const allPhotos = await Promise.all(alerts.map(a => storage.getPriorityCleanPhotosByAlertId(a.id)));
      const result = alerts.map((a, i) => ({
        ...a,
        photos: allPhotos[i].map(p => ({ id: p.id })),
      }));
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/priority-alerts/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const alert = await storage.getPriorityCleanAlert(req.params.id);
      if (!alert || alert.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updates: any = {};
      if (req.body.status !== undefined) {
        updates.status = req.body.status;
        if (req.body.status === "resolved" && !alert.resolvedAt) updates.resolvedAt = new Date().toISOString();
      }
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.message !== undefined) updates.message = req.body.message;
      if (req.body.visibleOnPublicLink !== undefined) updates.visibleOnPublicLink = req.body.visibleOnPublicLink;
      const updated = await storage.updatePriorityCleanAlert(req.params.id, updates);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/priority-alerts/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const alert = await storage.getPriorityCleanAlert(req.params.id);
      if (!alert || alert.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.deletePriorityCleanAlert(req.params.id);
      res.status(204).end();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/priority-alert-photos/:photoId/image", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const photo = await storage.getPriorityCleanPhoto(req.params.photoId);
      if (!photo) return res.status(404).json({ message: "Not found" });
      const alert = await storage.getPriorityCleanAlert(photo.alertId);
      if (!alert || alert.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });
      const match = photo.fileUrl.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) return res.status(400).json({ message: "Invalid image data" });
      const buffer = Buffer.from(match[2], "base64");
      res.set("Content-Type", match[1]);
      res.set("Cache-Control", "private, max-age=86400");
      res.send(buffer);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/public/priority-alert-photos/:photoId/image", async (req, res) => {
    try {
      const photo = await storage.getPriorityCleanPhoto(req.params.photoId);
      if (!photo) return res.status(404).json({ message: "Not found" });
      const alert = await storage.getPriorityCleanAlert(photo.alertId);
      if (!alert || !alert.visibleOnPublicLink) return res.status(403).json({ message: "Forbidden" });
      const match = photo.fileUrl.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) return res.status(400).json({ message: "Invalid image data" });
      const buffer = Buffer.from(match[2], "base64");
      res.set("Content-Type", match[1]);
      res.set("Cache-Control", "public, max-age=86400");
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
      // If token already exists, just return it (generate short code if missing without touching long token)
      if (sub.publicShareToken && sub.publicShareEnabled) {
        let shortCode = sub.reportShortCode;
        if (!shortCode) {
          const updated = await storage.generateReportShortCodeOnly(req.params.id);
          shortCode = updated?.reportShortCode || null;
        }
        const shortUrl = shortCode ? `/r/${shortCode}` : `/public/work-report/${sub.publicShareToken}`;
        return res.json({ token: sub.publicShareToken, url: shortUrl, shortCode, shortUrl });
      }
      const updated = await storage.generateWorkSubmissionShareToken(req.params.id);
      if (!updated) return res.status(500).json({ message: "Failed to generate link" });
      const shortCode = updated.reportShortCode;
      const shortUrl = shortCode ? `/r/${shortCode}` : `/public/work-report/${updated.publicShareToken}`;
      res.json({ token: updated.publicShareToken, url: shortUrl, shortCode, shortUrl });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Public report data (no auth required) — accepts long token OR 7-char short code
  app.get("/api/public/work-report/:token", async (req, res) => {
    try {
      let sub = await storage.getWorkSubmissionByToken(req.params.token);
      if (!sub) sub = await storage.getWorkSubmissionByShortCode(req.params.token);
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
      const existingReview = await storage.getWorkSubmissionReviewBySubmissionId(sub.id);
      // Only expose googleReviewUrl if it's a valid https Google URL
      let googleReviewUrl: string | null = null;
      if (company?.googleReviewUrl) {
        try {
          const parsed = new URL(company.googleReviewUrl);
          const allowed = ["google.com", "www.google.com", "g.page", "goo.gl", "maps.google.com", "maps.app.goo.gl"];
          const isGoogle = allowed.some(h => parsed.hostname === h || parsed.hostname.endsWith("." + h));
          if (parsed.protocol === "https:" && isGoogle) googleReviewUrl = company.googleReviewUrl;
        } catch { /* ignore invalid stored URL */ }
      }
      // Build formatted address from company fields
      const addrParts = [
        company?.address,
        company?.city,
        company?.province,
        company?.postalCode,
      ].filter(Boolean);
      const companyAddress = addrParts.length > 0 ? addrParts.join(", ") : null;

      // Resolve service summary: report-specific → company default → null
      const serviceSummary = (sub as any).serviceSummary || company?.defaultReportIntro || null;

      // Load priority alert if one was resolved for this submission
      let priorityAlert: any = null;
      const paRecord = await storage.getPriorityCleanAlertBySubmissionId(sub.id);
      if (paRecord && paRecord.visibleOnPublicLink) {
        const paPhotos = await storage.getPriorityCleanPhotosByAlertId(paRecord.id);
        priorityAlert = {
          id: paRecord.id,
          title: paRecord.title,
          message: paRecord.message,
          photos: paPhotos.map(p => ({ id: p.id })),
        };
      }

      res.json({
        id: sub.id,
        workDate: sub.workDate,
        submittedAt: sub.submittedAt,
        locationName: sub.locationName,
        status: sub.status,
        companyName: company?.name || "ClockField",
        companyAddress,
        companyLogoUrl: company?.companyLogoUrl || null,
        brandColor: company?.brandColor || null,
        serviceSummary,
        employeeName,
        items: itemsWithPhotos,
        googleReviewUrl,
        priorityAlert,
        review: existingReview ? {
          clientName: existingReview.clientName,
          companyName: existingReview.companyName,
          reviewText: existingReview.reviewText,
          rating: existingReview.rating,
          submittedAt: existingReview.submittedAt,
        } : null,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Public photo serving (no auth, validates via token or short code)
  app.get("/api/public/work-report/:token/photos/:photoId", async (req, res) => {
    try {
      let sub = await storage.getWorkSubmissionByToken(req.params.token);
      if (!sub) sub = await storage.getWorkSubmissionByShortCode(req.params.token);
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

  // ── Public: Serve photos for review share page ─────────────────────────────
  app.get("/api/public/review/:reviewShareToken/photos/:photoId", async (req, res) => {
    try {
      let review = await storage.getWorkSubmissionReviewByShareToken(req.params.reviewShareToken);
      if (!review) review = await storage.getWorkSubmissionReviewByShortCode(req.params.reviewShareToken);
      if (!review) return res.status(404).json({ message: "Not found" });
      const photo = await storage.getWorkSubmissionPhoto(req.params.photoId);
      if (!photo) return res.status(404).json({ message: "Not found" });
      const item = await storage.getWorkSubmissionItem(photo.submissionItemId);
      if (!item || item.submissionId !== review.submissionId) return res.status(403).json({ message: "Forbidden" });
      const match = photo.fileUrl.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) return res.status(400).json({ message: "Invalid image data" });
      const buffer = Buffer.from(match[2], "base64");
      res.set("Content-Type", match[1]);
      res.set("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Public: Submit review for a report ────────────────────────────────────
  app.post("/api/public/work-report/:token/review", async (req, res) => {
    try {
      let sub = await storage.getWorkSubmissionByToken(req.params.token);
      if (!sub) sub = await storage.getWorkSubmissionByShortCode(req.params.token);
      if (!sub || !sub.publicShareEnabled) return res.status(404).json({ message: "Report not found" });
      // One review per submission
      const existing = await storage.getWorkSubmissionReviewBySubmissionId(sub.id);
      if (existing) return res.status(409).json({ message: "A review has already been submitted for this report." });
      const { clientName, companyName, reviewText, rating } = req.body;
      if (!clientName || !clientName.trim()) return res.status(400).json({ message: "Client name is required." });
      if (!reviewText || !reviewText.trim()) return res.status(400).json({ message: "Review message is required." });
      if (rating !== undefined && rating !== null && (isNaN(Number(rating)) || Number(rating) < 1 || Number(rating) > 5)) {
        return res.status(400).json({ message: "Rating must be between 1 and 5." });
      }
      const now = new Date().toISOString();
      const review = await storage.createWorkSubmissionReview({
        submissionId: sub.id,
        companyId: sub.companyId,
        shareToken: req.params.token,
        clientName: clientName.trim().substring(0, 200),
        companyName: companyName ? companyName.trim().substring(0, 200) : null,
        reviewText: reviewText.trim().substring(0, 2000),
        rating: rating ? Number(rating) : null,
        status: "submitted",
        submittedAt: now,
        createdAt: now,
      });
      res.status(201).json({ id: review.id, message: "Thank you! Your review has been submitted." });
    } catch (err: any) {
      console.error("[review submit]", err);
      res.status(500).json({ message: "Unable to submit your review right now. Please try again in a moment." });
    }
  });

  // ── Admin: Get review for a submission ────────────────────────────────────
  app.get("/api/work-submissions/:id/review", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getWorkSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      let review = await storage.getWorkSubmissionReviewBySubmissionId(req.params.id);
      if (!review) return res.status(404).json({ message: "No review for this submission" });
      // Lazily generate short code for reviews that predate the feature
      if (!review.reviewShortCode) {
        review = await storage.generateReviewShortCodeOnly(review.id) || review;
      }
      const employee = sub.employeeId ? await storage.getUser(sub.employeeId) : null;
      const company = await storage.getCompany(sub.companyId);
      res.json({
        ...review,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}`.trim() : "Staff",
        locationName: sub.locationName,
        workDate: sub.workDate,
        companyDisplayName: company?.name || "",
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Public: Get review by reviewShareToken or short code ───────────────────
  app.get("/api/public/review/:reviewShareToken", async (req, res) => {
    try {
      let review = await storage.getWorkSubmissionReviewByShareToken(req.params.reviewShareToken);
      if (!review) review = await storage.getWorkSubmissionReviewByShortCode(req.params.reviewShareToken);
      if (!review) return res.status(404).json({ message: "Review not found" });
      const sub = await storage.getWorkSubmission(review.submissionId);
      if (!sub) return res.status(404).json({ message: "Not found" });
      const employee = sub.employeeId ? await storage.getUser(sub.employeeId) : null;
      const company = await storage.getCompany(review.companyId);
      // Gather after photos for social proof (only after photos, max 6)
      const items = await storage.getWorkSubmissionItems(sub.id);
      const afterPhotos: any[] = [];
      for (const item of items) {
        const photos = await storage.getWorkSubmissionPhotosByItem(item.id);
        const after = photos.filter(p => p.photoType === "after");
        afterPhotos.push(...after.map(p => ({ id: p.id, caption: p.caption, section: item.section, subArea: item.subArea })));
        if (afterPhotos.length >= 6) break;
      }
      res.json({
        review: {
          id: review.id,
          reviewShareToken: review.reviewShareToken,
          clientName: review.clientName,
          companyName: review.companyName,
          reviewText: review.reviewText,
          rating: review.rating,
          submittedAt: review.submittedAt,
        },
        workDate: sub.workDate,
        locationName: sub.locationName,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}`.trim() : null,
        companyName: company?.name || "",
        afterPhotos,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Public: OG image for review share ─────────────────────────────────────
  app.get("/api/public/review/:reviewShareToken/og-image.png", async (req, res) => {
    try {
      let review = await storage.getWorkSubmissionReviewByShareToken(req.params.reviewShareToken);
      if (!review) review = await storage.getWorkSubmissionReviewByShortCode(req.params.reviewShareToken);
      if (!review) return res.status(404).end();
      const sub = await storage.getWorkSubmission(review.submissionId);
      const company = await storage.getCompany(review.companyId);
      const employee = sub?.employeeId ? await storage.getUser(sub.employeeId) : null;
      const buf = await generateReviewOgImage({
        companyName: company?.name || "ClockField",
        reviewText: review.reviewText,
        clientName: review.clientName,
        clientCompany: review.companyName,
        rating: review.rating,
        workDate: sub?.workDate || null,
        locationName: sub?.locationName || null,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}`.trim() : null,
      });
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.send(buf);
    } catch (err: any) { res.status(500).end(); }
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
      const { planCode, billingCycle, accountStatus, subscriptionStatus, suspendedReason, internalBypass,
              manualAccessEnabled, manualAccessExpiresAt, manualAccessGrantedBy, manualAccessReason } = req.body;
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
      if (manualAccessEnabled !== undefined) updates.manualAccessEnabled = !!manualAccessEnabled;
      if (manualAccessExpiresAt !== undefined) updates.manualAccessExpiresAt = manualAccessExpiresAt;
      if (manualAccessGrantedBy !== undefined) updates.manualAccessGrantedBy = manualAccessGrantedBy;
      if (manualAccessReason !== undefined) updates.manualAccessReason = manualAccessReason;
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
      // Send email companion notification to business admin
      try {
        const admins = await storage.getAdminsByCompany(req.params.id);
        const primaryAdmin = admins[0];
        if (primaryAdmin?.email) {
          await sendPlatformMessageEmail({
            to: primaryAdmin.email,
            adminName: `${primaryAdmin.firstName} ${primaryAdmin.lastName}`,
            subject: subject.trim(),
            preview: body.trim(),
            messageType: messageType || "announcement",
            loginUrl: `${process.env.APP_URL || "https://app.clockfield.com"}/admin/messages`,
          });
          console.log(`[platform-msg] Email sent to ${primaryAdmin.email} for direct message`);
        }
      } catch (emailErr: any) {
        console.error("[platform-msg] Email notification failed:", emailErr.message);
      }
      res.status(201).json(msg);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/super-admin/messages/broadcast", requireSuperAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { subject, body, messageType, deliveryMode, emailSubject, emailCtaLabel, emailCtaUrl } = req.body;
      if (!subject?.trim() || !body?.trim()) return res.status(400).json({ message: "Subject and body are required" });
      const mode: string = deliveryMode || "in_app";
      if (!["in_app", "email", "both"].includes(mode)) return res.status(400).json({ message: "Invalid delivery mode" });
      if ((mode === "email" || mode === "both") && !emailSubject?.trim()) {
        return res.status(400).json({ message: "Email subject is required when sending by email" });
      }
      if (emailCtaUrl) {
        try {
          const parsed = new URL(emailCtaUrl.trim());
          if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return res.status(400).json({ message: "CTA URL must be a valid URL" });
          }
        } catch {
          return res.status(400).json({ message: "CTA URL is not a valid URL" });
        }
      }

      // Create in-app broadcast record (for in_app or both modes)
      let msg: any = null;
      if (mode === "in_app" || mode === "both") {
        msg = await storage.createPlatformMessage({
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
          deliveryMode: mode,
          emailSubject: emailSubject?.trim() || null,
          emailCtaLabel: emailCtaLabel?.trim() || null,
          emailCtaUrl: emailCtaUrl?.trim() || null,
          emailSentAt: null,
          emailStatus: null,
        });
      } else {
        // email-only: still create a record for audit trail (no in-app visibility)
        msg = await storage.createPlatformMessage({
          companyId: null,
          senderUserId: user.id,
          senderRole: "super_admin",
          subject: subject.trim(),
          body: body.trim(),
          messageType: messageType || "announcement",
          isRead: false,
          isBroadcast: false,
          parentMessageId: null,
          createdAt: new Date().toISOString(),
          deliveryMode: mode,
          emailSubject: emailSubject?.trim() || null,
          emailCtaLabel: emailCtaLabel?.trim() || null,
          emailCtaUrl: emailCtaUrl?.trim() || null,
          emailSentAt: null,
          emailStatus: null,
        });
      }

      // Send emails if mode includes email
      let emailResult: { attempted: number; sent: number; failed: number } = { attempted: 0, sent: 0, failed: 0 };
      if (mode === "email" || mode === "both") {
        try {
          const { sendBroadcastEmails } = await import("./mail");
          const [allCompanies, allAdmins] = await Promise.all([
            storage.getAllCompanies(),
            storage.getAllCompanyAdmins(),
          ]);
          const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

          // Build map: companyId → primary admin email (first admin with a non-null email)
          const adminEmailByCompany = new Map<string, string>();
          for (const admin of allAdmins) {
            if (admin.companyId && admin.email && !adminEmailByCompany.has(admin.companyId)) {
              adminEmailByCompany.set(admin.companyId, admin.email.trim().toLowerCase());
            }
          }

          // One recipient per non-suspended company — using the admin's login email
          const seen = new Set<string>();
          const recipients = allCompanies
            .filter(c => c.accountStatus !== "suspended")
            .flatMap(c => {
              const email = adminEmailByCompany.get(c.id);
              if (!email || seen.has(email)) return [];
              seen.add(email);
              return [{ email, businessId: c.id }];
            });

          console.log(`[broadcast] companies=${allCompanies.length} eligible recipients=${recipients.length}`);
          emailResult.attempted = recipients.length;
          if (recipients.length > 0) {
            const results = await sendBroadcastEmails({
              recipients,
              subject: emailSubject!.trim(),
              title: subject.trim(),
              body: body.trim(),
              ctaLabel: emailCtaLabel?.trim() || "Open ClockField",
              ctaUrl: emailCtaUrl?.trim() || appUrl,
              appUrl,
            });
            const now = new Date().toISOString();
            for (const r of results) {
              if (r.ok) emailResult.sent++;
              else emailResult.failed++;
              await storage.createBroadcastEmailDelivery({
                broadcastId: msg.id,
                businessId: r.businessId,
                recipientEmail: r.email,
                status: r.ok ? "sent" : "failed",
                mailgunMessageId: r.messageId || null,
                sentAt: r.ok ? now : null,
                failedAt: r.ok ? null : now,
                errorMessage: r.error || null,
                createdAt: now,
              });
            }
            await storage.updatePlatformMessage(msg.id, {
              emailSentAt: now,
              emailStatus: emailResult.failed === 0 ? "sent" : emailResult.sent > 0 ? "partial" : "failed",
            });
          }
        } catch (emailErr: any) {
          console.error("[broadcast] email send error:", emailErr.message);
          await storage.updatePlatformMessage(msg.id, { emailStatus: "failed" });
        }
      }

      res.status(201).json({ ...msg, emailResult });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/super-admin/messages", requireSuperAdmin, async (req, res) => {
    try {
      const messages = await storage.getAllPlatformMessages();
      res.json(messages);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Recent businesses endpoint
  app.get("/api/super-admin/recent-businesses", requireSuperAdmin, async (req, res) => {
    try {
      const sortBy = (req.query.sort as string) || "created";
      const limit = Math.min(parseInt((req.query.limit as string) || "20"), 50);
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
          id: company.id,
          name: company.name,
          planCode: company.planCode,
          planName: plan.name,
          billingCycle: company.billingCycle,
          subscriptionStatus: company.subscriptionStatus,
          accountStatus: company.accountStatus,
          employeeCount: employees.length,
          clientCount: clientsList.length,
          adminName: primaryAdmin ? `${primaryAdmin.firstName} ${primaryAdmin.lastName}` : "—",
          adminEmail: primaryAdmin?.email ?? "—",
          createdAt: company.createdAt,
          activatedAt: company.activatedAt,
          internalBypass: company.internalBypass,
        };
      }));
      const sorted = results.sort((a, b) => {
        if (sortBy === "activated") {
          const aDate = a.activatedAt ? new Date(a.activatedAt).getTime() : 0;
          const bDate = b.activatedAt ? new Date(b.activatedAt).getTime() : 0;
          return bDate - aDate;
        }
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });
      res.json(sorted.slice(0, limit));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Activity overview endpoint for super admin dashboard
  app.get("/api/super-admin/activity-overview", requireSuperAdmin, async (req, res) => {
    try {
      const allCompanies = await storage.getAllCompanies();
      const today = new Date().toISOString().slice(0, 10);
      let newSignupsToday = 0;
      let pendingPayment = 0;
      for (const c of allCompanies) {
        if (c.createdAt && c.createdAt.slice(0, 10) === today) newSignupsToday++;
        if (c.accountStatus === "pending_activation" || (c.subscriptionStatus === "past_due") || (c.subscriptionStatus === "unpaid")) pendingPayment++;
      }
      // Count unread messages (platform messages that haven't been read, per company)
      const allMessages = await storage.getAllPlatformMessages();
      const unreadCompanyIds = new Set<string>();
      for (const m of allMessages) {
        if (!m.isRead && m.companyId) unreadCompanyIds.add(m.companyId);
      }
      res.json({
        newSignupsToday,
        pendingPayment,
        unreadBusinessMessages: unreadCompanyIds.size,
        totalActive: allCompanies.filter(c => c.accountStatus === "active").length,
        totalSuspended: allCompanies.filter(c => c.accountStatus === "suspended").length,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Activity chart data for super admin dashboard
  app.get("/api/super-admin/activity-chart", requireSuperAdmin, async (req, res) => {
    try {
      const allCompanies = await storage.getAllCompanies();
      // Build last 7 days signup counts
      const days: { date: string; signups: number; active: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const signups = allCompanies.filter(c => c.createdAt && c.createdAt.slice(0, 10) === dateStr).length;
        const active = allCompanies.filter(c =>
          c.accountStatus === "active" &&
          c.createdAt && c.createdAt.slice(0, 10) <= dateStr
        ).length;
        days.push({ date: dateStr, signups, active });
      }
      // Funnel data
      const funnel = {
        signedUp: allCompanies.length,
        pendingPayment: allCompanies.filter(c => c.accountStatus === "pending_activation" || c.subscriptionStatus === "past_due").length,
        activated: allCompanies.filter(c => c.accountStatus === "active").length,
        suspended: allCompanies.filter(c => c.accountStatus === "suspended").length,
      };
      res.json({ days, funnel });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Company alert settings update
  app.patch("/api/company/alert-settings", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { alertLateClockIn, alertMissedShift, alertEmployeeClockedIn, alertEmployeeClockedOut, alertDailySummary } = req.body;
      const updates: Record<string, any> = {};
      if (alertLateClockIn !== undefined) updates.alertLateClockIn = !!alertLateClockIn;
      if (alertMissedShift !== undefined) updates.alertMissedShift = !!alertMissedShift;
      if (alertEmployeeClockedIn !== undefined) updates.alertEmployeeClockedIn = !!alertEmployeeClockedIn;
      if (alertEmployeeClockedOut !== undefined) updates.alertEmployeeClockedOut = !!alertEmployeeClockedOut;
      if (alertDailySummary !== undefined) updates.alertDailySummary = !!alertDailySummary;
      const updated = await storage.updateCompany(user.companyId, updates);
      if (!updated) return res.status(404).json({ message: "Company not found" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Field note add-after-photos endpoint
  app.post("/api/field-notes/sessions/:sessionId/after-photos", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { sessionId } = req.params;
      const { assets } = req.body; // Array of { fileUrl, capturedAt, areaLabel, caption }
      if (!Array.isArray(assets) || assets.length === 0) {
        return res.status(400).json({ message: "No assets provided" });
      }
      const now = new Date().toISOString();
      const created = await Promise.all(assets.map(async (a: any, i: number) => {
        return storage.addFieldNotesAsset({
          sessionId,
          uploadedByUserId: user.id,
          assetType: "photo",
          fileUrl: a.fileUrl,
          sequenceIndex: a.sequenceIndex ?? i,
          capturedAt: a.capturedAt || now,
          caption: a.caption || null,
          areaLabel: a.areaLabel || null,
          areaConfidence: null,
          phase: "after",
          createdAt: now,
        } as any);
      }));
      res.status(201).json(created);
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

  // ── Trial Company Creation ──────────────────────────────────────────────────

  /** Generate a readable temporary password in CF-XXXX-XXXX format */
  function generateTempPassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous I/O/0/1
    const segment = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `CF-${segment(4)}-${segment(4)}`;
  }

  app.post("/api/super-admin/trial-companies/create", requireSuperAdmin, async (req, res) => {
    try {
      const { companyName, adminFirstName, adminLastName, adminEmail, phoneNumber, trialDays, planCode, notes, generatePassword } = req.body;
      if (!companyName?.trim()) return res.status(400).json({ message: "Company name is required" });
      if (!adminFirstName?.trim()) return res.status(400).json({ message: "Admin first name is required" });
      if (!adminLastName?.trim()) return res.status(400).json({ message: "Admin last name is required" });
      const email = (adminEmail || "").trim().toLowerCase();
      if (!email) return res.status(400).json({ message: "Admin email is required" });

      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(409).json({ message: "An account with that email already exists" });

      const days = Math.max(1, Math.min(365, Number(trialDays) || 7));
      const plan = planCode || "starter";
      const now = new Date();
      const trialEndDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const company = await storage.createCompany({
        name: companyName.trim(),
        accountStatus: "active",
        subscriptionStatus: "pending_subscription",
        planCode: plan,
        billingCycle: "monthly",
        createdAt: now.toISOString(),
        manualAccessEnabled: true,
        manualAccessExpiresAt: trialEndDate.toISOString(),
        manualAccessGrantedBy: "super_admin",
        manualAccessReason: notes?.trim() || "Trial access",
        isTrialAccess: true,
        trialStartDate: now.toISOString(),
        trialEndDate: trialEndDate.toISOString(),
        trialDays: days,
        createdBySuperAdmin: true,
        trialStatus: "active",
      } as any);

      // Generate temp password if requested (default: true)
      const useTempPassword = generatePassword !== false;
      const plainTempPassword = useTempPassword ? generateTempPassword() : null;
      const passwordToHash = plainTempPassword ?? randomBytes(32).toString("hex");
      const hashedPassword = await hashPassword(passwordToHash);
      const tempExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const adminUser = await storage.createUser({
        companyId: company.id,
        email,
        password: hashedPassword,
        role: "admin",
        firstName: adminFirstName.trim(),
        lastName: adminLastName.trim(),
        loginEnabled: true,
        accountStatus: "active",
        mustChangePassword: useTempPassword,
        ...(useTempPassword ? {
          temporaryPasswordRequired: true,
          temporaryPasswordCreatedAt: now.toISOString(),
          temporaryPasswordExpiresAt: tempExpiresAt.toISOString(),
          temporaryPasswordLastSentAt: now.toISOString(),
          createdBySuperAdmin: true,
        } : {}),
      } as any);

      // Create welcome platform message
      try {
        await storage.createPlatformMessage({
          companyId: company.id,
          senderUserId: "system",
          senderRole: "super_admin",
          subject: "Welcome to ClockField",
          body: `Welcome to ClockField, ${adminFirstName}!\n\nYour trial account for ${companyName.trim()} is now active. You have ${days} days to explore the platform.\n\nIf you have any questions, feel free to reach out.`,
          messageType: "standard",
          isBroadcast: false,
        });
      } catch (_) {}

      // Send setup email with temp password if generated
      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
      if (useTempPassword && plainTempPassword) {
        try {
          await sendTrialAccountEmail({
            to: email,
            firstName: adminFirstName.trim(),
            companyName: companyName.trim(),
            trialEndDate: trialEndDate.toISOString(),
            setupUrl: baseUrl,
            appUrl: baseUrl,
            tempPassword: plainTempPassword,
          });
        } catch (mailErr: any) {
          console.error("[trial-create] email error:", mailErr.message);
        }
      }

      res.json({
        success: true,
        companyId: company.id,
        adminUserId: adminUser.id,
        trialEndDate: trialEndDate.toISOString(),
        tempPassword: plainTempPassword, // returned once for display; null if not generated
        adminEmail: email,
        adminName: `${adminFirstName.trim()} ${adminLastName.trim()}`,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/super-admin/businesses/:id/generate-temporary-password", requireSuperAdmin, async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ message: "Not found" });
      const admins = await storage.getAdminsByCompany(req.params.id);
      const admin = admins[0];
      if (!admin || !admin.email) return res.status(400).json({ message: "No admin found for this company" });

      const plainTempPassword = generateTempPassword();
      const hashed = await hashPassword(plainTempPassword);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      await storage.updateUser(admin.id, {
        password: hashed,
        mustChangePassword: true,
        temporaryPasswordRequired: true,
        temporaryPasswordCreatedAt: now.toISOString(),
        temporaryPasswordExpiresAt: expiresAt.toISOString(),
        temporaryPasswordLastSentAt: now.toISOString(),
        createdBySuperAdmin: true,
      } as any);

      // Send email with the temp password
      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
      try {
        await sendTrialAccountEmail({
          to: admin.email,
          firstName: admin.firstName,
          companyName: company.name,
          trialEndDate: (company as any).trialEndDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          setupUrl: baseUrl,
          appUrl: baseUrl,
          tempPassword: plainTempPassword,
        });
      } catch (mailErr: any) {
        console.error("[gen-temp-pass] email error:", mailErr.message);
      }

      res.json({
        success: true,
        tempPassword: plainTempPassword, // returned ONCE
        adminEmail: admin.email,
        adminName: `${admin.firstName} ${admin.lastName}`,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/super-admin/businesses/:id/extend-trial", requireSuperAdmin, async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ message: "Not found" });
      const { days } = req.body;
      const extraDays = Math.max(1, Math.min(365, Number(days) || 7));
      const base = (company as any).trialEndDate
        ? new Date(Math.max(Date.now(), new Date((company as any).trialEndDate).getTime()))
        : new Date();
      const newEnd = new Date(base.getTime() + extraDays * 24 * 60 * 60 * 1000);
      await storage.updateCompany(req.params.id, {
        trialEndDate: newEnd.toISOString(),
        trialStatus: "active",
        manualAccessExpiresAt: newEnd.toISOString(),
        manualAccessEnabled: true,
      } as any);
      res.json({ success: true, trialEndDate: newEnd.toISOString() });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/super-admin/businesses/:id/end-trial", requireSuperAdmin, async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      await storage.updateCompany(req.params.id, {
        trialEndDate: now,
        trialStatus: "expired",
        manualAccessExpiresAt: now,
      } as any);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/super-admin/businesses/:id/resend-invite", requireSuperAdmin, async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ message: "Not found" });
      const admins = await storage.getAdminsByCompany(req.params.id);
      const admin = admins[0];
      if (!admin || !admin.email) return res.status(400).json({ message: "No admin found for this company" });

      // Generate a fresh temp password and send setup email
      const plainTempPassword = generateTempPassword();
      const hashed = await hashPassword(plainTempPassword);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await storage.updateUser(admin.id, {
        password: hashed,
        mustChangePassword: true,
        temporaryPasswordRequired: true,
        temporaryPasswordCreatedAt: now.toISOString(),
        temporaryPasswordExpiresAt: expiresAt.toISOString(),
        temporaryPasswordLastSentAt: now.toISOString(),
      } as any);

      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
      await sendTrialAccountEmail({
        to: admin.email,
        firstName: admin.firstName,
        companyName: company.name,
        trialEndDate: (company as any).trialEndDate || expiresAt.toISOString(),
        setupUrl: baseUrl,
        appUrl: baseUrl,
        tempPassword: plainTempPassword,
      });

      res.json({ success: true, tempPassword: plainTempPassword, adminEmail: admin.email });
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

  // ────────────────────────────────────────────────────────────────────────────
  // PAY RUNS
  // ────────────────────────────────────────────────────────────────────────────
  app.get("/api/payroll/pay-runs", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const runs = await storage.getPayRunsByCompany(user.companyId);
      res.json(runs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/payroll/pay-runs", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const now = new Date().toISOString();
      const run = await storage.createPayRun({
        ...req.body,
        companyId: user.companyId,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      });
      res.json(run);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/payroll/pay-runs/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const run = await storage.getPayRun(req.params.id);
      if (!run || run.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      res.json(run);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/payroll/pay-runs/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const run = await storage.getPayRun(req.params.id);
      if (!run || run.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updatePayRun(req.params.id, { ...req.body, updatedAt: new Date().toISOString() });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/payroll/pay-runs/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const run = await storage.getPayRun(req.params.id);
      if (!run || run.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (run.status !== "draft") return res.status(400).json({ message: "Only draft pay runs can be deleted" });
      await storage.deletePayRun(req.params.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // PAY STUBS — ADMIN
  // ────────────────────────────────────────────────────────────────────────────
  app.get("/api/payroll/pay-stubs", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stubs = await storage.getPayStubsByCompany(user.companyId);
      res.json(stubs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Generate a draft pay stub for a specific employee in a pay run
  app.post("/api/payroll/pay-stubs/generate", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { payRunId, employeeId } = req.body;
      if (!payRunId || !employeeId) return res.status(400).json({ message: "payRunId and employeeId required" });

      const payRun = await storage.getPayRun(payRunId);
      if (!payRun || payRun.companyId !== user.companyId) return res.status(404).json({ message: "Pay run not found" });

      const employee = await storage.getUser(employeeId);
      if (!employee || employee.companyId !== user.companyId) return res.status(404).json({ message: "Employee not found" });

      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });

      // Check for existing stub in this pay run for this employee
      const existingStubs = await storage.getPayStubsByPayRun(payRunId);
      const duplicate = existingStubs.find(s => s.employeeId === employeeId && s.status !== "voided");
      if (duplicate) return res.status(400).json({ message: "A pay stub already exists for this employee in this pay run" });

      // Find approved timesheet for this period
      const timesheets = await storage.getTimesheetsByEmployee(employeeId);
      const matchingTimesheet = timesheets.find(t =>
        t.status === "approved" &&
        t.payPeriodStart === payRun.periodStart &&
        t.payPeriodEnd === payRun.periodEnd
      );

      const rate = parseFloat(employee.hourlyRate || "0");
      const overtimeRate = parseFloat(employee.overtimeRate || "0") || rate * 1.5;
      const overtimeThresholdHours = (company.overtimeThresholdWeekly || 40);

      let regularMinutes = 0;
      let overtimeMinutes = 0;

      if (matchingTimesheet) {
        regularMinutes = matchingTimesheet.regularMinutes;
        overtimeMinutes = matchingTimesheet.overtimeMinutes;
      } else {
        // Fall back to raw time entries in range
        const allEntries = await storage.getTimeEntriesByCompany(user.companyId);
        const periodEntries = allEntries.filter(e =>
          e.employeeId === employeeId &&
          e.status === "completed" &&
          e.clockInAt.substring(0, 10) >= payRun.periodStart &&
          e.clockInAt.substring(0, 10) <= payRun.periodEnd
        );
        const totalMins = periodEntries.reduce((s, e) => s + (e.workedMinutes || 0), 0);
        const totalHours = totalMins / 60;
        const regHours = Math.min(totalHours, overtimeThresholdHours);
        const otHours = Math.max(0, totalHours - overtimeThresholdHours);
        regularMinutes = Math.round(regHours * 60);
        overtimeMinutes = Math.round(otHours * 60);
      }

      const regularHours = regularMinutes / 60;
      const overtimeHours = overtimeMinutes / 60;
      const totalHours = regularHours + overtimeHours;
      const regularPay = regularHours * rate;
      const overtimePay = overtimeHours * overtimeRate;
      const grossPay = regularPay + overtimePay;

      // Calculate deductions from company settings
      const customDeductions = await storage.getPayrollDeductionsByCompany(user.companyId);

      const deductionItems: Array<{ type: string; description: string; amount: number }> = [];

      if (company.deductionsEnabled) {
        if (company.federalTaxMode === "percent" && parseFloat(company.federalTaxPercent || "0") > 0) {
          deductionItems.push({ type: "tax", description: "Federal Tax", amount: grossPay * parseFloat(company.federalTaxPercent || "0") / 100 });
        }
        if (company.provincialTaxMode === "percent" && parseFloat(company.provincialTaxPercent || "0") > 0) {
          deductionItems.push({ type: "provincial_tax", description: "Provincial Tax", amount: grossPay * parseFloat(company.provincialTaxPercent || "0") / 100 });
        }
        if (company.cppMode === "percent" && parseFloat(company.cppPercent || "0") > 0) {
          deductionItems.push({ type: "cpp", description: "CPP", amount: grossPay * parseFloat(company.cppPercent || "0") / 100 });
        }
        if (company.eiMode === "percent" && parseFloat(company.eiPercent || "0") > 0) {
          deductionItems.push({ type: "ei", description: "EI", amount: grossPay * parseFloat(company.eiPercent || "0") / 100 });
        }
        for (const d of customDeductions.filter(d => d.isActive)) {
          const amt = d.type === "percent" ? grossPay * parseFloat(d.value || "0") / 100 : parseFloat(d.value || "0");
          deductionItems.push({ type: "other", description: d.label, amount: amt });
        }
      }

      const totalDeductions = deductionItems.reduce((s, d) => s + d.amount, 0);
      const netPay = grossPay - totalDeductions;
      const now = new Date().toISOString();

      // Generate a human-readable display ID: PS-[EMP_CODE_OR_NAME]-[4-digit]
      const empSlug = (employee.employeeId || `${employee.firstName}${employee.lastName}`)
        .toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 8);
      const suffix = String(Math.floor(1000 + Math.random() * 9000));
      const displayPaystubId = `PS-${empSlug}-${suffix}`;

      const stub = await storage.createPayStub({
        companyId: user.companyId,
        payRunId,
        employeeId,
        timesheetId: matchingTimesheet?.id || null,
        status: "draft",
        displayPaystubId,
        employeeNameSnapshot: `${employee.firstName} ${employee.lastName}`,
        employeeIdSnapshot: employee.employeeId || null,
        employeePositionSnapshot: employee.position || null,
        employeePayTypeSnapshot: "hourly",
        employeeRateSnapshot: employee.hourlyRate || null,
        companyNameSnapshot: company.name,
        regularHours: regularHours.toFixed(2),
        overtimeHours: overtimeHours.toFixed(2),
        totalHours: totalHours.toFixed(2),
        grossPay: grossPay.toFixed(2),
        totalDeductions: totalDeductions.toFixed(2),
        netPay: netPay.toFixed(2),
        periodStart: payRun.periodStart,
        periodEnd: payRun.periodEnd,
        payDate: payRun.payDate,
        createdBy: user.id,
        updatedBy: user.id,
        createdAt: now,
        updatedAt: now,
      });

      // Create earning lines
      if (regularPay > 0) {
        await storage.createPayStubEarning({
          payStubId: stub.id,
          type: "regular",
          description: "Regular Pay",
          hours: regularHours.toFixed(2),
          rate: rate.toFixed(2),
          amount: regularPay.toFixed(2),
          displayOrder: 0,
        });
      }
      if (overtimePay > 0) {
        await storage.createPayStubEarning({
          payStubId: stub.id,
          type: "overtime",
          description: "Overtime Pay",
          hours: overtimeHours.toFixed(2),
          rate: overtimeRate.toFixed(2),
          amount: overtimePay.toFixed(2),
          displayOrder: 1,
        });
      }

      // Create deduction lines
      for (let i = 0; i < deductionItems.length; i++) {
        await storage.createPayStubDeduction({
          payStubId: stub.id,
          type: deductionItems[i].type,
          description: deductionItems[i].description,
          amount: deductionItems[i].amount.toFixed(2),
          employerPaid: false,
          displayOrder: i,
        });
      }

      // Audit log
      await storage.createPayStubAuditLog({
        payStubId: stub.id,
        action: "generated",
        actorId: user.id,
        actorRole: user.role,
        metadataJson: JSON.stringify({ timesheetId: matchingTimesheet?.id, grossPay, netPay }),
        createdAt: now,
      });

      res.json(stub);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/payroll/pay-stubs/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const [earnings, deductions, auditLog, company] = await Promise.all([
        storage.getPayStubEarnings(stub.id),
        storage.getPayStubDeductions(stub.id),
        storage.getPayStubAuditLog(stub.id),
        storage.getCompany(user.companyId),
      ]);
      // YTD: sum amounts from all finalized/confirmed_paid/published stubs for same employee this year
      const ytdYear = stub.payDate ? stub.payDate.substring(0, 4) : stub.periodEnd.substring(0, 4);
      const allStubs = await storage.getPayStubsByEmployee(stub.employeeId, user.companyId);
      const ytdStubs = allStubs.filter(s =>
        ["finalized", "confirmed_paid", "published"].includes(s.status) &&
        (s.payDate || s.periodEnd).substring(0, 4) === ytdYear &&
        s.id !== stub.id
      );
      // Also include this stub itself (if finalized+)
      const includeSelf = ["finalized", "confirmed_paid", "published"].includes(stub.status);
      const ytdStubIds = [...ytdStubs.map(s => s.id), ...(includeSelf ? [stub.id] : [])];
      const ytdEarningsByType: Record<string, number> = {};
      const ytdDeductionsByType: Record<string, number> = {};
      for (const sid of ytdStubIds) {
        const se = await storage.getPayStubEarnings(sid);
        const sd = await storage.getPayStubDeductions(sid);
        for (const e of se) {
          ytdEarningsByType[e.description] = (ytdEarningsByType[e.description] || 0) + parseFloat(e.amount || "0");
        }
        for (const d of sd) {
          ytdDeductionsByType[d.description] = (ytdDeductionsByType[d.description] || 0) + parseFloat(d.amount || "0");
        }
      }
      const companyAddress = { address: (company as any)?.address, city: (company as any)?.city, province: (company as any)?.province, postalCode: (company as any)?.postalCode, companyPhone: (company as any)?.companyPhone, companyEmail: (company as any)?.companyEmail };
      res.json({ ...stub, earnings, deductions, auditLog, ytdYear, ytdEarningsByType, ytdDeductionsByType, companyAddress });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/payroll/pay-stubs/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (!["draft", "reviewed"].includes(stub.status)) return res.status(400).json({ message: "Cannot edit a finalized pay stub" });
      const { earnings: _e, deductions: _d, ...rest } = req.body;
      const updated = await storage.updatePayStub(req.params.id, { ...rest, updatedBy: user.id, updatedAt: new Date().toISOString() });
      await storage.createPayStubAuditLog({
        payStubId: stub.id,
        action: "updated",
        actorId: user.id,
        actorRole: user.role,
        metadataJson: JSON.stringify(rest),
        createdAt: new Date().toISOString(),
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Recalculate totals from current earnings/deductions lines
  app.post("/api/payroll/pay-stubs/:id/recalculate", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (!["draft", "reviewed"].includes(stub.status)) return res.status(400).json({ message: "Cannot recalculate a finalized pay stub" });

      const earnings = await storage.getPayStubEarnings(stub.id);
      const deductions = await storage.getPayStubDeductions(stub.id);

      const grossPay = earnings.reduce((s, e) => s + parseFloat(e.amount || "0"), 0);
      const totalDeductions = deductions.reduce((s, d) => s + parseFloat(d.amount || "0"), 0);
      const netPay = grossPay - totalDeductions;

      const updated = await storage.updatePayStub(stub.id, {
        grossPay: grossPay.toFixed(2),
        totalDeductions: totalDeductions.toFixed(2),
        netPay: netPay.toFixed(2),
        updatedBy: user.id,
        updatedAt: new Date().toISOString(),
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/payroll/pay-stubs/:id/finalize", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (!["draft", "reviewed"].includes(stub.status)) return res.status(400).json({ message: "Pay stub is already finalized" });
      const now = new Date().toISOString();
      const updated = await storage.updatePayStub(stub.id, { status: "finalized", finalizedAt: now, updatedBy: user.id, updatedAt: now });
      await storage.createPayStubAuditLog({ payStubId: stub.id, action: "finalized", actorId: user.id, actorRole: user.role, metadataJson: null, createdAt: now });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/payroll/pay-stubs/:id/confirm-paid", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (stub.status === "voided") return res.status(400).json({ message: "Cannot confirm a voided pay stub" });
      const now = new Date().toISOString();
      // Auto-finalize if not yet finalized, then confirm paid + publish
      const updated = await storage.updatePayStub(stub.id, {
        status: "confirmed_paid",
        finalizedAt: stub.finalizedAt || now,
        confirmedPaidAt: now,
        employeeVisibleAt: now,
        updatedBy: user.id,
        updatedAt: now,
      });
      await storage.createPayStubAuditLog({ payStubId: stub.id, action: "confirmed_paid", actorId: user.id, actorRole: user.role, metadataJson: null, createdAt: now });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/payroll/pay-stubs/:id/void", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      const updated = await storage.updatePayStub(stub.id, { status: "voided", voidedAt: now, updatedBy: user.id, updatedAt: now });
      await storage.createPayStubAuditLog({ payStubId: stub.id, action: "voided", actorId: user.id, actorRole: user.role, metadataJson: JSON.stringify({ reason: req.body.reason || "" }), createdAt: now });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Earning line CRUD
  app.post("/api/payroll/pay-stubs/:id/earnings", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (!["draft", "reviewed"].includes(stub.status)) return res.status(400).json({ message: "Cannot edit finalized pay stub" });
      const earning = await storage.createPayStubEarning({ ...req.body, payStubId: stub.id });
      res.json(earning);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/payroll/pay-stubs/:id/earnings/:earningId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (!["draft", "reviewed"].includes(stub.status)) return res.status(400).json({ message: "Cannot edit finalized pay stub" });
      const updated = await storage.updatePayStubEarning(req.params.earningId, req.body);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/payroll/pay-stubs/:id/earnings/:earningId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (!["draft", "reviewed"].includes(stub.status)) return res.status(400).json({ message: "Cannot edit finalized pay stub" });
      await storage.deletePayStubEarning(req.params.earningId);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Deduction line CRUD
  app.post("/api/payroll/pay-stubs/:id/deductions", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (!["draft", "reviewed"].includes(stub.status)) return res.status(400).json({ message: "Cannot edit finalized pay stub" });
      const deduction = await storage.createPayStubDeduction({ ...req.body, payStubId: stub.id });
      res.json(deduction);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/payroll/pay-stubs/:id/deductions/:deductionId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (!["draft", "reviewed"].includes(stub.status)) return res.status(400).json({ message: "Cannot edit finalized pay stub" });
      const updated = await storage.updatePayStubDeduction(req.params.deductionId, req.body);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/payroll/pay-stubs/:id/deductions/:deductionId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (!["draft", "reviewed"].includes(stub.status)) return res.status(400).json({ message: "Cannot edit finalized pay stub" });
      await storage.deletePayStubDeduction(req.params.deductionId);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/payroll/pay-stubs/:id/audit", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const log = await storage.getPayStubAuditLog(stub.id);
      res.json(log);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // PAY STUBS — EMPLOYEE PORTAL
  // ────────────────────────────────────────────────────────────────────────────
  app.get("/api/employee/pay-stubs", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== "employee") return res.status(403).json({ message: "Employees only" });
      const stubs = await storage.getPublishedPayStubsByEmployee(user.id, user.companyId);
      res.json(stubs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/employee/pay-stubs/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== "employee") return res.status(403).json({ message: "Employees only" });
      const stub = await storage.getPayStub(req.params.id);
      if (!stub || stub.employeeId !== user.id || stub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (!["confirmed_paid", "published"].includes(stub.status) || !stub.employeeVisibleAt) return res.status(403).json({ message: "Pay stub not yet available" });
      const [earnings, deductions, company] = await Promise.all([
        storage.getPayStubEarnings(stub.id),
        storage.getPayStubDeductions(stub.id),
        storage.getCompany(user.companyId),
      ]);
      // YTD calculation
      const ytdYear = stub.payDate ? stub.payDate.substring(0, 4) : stub.periodEnd.substring(0, 4);
      const allStubs = await storage.getPayStubsByEmployee(stub.employeeId, user.companyId);
      const ytdStubIds = allStubs
        .filter(s => ["finalized", "confirmed_paid", "published"].includes(s.status) && (s.payDate || s.periodEnd).substring(0, 4) === ytdYear)
        .map(s => s.id);
      const ytdEarningsByType: Record<string, number> = {};
      const ytdDeductionsByType: Record<string, number> = {};
      for (const sid of ytdStubIds) {
        const se = await storage.getPayStubEarnings(sid);
        const sd = await storage.getPayStubDeductions(sid);
        for (const e of se) ytdEarningsByType[e.description] = (ytdEarningsByType[e.description] || 0) + parseFloat(e.amount || "0");
        for (const d of sd) ytdDeductionsByType[d.description] = (ytdDeductionsByType[d.description] || 0) + parseFloat(d.amount || "0");
      }
      const companyAddress = { address: (company as any)?.address, city: (company as any)?.city, province: (company as any)?.province, postalCode: (company as any)?.postalCode, companyPhone: (company as any)?.companyPhone, companyEmail: (company as any)?.companyEmail };
      res.json({ ...stub, earnings, deductions, ytdYear, ytdEarningsByType, ytdDeductionsByType, companyAddress });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ─── Reports Module ─────────────────────────────────────────────────────────
  // Helper to log report activity
  async function logReportActivity(reportId: string, action: string, userId: string, role: string, metadata?: object) {
    await storage.createReportActivity({
      reportId,
      action,
      actionByUserId: userId,
      actionByRole: role,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date().toISOString(),
    });
  }

  // AI Incident Report Refinement
  app.post("/api/reports/refine-incident", requireAuth, async (req: any, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("[reports] AI refinement requested but OPENAI_API_KEY is not configured.");
      res.status(503).json({ message: "AI refinement is temporarily unavailable." });
      return;
    }
    try {
      const { whatHappened, whatCaused, immediateAction, whoInvolved, whatAffected, incidentCategory, areaAffected } = req.body;
      if (!whatHappened || whatHappened.trim().length < 10) {
        res.status(400).json({ message: "Please describe what happened (at least 10 characters) before refining." });
        return;
      }
      const openai = new OpenAI({ apiKey });
      const prompt = `You are a professional incident report writer for a commercial cleaning and facility services company. A team member has described an incident in rough notes. Your job is to rewrite it into a clear, professional, client-safe business document.

IMPORTANT RULES:
- Only use facts provided. Do not invent injuries, damages, witnesses, or details not given.
- If information is missing, note it in the confidence_note field instead of guessing.
- Write in factual, neutral, non-accusatory tone.
- Never use "admin" as a role label.

Incident details provided:
- Incident type/category: ${incidentCategory || "Not specified"}
- Area affected: ${areaAffected || "Not specified"}
- What happened: ${whatHappened}
- Cause (if known): ${whatCaused || "Not provided"}
- Immediate action taken: ${immediateAction || "Not provided"}
- Who was involved/present: ${whoInvolved || "Not provided"}
- What item/area was affected: ${whatAffected || "Not provided"}

Return a JSON object with these exact fields:
{
  "title": "A professional 5-10 word incident title",
  "refined_description": "A clear 2-4 sentence factual description of what occurred",
  "sequence_of_events": "A brief numbered or prose sequence of what happened step by step",
  "immediate_action": "Professional description of immediate actions taken",
  "probable_causes": "Possible contributing factors, if determinable from the given facts",
  "follow_up_recommendations": "Recommended follow-up steps and prevention measures",
  "confidence_note": "Note any missing details that would strengthen the report, or 'Report details appear sufficient.' if the input was adequate"
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 800,
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { parsed = {}; }

      res.json({
        title: parsed.title || "",
        refinedDescription: parsed.refined_description || "",
        sequenceOfEvents: parsed.sequence_of_events || "",
        immediateAction: parsed.immediate_action || "",
        probableCauses: parsed.probable_causes || "",
        followUpRecommendations: parsed.follow_up_recommendations || "",
        confidenceNote: parsed.confidence_note || "",
      });
    } catch (err: any) {
      const status = err?.status || err?.statusCode || 500;
      console.error("[reports] AI refinement error:", status, err?.message);
      if (status === 429) {
        res.status(503).json({ message: "AI refinement is temporarily unavailable." });
      } else if (status === 401 || status === 403) {
        res.status(503).json({ message: "AI refinement is temporarily unavailable." });
      } else {
        res.status(500).json({ message: "AI refinement is temporarily unavailable." });
      }
    }
  });

  // List reports (role-aware)
  app.get("/api/reports", requireAuth, async (req: any, res) => {
    try {
      const { user } = req;
      const companyId = user.companyId;
      let reps: any[];
      if (user.role === "admin") {
        reps = await storage.getReportsByCompany(companyId);
      } else if (user.role === "employee") {
        const [sent, created] = await Promise.all([
          storage.getReportsForEmployee(user.id, companyId),
          storage.getReportsCreatedBy(user.id, companyId),
        ]);
        const ids = new Set<string>();
        reps = [...sent, ...created].filter(r => { if (ids.has(r.id)) return false; ids.add(r.id); return true; });
      } else if (user.role === "client") {
        const clientRecord = (await storage.getClientsByCompany(companyId)).find(c => c.userId === user.id);
        if (!clientRecord) { res.json([]); return; }
        const [sent, created] = await Promise.all([
          storage.getReportsForClient(clientRecord.id, companyId),
          storage.getReportsCreatedBy(user.id, companyId),
        ]);
        const ids = new Set<string>();
        reps = [...sent, ...created].filter(r => { if (ids.has(r.id)) return false; ids.add(r.id); return true; });
      } else {
        reps = [];
      }
      res.json(reps);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Get single report (role-aware)
  app.get("/api/reports/:id", requireAuth, async (req: any, res) => {
    try {
      const { user } = req;
      const report = await storage.getReport(req.params.id, user.companyId);
      if (!report) { res.status(404).json({ message: "Report not found" }); return; }
      // Permission check for non-admin
      if (user.role === "employee") {
        const isCreator = report.createdByUserId === user.id;
        const isAssigned = report.assignedEmployeeId === user.id && report.sentToEmployee;
        if (!isCreator && !isAssigned) { res.status(403).json({ message: "Access denied" }); return; }
        // Mark viewed
        if (isAssigned && !report.employeeViewedAt) {
          await storage.updateReport(report.id, user.companyId, { employeeViewedAt: new Date().toISOString() });
        }
      } else if (user.role === "client") {
        const clientRecord = (await storage.getClientsByCompany(user.companyId)).find(c => c.userId === user.id);
        const isCreator = report.createdByUserId === user.id;
        const isAssigned = clientRecord && report.assignedClientId === clientRecord.id && report.sentToClient;
        if (!isCreator && !isAssigned) { res.status(403).json({ message: "Access denied" }); return; }
        if (isAssigned && !report.clientViewedAt) {
          await storage.updateReport(report.id, user.companyId, { clientViewedAt: new Date().toISOString() });
        }
      }
      const [signatures, activity] = await Promise.all([
        storage.getReportSignatures(report.id),
        storage.getReportActivity(report.id),
      ]);
      res.json({ ...report, signatures, activity });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Create report
  app.post("/api/reports", requireAuth, async (req: any, res) => {
    try {
      const { user } = req;
      // Routing rule: clients and employees can only send to admin
      if (user.role === "client" || user.role === "employee") {
        const body = req.body;
        if (body.assignedClientId && user.role === "employee") {
          res.status(403).json({ message: "Employees cannot send reports to clients" }); return;
        }
        if (body.sentToEmployee || body.sentToClient) {
          res.status(403).json({ message: "Only admins can send reports to employees or clients" }); return;
        }
      }
      const now = new Date().toISOString();
      const report = await storage.createReport({
        ...req.body,
        companyId: user.companyId,
        createdByUserId: user.id,
        createdByRole: user.role,
        status: req.body.status || "draft",
        createdAt: now,
        updatedAt: now,
      });
      await logReportActivity(report.id, "created", user.id, user.role);
      res.json(report);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Update report (admin can update freely; employee/client limited)
  app.patch("/api/reports/:id", requireAuth, async (req: any, res) => {
    try {
      const { user } = req;
      const report = await storage.getReport(req.params.id, user.companyId);
      if (!report) { res.status(404).json({ message: "Report not found" }); return; }
      if (report.status === "finalized" && user.role !== "admin") {
        res.status(403).json({ message: "Cannot edit a finalized report" }); return;
      }
      // Non-admin: only allowed to update their own statement/comments
      let updateData = req.body;
      if (user.role === "employee") {
        const allowed: any = {};
        if (updateData.employeeStatement !== undefined) allowed.employeeStatement = updateData.employeeStatement;
        updateData = allowed;
      } else if (user.role === "client") {
        const allowed: any = {};
        if (updateData.clientComments !== undefined) allowed.clientComments = updateData.clientComments;
        updateData = allowed;
      }
      const updated = await storage.updateReport(req.params.id, user.companyId, updateData);
      await logReportActivity(req.params.id, "updated", user.id, user.role, { fields: Object.keys(updateData) });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Send report to employee/client — supports account delivery + email delivery
  app.post("/api/reports/:id/send", requireRole("admin"), async (req: any, res) => {
    try {
      const { user } = req;
      const report = await storage.getReport(req.params.id, user.companyId);
      if (!report) { res.status(404).json({ message: "Report not found" }); return; }

      const {
        sendToEmployee = false,
        sendToClient = false,
        sendToEmployeeEmail = false,
        sendToClientEmail = false,
      } = req.body;

      // Update in-app delivery flags
      const updateData: any = { sentAt: new Date().toISOString(), status: "sent" };
      if (sendToEmployee) updateData.sentToEmployee = true;
      if (sendToClient) updateData.sentToClient = true;
      const updated = await storage.updateReport(req.params.id, user.companyId, updateData);

      // Build base app URL for CTA links
      const appUrl = `${req.protocol}://${req.get("host")}`;
      const company = await storage.getCompany(user.companyId);
      const companyName = company?.name || "ClockField";

      // Track email delivery results for response
      const emailResults: Array<{ recipient: string; ok: boolean; error?: string }> = [];

      // Helper: generate a secure access token for one recipient
      async function issueReportToken(recipientType: string, recipientEmail: string, requiresSignature: boolean) {
        // Revoke any existing unused tokens for this report + recipientType
        const existing = await db.select().from(reportAccessTokens)
          .where(and(
            eq(reportAccessTokens.reportId, report.id),
            eq(reportAccessTokens.recipientType, recipientType),
            isNull(reportAccessTokens.revokedAt),
            isNull(reportAccessTokens.signedAt),
          )).limit(1);
        for (const t of existing) {
          await storage.updateReportAccessToken(t.id, { revokedAt: new Date().toISOString() });
        }
        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const perms: string[] = ["read", "download"];
        if (requiresSignature) perms.push("sign");
        await storage.createReportAccessToken({
          reportId: report.id,
          recipientType,
          recipientEmail,
          tokenHash,
          permissions: perms,
          createdAt: new Date().toISOString(),
          expiresAt: null,
          revokedAt: null,
          lastAccessedAt: null,
          signedAt: null,
          createdByUserId: user.id,
        });
        return rawToken;
      }

      // Send email to assigned employee
      if (sendToEmployeeEmail && report.assignedEmployeeId) {
        const empUser = await storage.getUser(report.assignedEmployeeId);
        if (empUser?.email) {
          try {
            const rawToken = await issueReportToken("employee", empUser.email, !!report.requiresEmployeeSignature);
            const reportUrl = `${appUrl}/public/reports/${rawToken}`;
            await sendReportEmail({
              to: empUser.email,
              recipientName: `${empUser.firstName} ${empUser.lastName}`.trim() || empUser.email,
              reportType: report.reportType,
              reportTitle: report.title,
              reportDate: report.incidentDate || null,
              companyName,
              reportUrl,
              requiresSignature: !!report.requiresEmployeeSignature,
            });
            emailResults.push({ recipient: "employee", ok: true });
            await logReportActivity(report.id, "email_sent", user.id, user.role, {
              recipientType: "employee", to: empUser.email,
            });
          } catch (err: any) {
            emailResults.push({ recipient: "employee", ok: false, error: "Email could not be delivered" });
          }
        } else {
          emailResults.push({ recipient: "employee", ok: false, error: "No email on file" });
        }
      }

      // Send email to assigned client
      if (sendToClientEmail && report.assignedClientId) {
        const clientRecord = await storage.getClient(report.assignedClientId);
        const clientEmail = clientRecord?.contactEmail;
        if (clientEmail) {
          try {
            const rawToken = await issueReportToken("client", clientEmail, !!report.requiresClientSignature);
            const reportUrl = `${appUrl}/public/reports/${rawToken}`;
            await sendReportEmail({
              to: clientEmail,
              recipientName: clientRecord?.contactName || clientRecord?.name || clientEmail,
              reportType: report.reportType,
              reportTitle: report.title,
              reportDate: report.incidentDate || null,
              companyName,
              reportUrl,
              requiresSignature: !!report.requiresClientSignature,
            });
            emailResults.push({ recipient: "client", ok: true });
            await logReportActivity(report.id, "email_sent", user.id, user.role, {
              recipientType: "client", to: clientEmail,
            });
          } catch (err: any) {
            emailResults.push({ recipient: "client", ok: false, error: "Email could not be delivered" });
          }
        } else {
          emailResults.push({ recipient: "client", ok: false, error: "No email on file" });
        }
      }

      await logReportActivity(req.params.id, "sent", user.id, user.role, {
        sendToEmployee, sendToClient, sendToEmployeeEmail, sendToClientEmail,
      });

      res.json({ ...updated, emailResults });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Sign report
  app.post("/api/reports/:id/sign", requireAuth, async (req: any, res) => {
    try {
      const { user } = req;
      const report = await storage.getReport(req.params.id, user.companyId);
      if (!report) { res.status(404).json({ message: "Report not found" }); return; }
      const existing = await storage.getReportSignatureByUser(req.params.id, user.id);
      if (existing) { res.status(400).json({ message: "Already signed" }); return; }
      const { signerName, acknowledgementText, signatureType, signatureDataUrl } = req.body;
      if (!signerName) { res.status(400).json({ message: "Signer name is required" }); return; }
      const resolvedType: "drawn" | "typed" = signatureType === "drawn" ? "drawn" : "typed";
      const now = new Date().toISOString();
      const sig = await storage.createReportSignature({
        reportId: req.params.id,
        signerUserId: user.id,
        signerRole: user.role,
        signerName,
        signatureType: resolvedType,
        signedAt: now,
        acknowledgementText: acknowledgementText || null,
        signatureDataUrl: resolvedType === "drawn" ? (signatureDataUrl || null) : null,
      });
      await logReportActivity(req.params.id, "signed", user.id, user.role, { signerName });
      // Update status if awaiting signature
      if (report.status === "awaiting_signature") {
        await storage.updateReport(req.params.id, user.companyId, { status: "in_review" });
      }
      res.json(sig);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Finalize report (admin only)
  app.post("/api/reports/:id/finalize", requireRole("admin"), async (req: any, res) => {
    try {
      const { user } = req;
      const report = await storage.getReport(req.params.id, user.companyId);
      if (!report) { res.status(404).json({ message: "Report not found" }); return; }
      const updated = await storage.updateReport(req.params.id, user.companyId, {
        status: "finalized",
        finalizedAt: new Date().toISOString(),
        ...req.body,
      });
      await logReportActivity(req.params.id, "finalized", user.id, user.role);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Archive report (admin only)
  app.post("/api/reports/:id/archive", requireRole("admin"), async (req: any, res) => {
    try {
      const { user } = req;
      const updated = await storage.updateReport(req.params.id, user.companyId, {
        status: "archived",
        archivedAt: new Date().toISOString(),
      });
      await logReportActivity(req.params.id, "archived", user.id, user.role);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Reopen report (admin only)
  app.post("/api/reports/:id/reopen", requireRole("admin"), async (req: any, res) => {
    try {
      const { user } = req;
      const updated = await storage.updateReport(req.params.id, user.companyId, { status: "in_review" });
      await logReportActivity(req.params.id, "reopened", user.id, user.role);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Delete report (admin only, draft only)
  app.delete("/api/reports/:id", requireRole("admin"), async (req: any, res) => {
    try {
      const { user } = req;
      const report = await storage.getReport(req.params.id, user.companyId);
      if (!report) { res.status(404).json({ message: "Report not found" }); return; }
      await storage.deleteReport(req.params.id, user.companyId);
      res.json({ message: "Deleted" });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Get report activity log
  app.get("/api/reports/:id/activity", requireAuth, async (req: any, res) => {
    try {
      const { user } = req;
      const report = await storage.getReport(req.params.id, user.companyId);
      if (!report) { res.status(404).json({ message: "Report not found" }); return; }
      const activity = await storage.getReportActivity(req.params.id);
      res.json(activity);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Upload attachment to report
  app.post("/api/reports/:id/attachments", requireAuth, async (req: any, res) => {
    try {
      const { user } = req;
      const report = await storage.getReport(req.params.id, user.companyId);
      if (!report) { res.status(404).json({ message: "Report not found" }); return; }
      const { fileUrl, fileType, fileName } = req.body;
      if (!fileUrl) { res.status(400).json({ message: "fileUrl required" }); return; }
      const existing: any[] = report.attachments ? JSON.parse(report.attachments) : [];
      const updated_attachments = [...existing, { url: fileUrl, type: fileType || "image", name: fileName || "attachment" }];
      const updated = await storage.updateReport(req.params.id, user.companyId, {
        attachments: JSON.stringify(updated_attachments),
      });
      await logReportActivity(req.params.id, "attachment_added", user.id, user.role, { fileName });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Submit report (employee/client → admin)
  app.post("/api/reports/:id/submit", requireAuth, async (req: any, res) => {
    try {
      const { user } = req;
      const report = await storage.getReport(req.params.id, user.companyId);
      if (!report) { res.status(404).json({ message: "Report not found" }); return; }
      if (report.createdByUserId !== user.id) { res.status(403).json({ message: "Access denied" }); return; }
      const updated = await storage.updateReport(req.params.id, user.companyId, { status: "submitted" });
      await logReportActivity(req.params.id, "submitted", user.id, user.role);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ─── Public Report Access (token-based, no auth required) ──────────────────
  app.get("/api/public/reports/:token", async (req, res) => {
    try {
      const tokenHash = createHash("sha256").update(req.params.token).digest("hex");
      const tokenRecord = await storage.getReportAccessTokenByHash(tokenHash);
      if (!tokenRecord) {
        res.status(404).json({ error: "invalid_token", message: "This report link is no longer available." });
        return;
      }
      if (tokenRecord.revokedAt) {
        res.status(410).json({ error: "revoked", message: "This report link has been revoked. Please contact the sender for a new link." });
        return;
      }
      // Fetch the report — no companyId check since token proves access
      const [reportRow] = await db.select().from(reports).where(eq(reports.id, tokenRecord.reportId)).limit(1);
      if (!reportRow) {
        res.status(404).json({ error: "not_found", message: "Report not found." });
        return;
      }
      if (reportRow.status === "archived") {
        res.status(410).json({ error: "archived", message: "This report is no longer available." });
        return;
      }
      // Track last access
      await storage.updateReportAccessToken(tokenRecord.id, { lastAccessedAt: new Date().toISOString() });
      // Update report viewed_at for the recipient
      if (tokenRecord.recipientType === "employee" && !reportRow.employeeViewedAt) {
        await storage.updateReport(reportRow.id, reportRow.companyId, { employeeViewedAt: new Date().toISOString() });
      } else if (tokenRecord.recipientType === "client" && !reportRow.clientViewedAt) {
        await storage.updateReport(reportRow.id, reportRow.companyId, { clientViewedAt: new Date().toISOString() });
      }
      // Fetch related data for display
      const [company, locationRow, employeeUser, clientRecord] = await Promise.all([
        storage.getCompany(reportRow.companyId),
        reportRow.assignedLocationId ? db.select().from(locations).where(eq(locations.id, reportRow.assignedLocationId)).limit(1).then(r => r[0]) : null,
        reportRow.assignedEmployeeId ? storage.getUser(reportRow.assignedEmployeeId) : null,
        reportRow.assignedClientId ? storage.getClient(reportRow.assignedClientId) : null,
      ]);
      const signatures = await storage.getReportSignatures(reportRow.id);
      // Determine if this token has already signed
      const alreadySigned = !!tokenRecord.signedAt;
      // Strip admin-only fields from public response
      const { internalNotes: _internalNotes, adminFindings: _adminFindings, ...publicReport } = reportRow as any;
      res.json({
        report: publicReport,
        company: company ? { name: company.name, companyLogoUrl: (company as any).companyLogoUrl || null } : null,
        location: locationRow ? { name: locationRow.name, address: locationRow.address } : null,
        employee: employeeUser ? { firstName: employeeUser.firstName, lastName: employeeUser.lastName } : null,
        client: clientRecord ? { name: clientRecord.name, contactName: clientRecord.contactName } : null,
        signatures: signatures.map(s => ({
          signerName: s.signerName,
          signerRole: s.signerRole,
          signedAt: s.signedAt,
          signatureType: s.signatureType,
          signatureDataUrl: s.signatureDataUrl || null,
        })),
        access: {
          recipientType: tokenRecord.recipientType,
          recipientEmail: tokenRecord.recipientEmail,
          permissions: tokenRecord.permissions,
          alreadySigned,
        },
      });
    } catch (err: any) { res.status(500).json({ error: "server_error", message: "An error occurred. Please try again later." }); }
  });

  app.post("/api/public/reports/:token/sign", async (req, res) => {
    try {
      const tokenHash = createHash("sha256").update(req.params.token).digest("hex");
      const tokenRecord = await storage.getReportAccessTokenByHash(tokenHash);
      if (!tokenRecord) {
        res.status(404).json({ error: "invalid_token", message: "This report link is no longer available." });
        return;
      }
      if (tokenRecord.revokedAt) {
        res.status(410).json({ error: "revoked", message: "This report link has been revoked." });
        return;
      }
      if (tokenRecord.signedAt) {
        res.status(409).json({ error: "already_signed", message: "This report has already been signed." });
        return;
      }
      if (!tokenRecord.permissions.includes("sign")) {
        res.status(403).json({ error: "not_allowed", message: "Signing is not allowed for this report." });
        return;
      }
      const [reportRow] = await db.select().from(reports).where(eq(reports.id, tokenRecord.reportId)).limit(1);
      if (!reportRow) { res.status(404).json({ error: "not_found", message: "Report not found." }); return; }
      // Prevent duplicate signing via token
      const existingTokenSig = await storage.getReportSignatureByToken(reportRow.id, tokenRecord.id);
      if (existingTokenSig) {
        res.status(409).json({ error: "already_signed", message: "This report has already been signed." });
        return;
      }
      const { signerName, signatureType, signatureDataUrl, acknowledgementText } = req.body;
      if (!signerName?.trim()) {
        res.status(400).json({ error: "validation", message: "Signer name is required." });
        return;
      }
      if (!["typed", "drawn"].includes(signatureType)) {
        res.status(400).json({ error: "validation", message: "Invalid signature type." });
        return;
      }
      if (signatureType === "drawn" && !signatureDataUrl) {
        res.status(400).json({ error: "validation", message: "Signature drawing is required." });
        return;
      }
      const now = new Date().toISOString();
      const sig = await storage.createReportSignature({
        reportId: reportRow.id,
        signerUserId: null,
        signerRole: tokenRecord.recipientType, // "employee" or "client"
        signerName: signerName.trim(),
        signatureType,
        signedAt: now,
        acknowledgementText: acknowledgementText || "I confirm I have reviewed this report.",
        signatureDataUrl: signatureDataUrl || null,
        publicAccessTokenId: tokenRecord.id,
      });
      // Mark token as signed
      await storage.updateReportAccessToken(tokenRecord.id, { signedAt: now });
      // Log the activity using a placeholder userId (the token's creator)
      await storage.createReportActivity({
        reportId: reportRow.id,
        action: "signed",
        actionByUserId: tokenRecord.createdByUserId || reportRow.createdByUserId,
        actionByRole: tokenRecord.recipientType,
        metadata: JSON.stringify({ signerName: signerName.trim(), via: "public_link", recipientType: tokenRecord.recipientType }),
        createdAt: now,
      });
      // Update report status if awaiting signature
      if (reportRow.status === "awaiting_signature" || reportRow.status === "sent") {
        await storage.updateReport(reportRow.id, reportRow.companyId, { status: "in_review", updatedAt: now });
      }
      res.json({ ok: true, signedAt: now, signerName: signerName.trim() });
    } catch (err: any) { res.status(500).json({ error: "server_error", message: "An error occurred. Please try again later." }); }
  });

  // ── Field Notes Module ──────────────────────────────────────────────────────
  const fnAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const role = (req.user as any)?.role;
    if (role !== "admin" && role !== "employee") return res.status(403).json({ message: "Forbidden" });
    next();
  };

  // GET /api/field-notes — list sessions for company
  app.get("/api/field-notes", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { locationId, userId, status } = req.query as any;
      const filters: any = {};
      if (locationId) filters.locationId = locationId;
      if (status) filters.status = status;
      // Employees only see their own sessions
      if (user.role === "employee") filters.userId = user.id;
      else if (userId) filters.userId = userId;
      const sessions = await storage.getFieldNotesSessions(user.companyId, filters);
      // Enrich with creator name and location name
      const userIds = [...new Set(sessions.map(s => s.createdByUserId))];
      const locationIds = [...new Set(sessions.map(s => s.locationId).filter(Boolean))];
      const [allUsers, allLocations] = await Promise.all([
        userIds.length ? db.select().from(users).where(inArray(users.id, userIds)) : Promise.resolve([]),
        locationIds.length ? db.select().from(locations).where(inArray(locations.id, locationIds as string[])) : Promise.resolve([]),
      ]);
      const userMap = Object.fromEntries(allUsers.map((u: any) => [u.id, u]));
      const locationMap = Object.fromEntries(allLocations.map((l: any) => [l.id, l]));
      // Fetch photo counts per session
      const sessionIds = sessions.map(s => s.id);
      const assetRows = sessionIds.length
        ? await db.select().from(fieldNotesAssets).where(inArray(fieldNotesAssets.sessionId, sessionIds))
        : [];
      const photoCountMap: Record<string, number> = {};
      for (const a of assetRows) { photoCountMap[a.sessionId] = (photoCountMap[a.sessionId] || 0) + 1; }
      const enriched = sessions.map(s => ({
        ...s,
        createdByName: userMap[s.createdByUserId] ? `${userMap[s.createdByUserId].firstName} ${userMap[s.createdByUserId].lastName}` : "Unknown",
        locationName: s.locationId && locationMap[s.locationId] ? locationMap[s.locationId].name : null,
        photoCount: photoCountMap[s.id] ?? 0,
      }));
      res.json(enriched);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/field-notes/sessions/:sessionId — get session detail
  app.get("/api/field-notes/sessions/:sessionId", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (user.role === "employee" && session.createdByUserId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const [assets, chunks, entries, tags] = await Promise.all([
        storage.getFieldNotesAssets(session.id),
        storage.getFieldNotesTranscriptChunks(session.id),
        storage.getFieldNotesEntries(session.id),
        storage.getFieldNotesEntryTags(session.id),
      ]);
      // Attach tags to entries
      const entriesWithTags = entries.map(e => ({
        ...e,
        tags: tags.filter(t => t.entryId === e.id).map(t => t.tagName),
      }));
      // Get location name
      let locationName = null;
      if (session.locationId) {
        const loc = await storage.getLocation(session.locationId);
        locationName = loc?.name ?? null;
      }
      // Enrich with creator name
      const [creator] = await db.select().from(users).where(eq(users.id, session.createdByUserId));
      const createdByName = creator ? `${creator.firstName} ${creator.lastName}` : "Unknown";
      // Check if public share exists
      const [publicDoc] = await db.select().from(fieldNotesPublicDocuments).where(eq(fieldNotesPublicDocuments.sessionId, session.id));
      res.json({ ...session, createdByName, locationName, assets, transcriptChunks: chunks, entries: entriesWithTags, publicDoc: publicDoc ?? null });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/field-notes/sessions — start new session (walkthrough or manual page)
  app.post("/api/field-notes/sessions", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { locationId, sessionType, title, deviceType, locationLat, locationLng, locationText, sessionSubtype, status, aiStatus } = req.body;
      const isManualPage = sessionSubtype === "manual_page";
      const now = new Date().toISOString();
      const session = await storage.createFieldNotesSession({
        companyId: user.companyId,
        locationId: locationId || null,
        createdByUserId: user.id,
        createdByRole: user.role,
        sessionType: sessionType || "site_visit",
        sessionSubtype: sessionSubtype || "walkthrough_note",
        title: title || null,
        status: isManualPage ? "ready" : (status || "recording"),
        startedAt: now,
        endedAt: isManualPage ? now : null,
        locationLat: locationLat ? String(locationLat) : null,
        locationLng: locationLng ? String(locationLng) : null,
        locationText: locationText || null,
        deviceType: deviceType || null,
        aiStatus: isManualPage ? "done" : (aiStatus || "pending"),
        aiSummary: null,
        clientSafeSummary: null,
        createdAt: now,
        updatedAt: now,
      } as any);
      res.json(session);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/field-notes/sessions/:sessionId/photo — upload photo
  app.post("/api/field-notes/sessions/:sessionId/photo", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (user.role === "employee" && session.createdByUserId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const { fileUrl, caption, sequenceIndex, phase } = req.body;
      if (!fileUrl) return res.status(400).json({ message: "fileUrl required" });
      const now = new Date().toISOString();
      const asset = await storage.addFieldNotesAsset({
        sessionId: session.id,
        uploadedByUserId: user.id,
        assetType: "photo",
        fileUrl,
        sequenceIndex: sequenceIndex ?? 0,
        capturedAt: now,
        caption: caption || null,
        phase: phase === "after" ? "after" : "before",
        createdAt: now,
      } as any);
      res.json(asset);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/field-notes/sessions/:sessionId/transcript — add transcript chunk
  app.post("/api/field-notes/sessions/:sessionId/transcript", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (user.role === "employee" && session.createdByUserId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const { rawText, chunkIndex, startedAt, endedAt, phase } = req.body;
      if (!rawText) return res.status(400).json({ message: "rawText required" });
      const now = new Date().toISOString();
      const chunk = await storage.addFieldNotesTranscriptChunk({
        sessionId: session.id,
        chunkIndex: chunkIndex ?? 0,
        startedAt: startedAt || now,
        endedAt: endedAt || null,
        rawText,
        phase: phase || "before",
        createdAt: now,
      } as any);
      res.json(chunk);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/field-notes/sessions/:sessionId/stop — stop session
  app.post("/api/field-notes/sessions/:sessionId/stop", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (user.role === "employee" && session.createdByUserId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const now = new Date().toISOString();
      const updated = await storage.updateFieldNotesSession(session.id, {
        status: "uploading",
        endedAt: now,
      });
      // Kick off AI processing asynchronously
      processFieldNoteSession(session.id, user.companyId).catch(err => {
        console.error("[FieldNotes] AI processing error:", err.message);
        storage.updateFieldNotesSession(session.id, { aiStatus: "failed", status: "ready" });
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/field-notes/sessions/:sessionId/stop-recording — admin force-stop a stuck recording
  app.post("/api/field-notes/sessions/:sessionId/stop-recording", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (session.status !== "recording") return res.status(400).json({ message: "This Field Note is already stopped." });
      const now = new Date().toISOString();
      const updated = await storage.updateFieldNotesSession(session.id, { status: "uploading", endedAt: now });
      processFieldNoteSession(session.id, user.companyId).catch(err => {
        console.error("[FieldNotes] Admin force-stop AI processing error:", err.message);
        storage.updateFieldNotesSession(session.id, { aiStatus: "failed", status: "ready" });
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/field-notes/sessions/:sessionId/stop-after — finish after-walkthrough
  app.post("/api/field-notes/sessions/:sessionId/stop-after", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (user.role === "employee" && session.createdByUserId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const now = new Date().toISOString();
      await storage.updateFieldNotesSession(session.id, { afterStatus: "processing" } as any);
      // Asynchronously generate afterSummary from after transcript chunks
      (async () => {
        try {
          const allChunks = await storage.getFieldNotesTranscriptChunks(session.id);
          const afterChunks = allChunks.filter((c: any) => c.phase === "after");
          const afterText = afterChunks.map((c: any) => c.rawText).join(" ").trim();
          let afterSummary = "";
          if (afterText && process.env.OPENAI_API_KEY) {
            const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const result = await openaiClient.chat.completions.create({
              model: "gpt-4o-mini",
              max_tokens: 300,
              messages: [{
                role: "user",
                content: `You are summarizing after-service walkthrough notes for a cleaning/maintenance company. Write a concise 2-3 sentence professional summary of what was observed or completed during the after walkthrough. Be factual and specific. Transcript: "${afterText}"`,
              }],
            });
            afterSummary = result.choices[0]?.message?.content?.trim() ?? "";
          }
          await storage.updateFieldNotesSession(session.id, { afterStatus: "ready", afterSummary: afterSummary || null } as any);
        } catch (err: any) {
          console.error("[FieldNotes] after-walkthrough AI error:", err.message);
          await storage.updateFieldNotesSession(session.id, { afterStatus: "ready" } as any);
        }
      })();
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // DELETE /api/field-notes/sessions/:sessionId — soft-delete a session
  app.delete("/api/field-notes/sessions/:sessionId", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.updateFieldNotesSession(session.id, { deletedAt: new Date().toISOString() } as any);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/field-notes/sessions/:sessionId/process — retry AI processing
  app.post("/api/field-notes/sessions/:sessionId/process", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.updateFieldNotesSession(session.id, { aiStatus: "processing" });
      processFieldNoteSession(session.id, user.companyId).catch(err => {
        console.error("[FieldNotes] AI retry error:", err.message);
        storage.updateFieldNotesSession(session.id, { aiStatus: "failed", status: "ready" });
      });
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // PATCH /api/field-notes/sessions/:sessionId — update session title/notes/subtype/intro
  app.patch("/api/field-notes/sessions/:sessionId", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (user.role === "employee" && session.createdByUserId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const { title, aiSummary, afterSummary, clientSafeSummary, documentMode, quoteData, sessionSubtype, pageIntro, pageSummary, status, aiStatus } = req.body;
      const updated = await storage.updateFieldNotesSession(session.id, {
        ...(title !== undefined && { title }),
        ...(aiSummary !== undefined && { aiSummary }),
        ...(afterSummary !== undefined && { afterSummary }),
        ...(clientSafeSummary !== undefined && { clientSafeSummary }),
        ...(documentMode !== undefined && { documentMode }),
        ...(quoteData !== undefined && { quoteData: typeof quoteData === "string" ? quoteData : JSON.stringify(quoteData) }),
        ...(sessionSubtype !== undefined && { sessionSubtype }),
        ...(pageIntro !== undefined && { pageIntro }),
        ...(pageSummary !== undefined && { pageSummary }),
        ...(status !== undefined && { status }),
        ...(aiStatus !== undefined && { aiStatus }),
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // PATCH /api/field-notes/assets/:assetId — update caption or phase
  app.patch("/api/field-notes/assets/:assetId", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const [asset] = await db.select().from(fieldNotesAssets).where(eq(fieldNotesAssets.id, req.params.assetId));
      if (!asset) return res.status(404).json({ message: "Not found" });
      const session = await storage.getFieldNotesSession(asset.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });
      const { caption, phase, areaLabel, isHiddenFromPublic } = req.body;
      const updated = await storage.updateFieldNotesAsset(asset.id, {
        ...(caption !== undefined && { caption }),
        ...(phase !== undefined && { phase }),
        ...(areaLabel !== undefined && { areaLabel }),
        ...(isHiddenFromPublic !== undefined && { isHiddenFromPublic: !!isHiddenFromPublic }),
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/field-notes/assets/:assetId/ai-caption — AI-generate short photo caption
  app.post("/api/field-notes/assets/:assetId/ai-caption", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const [asset] = await db.select().from(fieldNotesAssets).where(eq(fieldNotesAssets.id, req.params.assetId));
      if (!asset) return res.status(404).json({ message: "Not found" });
      const session = await storage.getFieldNotesSession(asset.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });
      const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const result = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 80,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Describe this facility/jobsite photo in 1-2 short professional sentences suitable for a field note report. Be concise and factual. Focus on what is shown (equipment, area condition, materials, activity, etc.). Do not use flowery language. Output only the caption, no preamble." },
            { type: "image_url", image_url: { url: asset.fileUrl, detail: "low" } },
          ],
        }],
      });
      const caption = result.choices[0]?.message?.content?.trim() ?? "";
      const updated = await storage.updateFieldNotesAsset(asset.id, { caption });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/field-notes/sessions/:sessionId/todos — list todos
  app.get("/api/field-notes/sessions/:sessionId/todos", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const todos = await storage.getFieldNotesTodos(req.params.sessionId);
      res.json(todos);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/field-notes/sessions/:sessionId/todos — create todo
  app.post("/api/field-notes/sessions/:sessionId/todos", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const { text, sortOrder } = req.body;
      if (!text?.trim()) return res.status(400).json({ message: "text is required" });
      const now = new Date().toISOString();
      const todo = await storage.createFieldNotesTodo({
        sessionId: req.params.sessionId,
        text: text.trim(),
        isComplete: false,
        sortOrder: sortOrder ?? 0,
        createdAt: now,
      });
      res.status(201).json(todo);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // PATCH /api/field-notes/todos/:todoId — update todo (toggle/rename)
  app.patch("/api/field-notes/todos/:todoId", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { text, isComplete, sortOrder } = req.body;
      const updated = await storage.updateFieldNotesTodo(req.params.todoId, {
        ...(text !== undefined && { text: text.trim() }),
        ...(isComplete !== undefined && { isComplete: !!isComplete }),
        ...(sortOrder !== undefined && { sortOrder }),
      });
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // DELETE /api/field-notes/todos/:todoId — delete todo
  app.delete("/api/field-notes/todos/:todoId", fnAuth, async (req, res) => {
    try {
      await storage.deleteFieldNotesTodo(req.params.todoId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // PATCH /api/field-notes/entries/:entryId — edit AI entry
  app.patch("/api/field-notes/entries/:entryId", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { title, body, areaName, priority, recommendedAction, clientSafeSummary, assetIds, relatedTranscript, isHiddenFromPublic } = req.body;
      const updated = await storage.updateFieldNotesEntry(req.params.entryId, {
        ...(title !== undefined && { title }),
        ...(body !== undefined && { body }),
        ...(areaName !== undefined && { areaName }),
        ...(priority !== undefined && { priority }),
        ...(recommendedAction !== undefined && { recommendedAction }),
        ...(clientSafeSummary !== undefined && { clientSafeSummary }),
        ...(assetIds !== undefined && { assetIds: typeof assetIds === "string" ? assetIds : JSON.stringify(assetIds) }),
        ...(relatedTranscript !== undefined && { relatedTranscript }),
        ...(isHiddenFromPublic !== undefined && { isHiddenFromPublic: !!isHiddenFromPublic }),
      });
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Generate a short public ID for field notes: fn-XXXXXX (6 uppercase alphanumeric)
  async function generateUniqueShortId(): Promise<string> {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 20; attempt++) {
      let id = "fn-";
      for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
      const [existing] = await db.select({ id: fieldNotesPublicDocuments.id })
        .from(fieldNotesPublicDocuments).where(eq(fieldNotesPublicDocuments.publicShortId, id));
      if (!existing) return id;
    }
    // Fallback: 8-char ID after collision exhaustion
    let id = "fn-";
    for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  // POST /api/field-notes/sessions/:id/share — generate public share link
  app.post("/api/field-notes/sessions/:id/share", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.id);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (user.role === "employee" && session.createdByUserId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const { title, showTimestamps, showInternalNotes } = req.body;
      const now = new Date().toISOString();
      // Check if one already exists
      const [existing] = await db.select().from(fieldNotesPublicDocuments).where(eq(fieldNotesPublicDocuments.sessionId, session.id));
      if (existing) {
        // Backfill publicShortId if missing on existing doc
        let shortId = existing.publicShortId;
        if (!shortId) {
          shortId = await generateUniqueShortId();
          await db.update(fieldNotesPublicDocuments).set({ publicShortId: shortId }).where(eq(fieldNotesPublicDocuments.id, existing.id));
        }
        const updated = await db.update(fieldNotesPublicDocuments)
          .set({ isEnabled: true, title: title ?? existing.title, showTimestamps: !!showTimestamps, showInternalNotes: !!showInternalNotes, updatedAt: now })
          .where(eq(fieldNotesPublicDocuments.id, existing.id)).returning();
        return res.json({ ...updated[0], publicShortId: shortId, rawToken: existing.shareToken });
      }
      const rawToken = randomBytes(24).toString("hex");
      const publicShortId = await generateUniqueShortId();
      const [doc] = await db.insert(fieldNotesPublicDocuments).values({
        sessionId: session.id,
        companyId: user.companyId,
        shareToken: rawToken,
        publicShortId,
        title: title || session.title || null,
        isEnabled: true,
        showTimestamps: !!showTimestamps,
        showInternalNotes: !!showInternalNotes,
        createdByUserId: user.id,
        createdAt: now, updatedAt: now,
      }).returning();
      res.json({ ...doc, rawToken });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // DELETE /api/field-notes/sessions/:id/share — disable public share
  app.delete("/api/field-notes/sessions/:id/share", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.id);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      await db.update(fieldNotesPublicDocuments).set({ isEnabled: false, updatedAt: now })
        .where(eq(fieldNotesPublicDocuments.sessionId, session.id));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/public/field-notes/:token — public view (no auth)
  // Supports both short IDs (fn-XXXXXX) and legacy long hash tokens
  app.get("/api/public/field-notes/:token", async (req, res) => {
    try {
      const token = req.params.token;
      // Try short ID first, then fall back to legacy long shareToken
      let [doc] = await db.select().from(fieldNotesPublicDocuments).where(eq(fieldNotesPublicDocuments.publicShortId, token));
      if (!doc) [doc] = await db.select().from(fieldNotesPublicDocuments).where(eq(fieldNotesPublicDocuments.shareToken, token));
      if (!doc || !doc.isEnabled) return res.status(404).json({ message: "Not found or disabled" });
      const session = await storage.getFieldNotesSession(doc.sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      const [companyRow] = await db.select().from(companies).where(eq(companies.id, session.companyId));
      const [creator] = await db.select().from(users).where(eq(users.id, session.createdByUserId));
      const createdByName = creator ? `${creator.firstName} ${creator.lastName}` : "Unknown";
      let locationName = null;
      if (session.locationId) { const loc = await storage.getLocation(session.locationId); locationName = loc?.name ?? null; }
      const [assets, entries, chunks] = await Promise.all([
        storage.getFieldNotesAssets(session.id),
        storage.getFieldNotesEntries(session.id),
        storage.getFieldNotesTranscriptChunks(session.id),
      ]);
      // Filter: exclude hidden entries; only show client-safe entries unless showInternalNotes is on
      const publicEntries = entries.filter(e =>
        !(e as any).isHiddenFromPublic &&
        (doc.showInternalNotes || (e as any).clientSafeSummary || e.body)
      );
      // Filter: exclude hidden assets
      const publicAssets = assets.filter(a => !(a as any).isHiddenFromPublic);
      res.json({
        session: { ...session, createdByName, locationName },
        company: { name: companyRow?.name, companyLogoUrl: (companyRow as any)?.companyLogoUrl ?? null },
        entries: publicEntries,
        assets: publicAssets.map(a => ({ id: a.id, fileUrl: a.fileUrl, capturedAt: a.capturedAt, areaLabel: (a as any).areaLabel ?? null, phase: a.phase ?? null, caption: a.caption ?? null })),
        transcriptChunks: doc.showInternalNotes ? chunks : [],
        hasTranscript: chunks.length > 0,
        publicDoc: doc,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/public/field-notes/:token/quote-response — accept or decline a quote (no auth)
  app.post("/api/public/field-notes/:token/quote-response", async (req, res) => {
    try {
      const token = req.params.token;
      let [doc] = await db.select().from(fieldNotesPublicDocuments).where(eq(fieldNotesPublicDocuments.publicShortId, token));
      if (!doc) [doc] = await db.select().from(fieldNotesPublicDocuments).where(eq(fieldNotesPublicDocuments.shareToken, token));
      if (!doc || !doc.isEnabled) return res.status(404).json({ message: "Not found" });
      const session = await storage.getFieldNotesSession(doc.sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      const { action, reason } = req.body;
      if (!["accept", "decline"].includes(action)) return res.status(400).json({ message: "Invalid action" });
      if (action === "decline" && !reason?.trim()) return res.status(400).json({ message: "A reason is required when declining" });
      let quoteData: any = {};
      try { quoteData = JSON.parse((session as any).quoteData || "{}"); } catch {}
      const now = new Date().toISOString();
      if (action === "accept") {
        quoteData.quoteStatus = "accepted";
        quoteData.quoteAcceptedAt = now;
        delete quoteData.quoteDeclinedAt;
        delete quoteData.quoteDeclineReason;
      } else {
        quoteData.quoteStatus = "declined";
        quoteData.quoteDeclinedAt = now;
        quoteData.quoteDeclineReason = reason.trim();
        delete quoteData.quoteAcceptedAt;
      }
      await storage.updateFieldNotesSession(session.id, { quoteData: JSON.stringify(quoteData) } as any);
      res.json({ success: true, status: action === "accept" ? "accepted" : "declined" });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/field-notes/sessions/:id/generate-scope — AI scope summary
  app.post("/api/field-notes/sessions/:id/generate-scope", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = await storage.getFieldNotesSession(req.params.id);
      if (!session || session.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const [openaiClient] = getOpenAIClient();
      if (!openaiClient) return res.status(503).json({ message: "AI not available" });
      let quoteData: any = {};
      try { quoteData = JSON.parse((session as any).quoteData || "{}"); } catch {}
      const entries: any[] = (session as any).entries ?? [];
      const entryText = entries.map(e => e.body || "").filter(Boolean).join("\n");
      const prompt = [
        "You are an assistant generating a professional service scope summary for a commercial cleaning proposal.",
        "Based on the field note entries below, write 2–3 concise sentences describing what cleaning services are needed and what was observed.",
        "Be specific about areas mentioned. Write in third person, professional tone.",
        "",
        "Property details from quote form:",
        quoteData.squareFootage ? `- Square footage: ${quoteData.squareFootage}` : "",
        quoteData.numOffices ? `- Offices: ${quoteData.numOffices}` : "",
        quoteData.numWashrooms ? `- Washrooms: ${quoteData.numWashrooms}` : "",
        quoteData.numKitchens ? `- Kitchens/break rooms: ${quoteData.numKitchens}` : "",
        quoteData.serviceFrequency ? `- Service frequency: ${quoteData.serviceFrequency}` : "",
        quoteData.includedAreas ? `- Included areas: ${quoteData.includedAreas}` : "",
        "",
        "Field note observations:",
        entryText || "(no observations recorded)",
      ].filter(l => l !== undefined).join("\n");
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.4,
      });
      const scopeSummary = completion.choices[0]?.message?.content?.trim() || "";
      quoteData.scopeSummary = scopeSummary;
      await storage.updateFieldNotesSession(session.id, { quoteData: JSON.stringify(quoteData) } as any);
      res.json({ scopeSummary });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/field-notes/assets/:assetId/image — serve photo
  app.get("/api/field-notes/assets/:assetId/image", fnAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const [asset] = await db.select().from(fieldNotesAssets)
        .where(eq(fieldNotesAssets.id, req.params.assetId));
      if (!asset) return res.status(404).end();
      const session = await storage.getFieldNotesSession(asset.sessionId);
      if (!session || session.companyId !== user.companyId) return res.status(403).end();
      const base64 = asset.fileUrl.replace(/^data:image\/\w+;base64,/, "");
      const buf = Buffer.from(base64, "base64");
      const ct = asset.fileUrl.match(/^data:(image\/\w+);base64,/)?.[1] ?? "image/jpeg";
      res.set("Content-Type", ct).set("Cache-Control", "private, max-age=86400").send(buf);
    } catch (err: any) { res.status(500).end(); }
  });

  // ── Photo area classification (GPT-4o-mini vision) ───────────────────────────
  async function classifyPhotos(assets: any[], openaiClient: OpenAI) {
    if (assets.length === 0) return;
    const BATCH_SIZE = 5;
    const AREA_OPTIONS = ["Kitchen", "Washroom", "Hallway", "Office", "Entrance", "Break Room", "Storage Room", "Exterior", "Dining Area", "Floor Area", "Common Area", "Mechanical Room", "General Facility"];
    for (let i = 0; i < assets.length; i += BATCH_SIZE) {
      const batch = assets.slice(i, i + BATCH_SIZE);
      try {
        const imageContent: any[] = [
          { type: "text", text: `You are classifying facility photos for a cleaning company site visit. For each image below (numbered 1 to ${batch.length}), identify the type of area/room shown. Valid area types: ${AREA_OPTIONS.join(", ")}. Return JSON only: {"classifications":[{"index":1,"area":"...","confidence":"high|medium|low"},...]}.` },
          ...batch.map(asset => ({ type: "image_url", image_url: { url: asset.fileUrl, detail: "low" } })),
        ];
        const result = await openaiClient.chat.completions.create({ model: "gpt-4o-mini", response_format: { type: "json_object" }, max_tokens: 400, messages: [{ role: "user", content: imageContent }] });
        const parsed = JSON.parse(result.choices[0]?.message?.content ?? "{}");
        if (Array.isArray(parsed.classifications)) {
          for (const item of parsed.classifications) {
            const idx = (item.index ?? 0) - 1;
            if (idx >= 0 && idx < batch.length) {
              await db.update(fieldNotesAssets).set({ areaLabel: item.area || "General Facility", areaConfidence: item.confidence || "low" } as any).where(eq(fieldNotesAssets.id, batch[idx].id));
            }
          }
        }
      } catch (e: any) { console.error("[FieldNotes] Classification batch failed:", e.message); }
      if (i + BATCH_SIZE < assets.length) await new Promise(r => setTimeout(r, 150));
    }
  }

  // ── Field Notes: Transcript pre-cleaning ──────────────────────────────────
  function cleanTranscript(raw: string): string {
    if (!raw) return raw;
    // Remove filler words at word boundaries
    let cleaned = raw
      .replace(/\b(um+|uh+|er+|ah+|hmm+|mhm|uh-huh)\b/gi, "")
      .replace(/\blike,?\s+like\b/gi, "like")
      .replace(/\byou know,?\s+/gi, "")
      .replace(/\bI mean,?\s+/gi, "")
      .replace(/\bso,?\s+so\b/gi, "so")
      .replace(/\band,?\s+and\b/gi, "and")
      // Collapse multiple spaces
      .replace(/\s{2,}/g, " ")
      .trim();
    // Remove very short fragment repetitions (duplicate 3+ word phrases)
    const words = cleaned.split(" ");
    if (words.length > 6) {
      const deduped: string[] = [];
      for (let i = 0; i < words.length; i++) {
        const phrase = words.slice(i, i + 4).join(" ").toLowerCase();
        const prev = words.slice(Math.max(0, i - 4), i).join(" ").toLowerCase();
        if (i > 4 && prev.includes(phrase) && phrase.split(" ").length >= 3) continue;
        deduped.push(words[i]);
      }
      cleaned = deduped.join(" ");
    }
    return cleaned;
  }

  // ── Field Notes AI Processing ────────────────────────────────────────────────
  async function processFieldNoteSession(sessionId: string, companyId: string) {
    const now = new Date().toISOString();
    await storage.updateFieldNotesSession(sessionId, { status: "processing", aiStatus: "processing" });
    const session = await storage.getFieldNotesSession(sessionId);
    if (!session) return;
    const [chunks, assets] = await Promise.all([
      storage.getFieldNotesTranscriptChunks(sessionId),
      storage.getFieldNotesAssets(sessionId),
    ]);
    const rawTranscript = chunks.map(c => c.rawText).join(" ").trim();
    const fullTranscript = cleanTranscript(rawTranscript);
    if (!fullTranscript && assets.length === 0) {
      await storage.updateFieldNotesSession(sessionId, { status: "ready", aiStatus: "done", aiSummary: "No transcript or photos captured.", clientSafeSummary: "Site visit recorded." });
      return;
    }
    let locationName = "";
    if (session.locationId) { const loc = await storage.getLocation(session.locationId); locationName = loc?.name ?? ""; }

    // ── Step 1: Link photos to transcript chunks by timestamp ──────────────────
    function linkPhotoToChunk(capturedAt: string | null) {
      if (!capturedAt || chunks.length === 0) return null;
      const capturedMs = new Date(capturedAt).getTime();
      if (isNaN(capturedMs)) return null;
      let best: any = null; let bestScore = Infinity;
      for (const chunk of chunks) {
        if (!chunk.startedAt) continue;
        const startMs = new Date(chunk.startedAt).getTime();
        const endMs = (chunk as any).endedAt ? new Date((chunk as any).endedAt).getTime() : startMs + 30000;
        if (capturedMs >= startMs - 2000 && capturedMs <= endMs + 3000) return chunk; // active match
        const diff = capturedMs < startMs ? startMs - capturedMs : capturedMs - endMs;
        if (diff <= 15000 && diff < bestScore) { best = chunk; bestScore = diff; }
      }
      return best;
    }
    const photoLinks = assets.map((asset, idx) => ({
      asset,
      idx,
      chunk: linkPhotoToChunk(asset.capturedAt),
    }));

    // ── Step 2: Build fallback entries (used if AI fails) ──────────────────────
    async function saveFallbackEntries() {
      for (const { asset, idx, chunk } of photoLinks) {
        const relTx = chunk?.rawText ?? null;
        await storage.createFieldNotesEntry({
          sessionId,
          entryType: "observation",
          areaName: null,
          title: `Photo ${idx + 1}` + (relTx ? ` — ${relTx.slice(0, 40)}${relTx.length > 40 ? "…" : ""}` : ""),
          body: relTx ?? "Photo captured during site visit.",
          clientSafeSummary: null,
          priority: "normal",
          sortOrder: idx,
          photoIndexes: JSON.stringify([idx]),
          assetIds: JSON.stringify([asset.id]),
          relatedTranscript: relTx,
          issueDetected: false,
          recommendedAction: null,
          createdByAi: false,
          createdAt: now, updatedAt: now,
        } as any);
      }
      if (assets.length === 0 && fullTranscript) {
        await storage.createFieldNotesEntry({
          sessionId, entryType: "general_note", areaName: null,
          title: "Voice Recording", body: fullTranscript,
          clientSafeSummary: null, priority: "normal", sortOrder: 0,
          photoIndexes: null, assetIds: null, relatedTranscript: fullTranscript,
          issueDetected: false, recommendedAction: null, createdByAi: false,
          createdAt: now, updatedAt: now,
        } as any);
      }
    }

    // ── Step 3: Classify photos by area (GPT-4o-mini vision) ──────────────────
    const openaiForClassify = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    await classifyPhotos(assets, openaiForClassify);
    // Re-fetch assets to pick up area labels
    const classifiedAssets = await storage.getFieldNotesAssets(sessionId);
    const assetAreaMap = new Map(classifiedAssets.map(a => [a.id, (a as any).areaLabel ?? null]));

    // ── Step 4: Build AI prompt with linked photo-transcript data ──────────────
    const linkedPhotos = photoLinks.map(({ asset, idx, chunk }) => ({
      photo_id: asset.id,
      photo_index: idx,
      captured_at: asset.capturedAt,
      linked_transcript: chunk?.rawText ?? null,
      area_label: assetAreaMap.get(asset.id) ?? null,
    }));

    // ── Step 5: Call OpenAI ───────────────────────────────────────────────────
    let entryList: any[] = [];
    let sessionSummary = "";
    let clientSafe = "";
    try {
      const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a professional field report generator for service companies (cleaning, maintenance, construction, inspection). You produce accurate, grounded, structured site visit reports.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GROUNDING — THE MOST CRITICAL RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONLY include observations that are directly supported by:
• The transcript (something the user said)
• The photo context (area_label from photo classification)
• Both together

NEVER invent observations, measurements, or conditions not mentioned.
If confidence is low, omit the detail entirely.
A short accurate report is far better than a long hallucinated one.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISIT TYPE CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Classify this note as one of these visit_type values:
• "site_visit" — general walkthrough or initial assessment
• "cleaning_walkthrough" — pre-clean or cleaning service assessment
• "inspection" — condition inspection or quality check
• "before_service" — pre-service documentation
• "after_service" — post-service result documentation
• "progress_update" — ongoing project or service progress
• "maintenance_check" — routine maintenance or equipment check
• "client_update" — general client-facing update

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write like a professional sending a business email, not a compliance report.
GOOD: "The washroom floors show buildup near the edges."
GOOD: "Entrance glass has visible fingerprints."
BAD: "Critical compliance risk detected."
BAD: "Recommended remediation required."
BAD: "A comprehensive assessment was conducted."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPORT STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generate a professional report title using: location name, visit type, and date context.
Examples: "Main Office Cleaning Walkthrough", "Unit 204 Pre-Service Inspection", "Anderson House Progress Update"

SECTION GROUPING (critical):
• Group all photos with the same area_label into one section
• One section per distinct area type (Kitchen, Washroom, Hallway, etc.)
• Use transcript to add context within each section
• Create 2–8 sections based on distinct areas found
• Use specific names from transcript when available ("Back Kitchen", "Main Washroom")

BULLETS (required per section):
• Each section must have 2–6 short bullet observations
• Bullets must be grounded in transcript or photo context
• Each bullet: 1 sentence, max 12 words, factual and direct
• GOOD bullet: "Floor edges show buildup near the baseboard"
• GOOD bullet: "Paper dispensers appear stocked"
• BAD bullet: "Area requires professional cleaning attention"
• BAD bullet: "Standards were reviewed during the walkthrough"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT — return ONLY valid JSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "visit_type": "site_visit|cleaning_walkthrough|inspection|before_service|after_service|progress_update|maintenance_check|client_update",
  "report_title": "Professional specific title",
  "session_summary": "2-3 plain sentences: what areas were visited, what was seen, what the visit was for. Grounded only in actual transcript content.",
  "client_safe_summary": "1-2 sentences plain overview for the client.",
  "extracted_details": {
    "square_footage": "string or null",
    "num_floors": "string or null",
    "num_offices": "string or null",
    "num_washrooms": "string or null",
    "num_kitchens": "string or null",
    "num_hallways": "string or null",
    "num_entrances": "string or null",
    "special_surfaces": "string or null",
    "service_frequency": "string or null",
    "carpet_frequency": "string or null",
    "other_notes": "string or null"
  },
  "entries": [
    {
      "sort_order": 0,
      "entry_type": "observation|issue|general_note",
      "area_name": "specific area name or null",
      "title": "Short area heading (e.g. 'Main Washroom', 'Entrance Lobby', 'Back Kitchen')",
      "body": "1-2 sentences describing this area. Plain, grounded, professional.",
      "bullets": [
        "Short grounded observation — max 12 words",
        "Another grounded observation"
      ],
      "priority": "low|normal|high",
      "issue_detected": false,
      "recommended_action": "Only include if explicitly mentioned or clearly visible. Null otherwise.",
      "photo_ids": ["exact-uuid-from-linked_photos"],
      "related_transcript": "relevant excerpt or null",
      "tags": []
    }
  ]
}

FINAL RULES:
• photo_ids must use exact UUIDs from the photo_id fields in linked_photos
• Every photo must appear in exactly one entry
• Sort entries in photo capture order
• If no transcript exists, describe only what photos show via area_label
• If no photos exist, structure sections from transcript content only
• Specific and short is always better than generic and long`,
          },
          {
            role: "user",
            content: JSON.stringify({
              session_type: session.sessionType,
              location_name: locationName || "Unknown location",
              full_transcript: fullTranscript || "(no voice recording — base report on photo area labels only)",
              linked_photos: linkedPhotos,
            }),
          },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { parsed = {}; }
      sessionSummary = parsed.session_summary || "";
      clientSafe = parsed.client_safe_summary || "";
      entryList = Array.isArray(parsed.entries) ? parsed.entries : [];
      // Store visitType on session
      const detectedVisitType = parsed.visit_type || null;
      // Auto-fill title from AI report_title if session has no custom title
      const aiReportTitle = parsed.report_title || null;
      if (detectedVisitType || aiReportTitle) {
        const freshSession = await storage.getFieldNotesSession(sessionId);
        const updatePatch: any = {};
        if (detectedVisitType) updatePatch.visitType = detectedVisitType;
        if (aiReportTitle && !freshSession?.title) updatePatch.title = aiReportTitle;
        if (Object.keys(updatePatch).length > 0) {
          await storage.updateFieldNotesSession(sessionId, updatePatch as any);
        }
      }
      // Store any extracted property details into quoteData (only if session has none yet)
      if (parsed.extracted_details && typeof parsed.extracted_details === "object") {
        const det = parsed.extracted_details;
        const hasAny = Object.values(det).some(v => v !== null && v !== "" && v !== undefined);
        if (hasAny) {
          const freshSession = await storage.getFieldNotesSession(sessionId);
          let existingQuote: any = {};
          try { existingQuote = JSON.parse((freshSession as any)?.quoteData || "{}"); } catch {}
          const merged = { ...existingQuote, _aiExtracted: det };
          await storage.updateFieldNotesSession(sessionId, { quoteData: JSON.stringify(merged) } as any);
        }
      }
    } catch (aiErr: any) {
      console.error("[FieldNotes] AI call failed:", aiErr.message);
    }

    // ── Step 5: Save entries (or fallback) ────────────────────────────────────
    if (entryList.length === 0) {
      console.log("[FieldNotes] AI returned no entries — using fallback");
      await saveFallbackEntries();
      sessionSummary = sessionSummary || (fullTranscript ? fullTranscript.slice(0, 200) : "Site visit documented.");
      clientSafe = clientSafe || "Site visit completed.";
    } else {
      entryList.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
      for (let i = 0; i < entryList.length; i++) {
        const e = entryList[i];
        // Store bullets as JSON in clientSafeSummary for use in rendering
        const bulletsJson = Array.isArray(e.bullets) && e.bullets.length > 0
          ? JSON.stringify(e.bullets)
          : null;
        const entry = await storage.createFieldNotesEntry({
          sessionId,
          entryType: e.entry_type || "observation",
          areaName: e.area_name || null,
          title: e.title || `Note ${i + 1}`,
          body: e.body || "",
          clientSafeSummary: bulletsJson,
          priority: e.priority || "normal",
          sortOrder: i,
          photoIndexes: Array.isArray(e.photo_ids) ? JSON.stringify(e.photo_ids.map((id: string) => assets.findIndex(a => a.id === id)).filter((n: number) => n >= 0)) : null,
          assetIds: Array.isArray(e.photo_ids) ? JSON.stringify(e.photo_ids) : null,
          relatedTranscript: e.related_transcript || null,
          issueDetected: !!e.issue_detected,
          recommendedAction: e.recommended_action || null,
          createdByAi: true,
          createdAt: now, updatedAt: now,
        } as any);
        if (Array.isArray(e.tags)) {
          for (const tag of e.tags) {
            await db.insert(fieldNotesEntryTags).values({ entryId: entry.id, sessionId, tagName: String(tag), createdAt: now });
          }
        }
      }
    }
    await storage.updateFieldNotesSession(sessionId, {
      status: "ready", aiStatus: "done",
      aiSummary: sessionSummary || "Field notes processed.",
      clientSafeSummary: clientSafe || "Site visit completed.",
    });
    console.log(`[FieldNotes] Processing complete for ${sessionId}: ${entryList.length} entries`);
  }

  // Run once at startup to migrate any /uploads/ imageUrls to base64 in DB
  void migrateUploadsToBase64();
  // Run once at startup to migrate any disk-based company logos to base64 in DB
  void migrateLogoToBase64();

  // ── SUPPLIES MODULE ────────────────────────────────────────────────────────

  // GET /api/supplies — list all active for company, filterable by locationId/category/status
  app.get("/api/supplies", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { locationId, category, status } = req.query as Record<string, string>;
      let rows = await db.select({
        id: supplies.id, companyId: supplies.companyId, locationId: supplies.locationId,
        locationName: supplies.locationName, name: supplies.name, category: supplies.category,
        description: supplies.description, imageData: supplies.imageData, status: supplies.status,
        quantityLabel: supplies.quantityLabel, isActive: supplies.isActive,
        createdByUserId: supplies.createdByUserId, inventoryItemId: supplies.inventoryItemId,
        requestedQuantity: supplies.requestedQuantity, fulfilledQuantity: supplies.fulfilledQuantity,
        linkedExpenseId: supplies.linkedExpenseId, urgency: supplies.urgency,
        createdAt: supplies.createdAt, updatedAt: supplies.updatedAt,
        createdByUserName: sql<string | null>`concat(${users.firstName}, ' ', ${users.lastName})`,
        createdByUserRole: users.role,
      }).from(supplies)
        .leftJoin(users, eq(supplies.createdByUserId, users.id))
        .where(and(eq(supplies.companyId, user.companyId), eq(supplies.isActive, true)))
        .orderBy(desc(supplies.updatedAt));
      if (locationId) rows = rows.filter((s: any) => s.locationId === locationId);
      if (category) rows = rows.filter((s: any) => s.category === category);
      if (status) rows = rows.filter((s: any) => s.status === status);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/supplies — create new supply
  app.post("/api/supplies", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const now = new Date().toISOString();
      const { name, category, locationId, locationName, description, imageData, status, quantityLabel } = req.body;
      if (!name || !category) return res.status(400).json({ message: "name and category are required" });
      const [row] = await db.insert(supplies).values({
        companyId: user.companyId,
        locationId: locationId || null,
        locationName: locationName || null,
        name, category,
        description: description || null,
        imageData: imageData || null,
        status: status || "in_stock",
        quantityLabel: quantityLabel || null,
        isActive: true,
        createdByUserId: user.id,
        createdAt: now, updatedAt: now,
      }).returning();
      // Log creation activity
      await db.insert(supplyUpdates).values({
        supplyId: row.id, companyId: user.companyId,
        locationId: locationId || null,
        updatedByRole: "admin",
        updateType: "status_changed",
        note: `Supply created with status: ${status || "in_stock"}`,
        newStatus: status || "in_stock",
        createdAt: now,
      });
      res.status(201).json(row);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Inventory Management ─────────────────────────────────────────────────────

  // GET /api/supplies/inventory-overview — stats for admin overview tab
  app.get("/api/supplies/inventory-overview", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const cid = user.companyId;
      const items = await db.select().from(inventoryItems).where(eq(inventoryItems.companyId, cid));
      const purchases = await db.select().from(inventoryPurchases).where(eq(inventoryPurchases.companyId, cid));
      const expenses = await db.select().from(locationSupplyExpenses).where(eq(locationSupplyExpenses.companyId, cid));
      const requests = await db.select().from(supplies).where(and(eq(supplies.companyId, cid), eq(supplies.isActive, true)));
      const totalItems = items.length;
      const outOfStock = items.filter(i => i.status === "out_of_stock").length;
      const runningLow = items.filter(i => i.status === "running_low").length;
      const totalInventoryValue = items.reduce((acc, i) => acc + (parseFloat(i.unitPrice) || 0) * i.currentQuantity, 0);
      const totalSpent = expenses.reduce((acc, e) => acc + (parseFloat(e.totalExpense) || 0), 0);
      const pendingRequests = requests.filter(r => r.status === "in_stock" || r.status === "running_low" || r.status === "out_of_stock").length;
      const recentPurchases = [...purchases].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
      const recentExpenses = [...expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
      // Location expense summary
      const locationMap: Record<string, { locationId: string; locationName: string | null; total: number; count: number }> = {};
      for (const e of expenses) {
        if (!locationMap[e.locationId]) locationMap[e.locationId] = { locationId: e.locationId, locationName: e.locationName, total: 0, count: 0 };
        locationMap[e.locationId].total += parseFloat(e.totalExpense) || 0;
        locationMap[e.locationId].count += 1;
      }
      const locationExpenseSummary = Object.values(locationMap).sort((a, b) => b.total - a.total).slice(0, 5);
      res.json({ totalItems, outOfStock, runningLow, totalInventoryValue, totalSpent, pendingRequests, recentPurchases, recentExpenses, locationExpenseSummary, items });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/supplies/inventory — list inventory items
  app.get("/api/supplies/inventory", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const items = await db.select().from(inventoryItems)
        .where(eq(inventoryItems.companyId, user.companyId))
        .orderBy(desc(inventoryItems.updatedAt));
      res.json(items);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/supplies/inventory — create inventory item
  app.post("/api/supplies/inventory", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const now = new Date().toISOString();
      const { name, category, unitPrice, currentQuantity, lowStockThreshold, supplierName, notes, imageData } = req.body;
      if (!name || !category) return res.status(400).json({ message: "name and category required" });
      const qty = parseInt(currentQuantity) || 0;
      const price = unitPrice || "0";
      const threshold = parseInt(lowStockThreshold) || 2;
      let status = "in_stock";
      if (qty === 0) status = "out_of_stock";
      else if (qty <= threshold) status = "running_low";
      const [item] = await db.insert(inventoryItems).values({
        companyId: user.companyId, name, category,
        unitPrice: price, currentQuantity: qty, lowStockThreshold: threshold,
        status, supplierName: supplierName || null, notes: notes || null,
        imageData: imageData || null, createdByAdminId: user.id,
        createdAt: now, updatedAt: now,
      }).returning();
      // Record initial stock as purchase if qty > 0
      if (qty > 0) {
        const total = (parseFloat(price) * qty).toFixed(2);
        await db.insert(inventoryPurchases).values({
          companyId: user.companyId, inventoryItemId: item.id, inventoryItemName: name,
          quantityAdded: qty, unitPrice: price, totalCost: total,
          supplierName: supplierName || null, purchaseDate: now.split("T")[0],
          notes: "Initial stock on item creation",
          createdByAdminId: user.id, createdByAdminName: `${user.firstName} ${user.lastName}`,
          createdAt: now,
        });
        await db.insert(inventoryMovements).values({
          companyId: user.companyId, inventoryItemId: item.id, inventoryItemName: name,
          movementType: "purchase", quantity: qty,
          unitPriceAtTime: price, totalValue: total,
          notes: "Initial stock", createdByAdminId: user.id, createdAt: now,
        });
      }
      res.status(201).json(item);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/supplies/inventory/:id — update inventory item details
  app.patch("/api/supplies/inventory/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, req.params.id));
      if (!item || item.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      const { name, category, unitPrice, lowStockThreshold, supplierName, notes, imageData } = req.body;
      const threshold = lowStockThreshold !== undefined ? parseInt(lowStockThreshold) : item.lowStockThreshold;
      const currentQty = item.currentQuantity;
      let status = "in_stock";
      if (currentQty === 0) status = "out_of_stock";
      else if (currentQty <= threshold) status = "running_low";
      const [updated] = await db.update(inventoryItems).set({
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(unitPrice !== undefined && { unitPrice }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold: threshold }),
        ...(supplierName !== undefined && { supplierName }),
        ...(notes !== undefined && { notes }),
        ...(imageData !== undefined && { imageData }),
        status, updatedAt: now,
      }).where(eq(inventoryItems.id, req.params.id)).returning();
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/supplies/inventory/:id/restock — add more stock
  app.post("/api/supplies/inventory/:id/restock", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, req.params.id));
      if (!item || item.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      const { quantityAdded, unitPrice, supplierName, purchaseDate, notes } = req.body;
      const qty = parseInt(quantityAdded);
      if (!qty || qty <= 0) return res.status(400).json({ message: "quantityAdded must be positive" });
      const price = unitPrice || item.unitPrice;
      const total = (parseFloat(price) * qty).toFixed(2);
      const newQty = item.currentQuantity + qty;
      const threshold = item.lowStockThreshold;
      let status = "in_stock";
      if (newQty === 0) status = "out_of_stock";
      else if (newQty <= threshold) status = "running_low";
      await db.update(inventoryItems).set({ currentQuantity: newQty, unitPrice: price, status, updatedAt: now }).where(eq(inventoryItems.id, item.id));
      const [purchase] = await db.insert(inventoryPurchases).values({
        companyId: user.companyId, inventoryItemId: item.id, inventoryItemName: item.name,
        quantityAdded: qty, unitPrice: price, totalCost: total,
        supplierName: supplierName || item.supplierName || null,
        purchaseDate: purchaseDate || now.split("T")[0],
        notes: notes || null, createdByAdminId: user.id,
        createdByAdminName: `${user.firstName} ${user.lastName}`, createdAt: now,
      }).returning();
      await db.insert(inventoryMovements).values({
        companyId: user.companyId, inventoryItemId: item.id, inventoryItemName: item.name,
        movementType: "purchase", quantity: qty,
        unitPriceAtTime: price, totalValue: total,
        notes: notes || null, createdByAdminId: user.id, createdAt: now,
      });
      res.json({ purchase, newQuantity: newQty, status });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/supplies/inventory/:id/assign-location — assign inventory to a location
  app.post("/api/supplies/inventory/:id/assign-location", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, req.params.id));
      if (!item || item.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const { locationId, locationName, quantity, supplyRequestId, notes, assignedEmployeeId, assignedEmployeeName } = req.body;
      if (!locationId || !quantity) return res.status(400).json({ message: "locationId and quantity required" });
      const qty = parseInt(quantity);
      if (qty <= 0) return res.status(400).json({ message: "quantity must be positive" });
      if (item.currentQuantity < qty) return res.status(400).json({ message: `Only ${item.currentQuantity} unit${item.currentQuantity !== 1 ? "s" : ""} available` });
      const now = new Date().toISOString();
      const price = item.unitPrice;
      const total = (parseFloat(price) * qty).toFixed(2);
      const newQty = item.currentQuantity - qty;
      const threshold = item.lowStockThreshold;
      let invStatus = "in_stock";
      if (newQty === 0) invStatus = "out_of_stock";
      else if (newQty <= threshold) invStatus = "running_low";
      await db.update(inventoryItems).set({ currentQuantity: newQty, status: invStatus, updatedAt: now }).where(eq(inventoryItems.id, item.id));
      const [expense] = await db.insert(locationSupplyExpenses).values({
        companyId: user.companyId, locationId, locationName: locationName || null,
        inventoryItemId: item.id, inventoryItemName: item.name,
        category: item.category, supplyRequestId: supplyRequestId || null,
        quantity: qty, unitPriceAtTime: price, totalExpense: total,
        assignedDate: now.split("T")[0],
        assignedByAdminId: user.id, assignedByAdminName: `${user.firstName} ${user.lastName}`,
        assignedEmployeeId: assignedEmployeeId || null,
        assignedEmployeeName: assignedEmployeeName || null,
        notes: notes || null, createdAt: now,
      }).returning();
      await db.insert(inventoryMovements).values({
        companyId: user.companyId, inventoryItemId: item.id, inventoryItemName: item.name,
        movementType: "assigned_to_location", quantity: -qty,
        unitPriceAtTime: price, totalValue: total,
        locationId, locationName: locationName || null,
        supplyRequestId: supplyRequestId || null,
        notes: notes || null, createdByAdminId: user.id, createdAt: now,
      });
      // Upsert supply record so employee can see it
      const existingSupplies = await db.select().from(supplies).where(and(
        eq(supplies.inventoryItemId, item.id),
        eq(supplies.locationId, locationId),
        eq(supplies.companyId, user.companyId),
        eq(supplies.isActive, true)
      ));
      if (existingSupplies.length === 0) {
        await db.insert(supplies).values({
          companyId: user.companyId, locationId, locationName: locationName || null,
          name: item.name, category: item.category,
          imageData: item.imageData || null, status: "in_stock",
          quantityLabel: `${qty} unit${qty !== 1 ? "s" : ""} assigned`,
          isActive: true, createdByUserId: user.id,
          inventoryItemId: item.id, fulfilledQuantity: qty,
          createdAt: now, updatedAt: now,
        });
      } else {
        const existing = existingSupplies[0];
        const newTotal = (existing.fulfilledQuantity || 0) + qty;
        await db.update(supplies).set({
          status: "in_stock",
          quantityLabel: `${newTotal} unit${newTotal !== 1 ? "s" : ""} assigned`,
          fulfilledQuantity: newTotal, updatedAt: now,
        }).where(eq(supplies.id, existing.id));
      }
      // If linked to a supply request, update it
      if (supplyRequestId) {
        const [req2] = await db.select().from(supplies).where(eq(supplies.id, supplyRequestId));
        if (req2 && req2.companyId === user.companyId) {
          const newFulfilled = (req2.fulfilledQuantity || 0) + qty;
          const requested = req2.requestedQuantity || 0;
          const newStatus = requested > 0 && newFulfilled >= requested ? "fulfilled" : requested > 0 ? "partially_fulfilled" : "fulfilled";
          await db.update(supplies).set({
            fulfilledQuantity: newFulfilled, linkedExpenseId: expense.id,
            inventoryItemId: item.id, status: newStatus, updatedAt: now,
          }).where(eq(supplies.id, supplyRequestId));
          await db.insert(supplyUpdates).values({
            supplyId: supplyRequestId, companyId: user.companyId,
            locationId: locationId, updatedByRole: "admin",
            updateType: "status_changed",
            note: notes ? `Fulfilled ${qty} unit(s) of ${item.name}. Note: ${notes}` : `Fulfilled ${qty} unit(s) from inventory (${item.name})`,
            previousStatus: req2.status, newStatus: newStatus, createdAt: now,
          });
        }
      }
      res.json({ expense, newQuantity: newQty, invStatus });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/supplies/company-employees — list active employees for selector
  app.get("/api/supplies/company-employees", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const employees = await db.select({
        id: users.id, firstName: users.firstName, lastName: users.lastName,
      }).from(users).where(and(eq(users.companyId, user.companyId), eq(users.role, "employee"), eq(users.isActive, true)));
      res.json(employees);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/supplies/location-expenses — list all expenses grouped by location
  app.get("/api/supplies/location-expenses", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const expenses = await db.select().from(locationSupplyExpenses)
        .where(eq(locationSupplyExpenses.companyId, user.companyId))
        .orderBy(desc(locationSupplyExpenses.createdAt));
      const locationMap: Record<string, { locationId: string; locationName: string | null; totalExpense: number; itemCount: number; lastActivity: string; entries: any[] }> = {};
      for (const e of expenses) {
        if (!locationMap[e.locationId]) locationMap[e.locationId] = { locationId: e.locationId, locationName: e.locationName, totalExpense: 0, itemCount: 0, lastActivity: e.createdAt, entries: [] };
        locationMap[e.locationId].totalExpense += parseFloat(e.totalExpense) || 0;
        locationMap[e.locationId].itemCount += 1;
        if (e.createdAt > locationMap[e.locationId].lastActivity) locationMap[e.locationId].lastActivity = e.createdAt;
        locationMap[e.locationId].entries.push(e);
      }
      res.json(Object.values(locationMap).sort((a, b) => b.totalExpense - a.totalExpense));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/supplies/location-expenses/:locationId — detail for one location
  app.get("/api/supplies/location-expenses/:locationId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const expenses = await db.select().from(locationSupplyExpenses)
        .where(and(
          eq(locationSupplyExpenses.companyId, user.companyId),
          eq(locationSupplyExpenses.locationId, req.params.locationId)
        ))
        .orderBy(desc(locationSupplyExpenses.createdAt));
      const total = expenses.reduce((acc, e) => acc + (parseFloat(e.totalExpense) || 0), 0);
      res.json({ locationId: req.params.locationId, total, expenses });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/supplies/purchase-history — all inventory purchases
  app.get("/api/supplies/purchase-history", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const purchases = await db.select().from(inventoryPurchases)
        .where(eq(inventoryPurchases.companyId, user.companyId))
        .orderBy(desc(inventoryPurchases.createdAt));
      res.json(purchases);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/supplies/requests/:id/status — update supply request status (admin)
  app.patch("/api/supplies/requests/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const [existing] = await db.select().from(supplies).where(eq(supplies.id, req.params.id));
      if (!existing || existing.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      const { status, note, urgency, requestedQuantity } = req.body;
      const [updated] = await db.update(supplies).set({
        ...(status !== undefined && { status }),
        ...(urgency !== undefined && { urgency }),
        ...(requestedQuantity !== undefined && { requestedQuantity: parseInt(requestedQuantity) }),
        updatedAt: now,
      }).where(eq(supplies.id, req.params.id)).returning();
      if (status && status !== existing.status) {
        await db.insert(supplyUpdates).values({
          supplyId: existing.id, companyId: user.companyId,
          locationId: existing.locationId, updatedByRole: "admin",
          updateType: "status_changed", note: note || null,
          previousStatus: existing.status, newStatus: status, createdAt: now,
        });
      }
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/supplies/grammarize-note — AI grammar cleanup for cleaner voice notes
  app.post("/api/supplies/grammarize-note", requireAuth, async (req, res) => {
    try {
      const { rawText } = req.body;
      if (!rawText || typeof rawText !== "string") return res.status(400).json({ message: "rawText required" });
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return res.json({ cleanText: rawText });
      const oai = new OpenAI({ apiKey });
      const result = await oai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 200,
        messages: [{
          role: "system",
          content: "You are a grammar assistant for cleaning supply reports written by cleaning staff. Fix grammar, spelling and punctuation. Keep it concise and professional. Return ONLY the corrected text with no explanation."
        }, {
          role: "user",
          content: rawText,
        }],
      });
      const cleanText = result.choices[0]?.message?.content?.trim() || rawText;
      res.json({ cleanText });
    } catch (e: any) { res.json({ cleanText: req.body.rawText }); }
  });

  // GET /api/supplies/employee-reports — admin: see all cleaner-submitted supply updates
  app.get("/api/supplies/employee-reports", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const reports = await db.select({
        id: supplyUpdates.id,
        supplyId: supplyUpdates.supplyId,
        companyId: supplyUpdates.companyId,
        locationId: supplyUpdates.locationId,
        employeeId: supplyUpdates.employeeId,
        employeeName: supplyUpdates.employeeName,
        updatedByRole: supplyUpdates.updatedByRole,
        updateType: supplyUpdates.updateType,
        note: supplyUpdates.note,
        photoData: supplyUpdates.photoData,
        photos: supplyUpdates.photos,
        previousStatus: supplyUpdates.previousStatus,
        newStatus: supplyUpdates.newStatus,
        adminResponse: supplyUpdates.adminResponse,
        adminRespondedAt: supplyUpdates.adminRespondedAt,
        adminRespondedBy: supplyUpdates.adminRespondedBy,
        seenByEmployee: supplyUpdates.seenByEmployee,
        createdAt: supplyUpdates.createdAt,
        supplyName: supplies.name,
        supplyCategory: supplies.category,
        supplyLocationName: supplies.locationName,
        supplyImageData: supplies.imageData,
      }).from(supplyUpdates)
        .leftJoin(supplies, eq(supplyUpdates.supplyId, supplies.id))
        .where(and(
          eq(supplyUpdates.companyId, user.companyId),
          eq(supplyUpdates.updatedByRole, "employee")
        ))
        .orderBy(desc(supplyUpdates.createdAt))
        .limit(100);
      res.json(reports);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/supplies/:id/updates/:updateId/respond — admin responds to a cleaner report
  app.post("/api/supplies/:id/updates/:updateId/respond", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const [supply] = await db.select().from(supplies).where(eq(supplies.id, req.params.id));
      if (!supply || supply.companyId !== user.companyId) return res.status(404).json({ message: "Supply not found" });
      const [upd] = await db.select().from(supplyUpdates).where(eq(supplyUpdates.id, req.params.updateId));
      if (!upd || upd.supplyId !== supply.id) return res.status(404).json({ message: "Report not found" });
      const { response, newStatus } = req.body;
      if (!response) return res.status(400).json({ message: "response is required" });
      const now = new Date().toISOString();
      const [updated] = await db.update(supplyUpdates).set({
        adminResponse: response,
        adminRespondedAt: now,
        adminRespondedBy: `${user.firstName} ${user.lastName}`,
        seenByEmployee: 0,
      }).where(eq(supplyUpdates.id, upd.id)).returning();
      if (newStatus) {
        await db.update(supplies).set({ status: newStatus, updatedAt: now }).where(eq(supplies.id, supply.id));
        await db.insert(supplyUpdates).values({
          supplyId: supply.id, companyId: user.companyId,
          locationId: supply.locationId,
          updatedByRole: "admin", updateType: "status_changed",
          note: `Admin responded: ${response}`,
          previousStatus: supply.status, newStatus, createdAt: now,
        });
      }
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/supplies/:id/updates/:updateId/mark-seen — employee marks admin response as seen
  app.post("/api/supplies/:id/updates/:updateId/mark-seen", requireAuth, requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const [supply] = await db.select().from(supplies).where(and(eq(supplies.id, req.params.id), eq(supplies.companyId, user.companyId)));
      if (!supply) return res.status(404).json({ message: "Not found" });
      await db.update(supplyUpdates).set({ seenByEmployee: 1 })
        .where(and(eq(supplyUpdates.id, req.params.updateId), eq(supplyUpdates.supplyId, supply.id)));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/supplies/:id — supply detail with updates
  app.get("/api/supplies/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const [supply] = await db.select().from(supplies).where(eq(supplies.id, req.params.id));
      if (!supply || supply.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updates = await db.select().from(supplyUpdates)
        .where(eq(supplyUpdates.supplyId, supply.id))
        .orderBy(desc(supplyUpdates.createdAt));
      res.json({ ...supply, updates });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/supplies/:id — update supply (admin)
  app.patch("/api/supplies/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const [existing] = await db.select().from(supplies).where(eq(supplies.id, req.params.id));
      if (!existing || existing.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      const { name, category, locationId, locationName, description, imageData, status, quantityLabel, isActive, note, updateType } = req.body;
      const updated = await db.update(supplies).set({
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(locationId !== undefined && { locationId }),
        ...(locationName !== undefined && { locationName }),
        ...(description !== undefined && { description }),
        ...(imageData !== undefined && { imageData }),
        ...(status !== undefined && { status }),
        ...(quantityLabel !== undefined && { quantityLabel }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: now,
      }).where(eq(supplies.id, req.params.id)).returning();
      // Log activity
      if (status !== undefined && status !== existing.status) {
        await db.insert(supplyUpdates).values({
          supplyId: existing.id, companyId: user.companyId,
          locationId: existing.locationId,
          updatedByRole: "admin",
          updateType: updateType || "status_changed",
          note: note || null,
          previousStatus: existing.status,
          newStatus: status,
          createdAt: now,
        });
      } else if (note) {
        await db.insert(supplyUpdates).values({
          supplyId: existing.id, companyId: user.companyId,
          locationId: existing.locationId,
          updatedByRole: "admin",
          updateType: updateType || "note_added",
          note,
          createdAt: now,
        });
      }
      res.json(updated[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/supplies/:id/updates — add activity (admin or employee)
  app.post("/api/supplies/:id/updates", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const [supply] = await db.select().from(supplies).where(eq(supplies.id, req.params.id));
      if (!supply || supply.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      const { updateType, note, photoData, newStatus, photos } = req.body;
      if (!updateType) return res.status(400).json({ message: "updateType is required" });
      // If newStatus provided, update the supply status
      if (newStatus && newStatus !== supply.status) {
        await db.update(supplies).set({ status: newStatus, updatedAt: now }).where(eq(supplies.id, supply.id));
      }
      const photosJson = photos && Array.isArray(photos) && photos.length > 0 ? JSON.stringify(photos) : null;
      const isEmployee = user.role === "employee";
      const [row] = await db.insert(supplyUpdates).values({
        supplyId: supply.id, companyId: user.companyId,
        locationId: supply.locationId,
        employeeId: isEmployee ? user.id : null,
        employeeName: isEmployee ? `${user.firstName} ${user.lastName}` : null,
        updatedByRole: user.role === "admin" ? "admin" : "employee",
        updatedByUserId: user.id,
        updatedByName: `${user.firstName} ${user.lastName}`,
        updateType,
        note: note || null,
        photoData: photoData || null,
        photos: photosJson,
        previousStatus: supply.status,
        newStatus: newStatus || null,
        seenByEmployee: 0,
        createdAt: now,
      }).returning();
      res.status(201).json(row);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/employee/supplies — employee view, location-aware
  app.get("/api/employee/supplies", requireAuth, requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      // Get locationIds from shifts, recurring_schedules, time_entries for this employee
      const locRows = await pool.query(
        `SELECT DISTINCT location_id FROM (
          SELECT location_id FROM shifts WHERE employee_id = $1 AND location_id IS NOT NULL
          UNION
          SELECT location_id FROM recurring_schedules WHERE employee_id = $1 AND location_id IS NOT NULL
          UNION
          SELECT location_id FROM time_entries WHERE employee_id = $1 AND location_id IS NOT NULL
        ) t`,
        [user.id]
      );
      const locationIds = locRows.rows.map((r: any) => r.location_id).filter(Boolean);
      let rows: any[];
      if (locationIds.length === 0) {
        // No location assignments — show all active supplies for company
        rows = await db.select().from(supplies)
          .where(and(eq(supplies.companyId, user.companyId), eq(supplies.isActive, true)))
          .orderBy(desc(supplies.updatedAt));
      } else {
        rows = await db.select().from(supplies)
          .where(and(eq(supplies.companyId, user.companyId), eq(supplies.isActive, true)))
          .orderBy(desc(supplies.updatedAt));
        rows = rows.filter(s => !s.locationId || locationIds.includes(s.locationId));
      }
      // Get per-supply admin update flags (unseen admin responses)
      const supplyIds = rows.map(s => s.id);
      let adminUpdateMap: Record<string, { hasAdminUpdate: boolean; latestAdminUpdate: any }> = {};
      if (supplyIds.length > 0) {
        const adminUpdates = await db.select().from(supplyUpdates)
          .where(and(
            eq(supplyUpdates.companyId, user.companyId),
            sql`${supplyUpdates.supplyId} = ANY(${sql.raw("ARRAY['" + supplyIds.join("','") + "']::varchar[]")})`
          ))
          .orderBy(desc(supplyUpdates.createdAt));
        for (const upd of adminUpdates) {
          if (!adminUpdateMap[upd.supplyId]) {
            const hasUnseenAdminResponse = !!upd.adminResponse && (upd.seenByEmployee === 0 || upd.seenByEmployee === null);
            adminUpdateMap[upd.supplyId] = {
              hasAdminUpdate: hasUnseenAdminResponse,
              latestAdminUpdate: upd.adminResponse ? upd : null,
            };
          } else if (!adminUpdateMap[upd.supplyId].hasAdminUpdate && upd.adminResponse && (upd.seenByEmployee === 0 || upd.seenByEmployee === null)) {
            adminUpdateMap[upd.supplyId].hasAdminUpdate = true;
            adminUpdateMap[upd.supplyId].latestAdminUpdate = upd;
          }
        }
      }
      const enrichedRows = rows.map(s => ({
        ...s,
        hasAdminUpdate: adminUpdateMap[s.id]?.hasAdminUpdate || false,
        latestAdminUpdate: adminUpdateMap[s.id]?.latestAdminUpdate || null,
      }));
      // Group by locationId
      const byLocation: Record<string, { locationId: string | null; locationName: string | null; items: any[] }> = {};
      for (const s of enrichedRows) {
        const key = s.locationId || "__none__";
        if (!byLocation[key]) byLocation[key] = { locationId: s.locationId, locationName: s.locationName, items: [] };
        byLocation[key].items.push(s);
      }
      res.json({ locationIds, locations: Object.values(byLocation), allSupplies: enrichedRows });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/employee/supplies/:id — single supply with updates for cleaner detail view
  app.get("/api/employee/supplies/:id", requireAuth, requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const [supply] = await db.select().from(supplies).where(and(eq(supplies.id, req.params.id), eq(supplies.companyId, user.companyId)));
      if (!supply) return res.status(404).json({ message: "Not found" });
      const updates = await db.select().from(supplyUpdates).where(eq(supplyUpdates.supplyId, supply.id)).orderBy(desc(supplyUpdates.createdAt));
      res.json({ ...supply, updates });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/employee/supply-requests — cleaner requests a new supply
  app.post("/api/employee/supply-requests", requireAuth, requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const { name, category, note, urgency, locationId, locationName, imageData } = req.body;
      if (!name) return res.status(400).json({ message: "Supply name is required" });
      const now = new Date().toISOString();
      const [supply] = await db.insert(supplies).values({
        companyId: user.companyId, locationId: locationId || null, locationName: locationName || null,
        name, category: category || "Other", status: "out_of_stock",
        quantityLabel: "Requested", isActive: true,
        createdByUserId: user.id, imageData: imageData || null,
        urgency: urgency || "normal", requestedQuantity: 1,
        createdAt: now, updatedAt: now,
      }).returning();
      await db.insert(supplyUpdates).values({
        supplyId: supply.id, companyId: user.companyId,
        locationId: locationId || null, updatedByRole: "employee",
        updatedByUserId: user.id,
        updatedByName: `${user.firstName} ${user.lastName}`,
        updateType: "reported_out",
        note: note || "New supply requested",
        newStatus: "out_of_stock", createdAt: now,
      });
      res.json(supply);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/employee/priority-alerts — open priority clean alerts assigned to this employee
  app.get("/api/employee/priority-alerts", requireAuth, requireRole("employee"), async (req, res) => {
    try {
      const user = req.user as any;
      const alerts = await storage.getOpenPriorityCleanAlertsByEmployee(user.id, user.companyId);
      const result = await Promise.all(alerts.map(async (a) => {
        const photos = await storage.getPriorityCleanPhotosByAlertId(a.id);
        const loc = a.locationId ? await storage.getLocation(a.locationId) : null;
        return {
          ...a,
          locationName: loc?.name || a.locationId || null,
          photos: photos.map(p => ({ id: p.id })),
        };
      }));
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Publications (Admin) ──────────────────────────────────────────────────

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim()
      .slice(0, 80);
  }

  app.get("/api/publications", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pubs = await storage.getPublicationsByCompany(user.companyId);
      res.json(pubs);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/publications", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { title, subtitle, slug: rawSlug, category, introText, seoTitle, seoDescription, coverImageData, helpfulVotingEnabled, contactCtaEnabled, publicationFormat, brandingSource, customBrandName, customBrandLogoUrl } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });

      let slug = rawSlug ? slugify(rawSlug) : slugify(title);
      if (!slug) slug = "publication-" + Date.now();

      let finalSlug = slug;
      let suffix = 0;
      while (await storage.isSlugTaken(finalSlug)) {
        suffix++;
        finalSlug = `${slug}-${suffix}`;
      }

      const now = new Date().toISOString();
      const pub = await storage.createPublication({
        companyId: user.companyId,
        title,
        subtitle: subtitle || null,
        slug: finalSlug,
        status: "draft",
        coverImageData: coverImageData || null,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        introText: introText || null,
        category: category || null,
        helpfulVotingEnabled: helpfulVotingEnabled !== false,
        contactCtaEnabled: contactCtaEnabled !== false,
        publicationFormat: publicationFormat || "standard",
        brandingSource: brandingSource === "custom" ? "custom" : "company",
        customBrandName: brandingSource === "custom" ? (customBrandName || null) : null,
        customBrandLogoUrl: brandingSource === "custom" ? (customBrandLogoUrl || null) : null,
        createdBy: user.id,
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      res.status(201).json(pub);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/publications/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pub = await storage.getPublication(req.params.id);
      if (!pub || pub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const [sections, allMedia, pricing] = await Promise.all([
        storage.getPublicationSections(pub.id),
        storage.getPublicationMedia(pub.id),
        storage.getPublicationPricing(pub.id),
      ]);
      const sectionsWithMedia = sections.map(s => ({
        ...s,
        media: allMedia.filter(m => m.sectionId === s.id).sort((a, b) => a.sortOrder - b.sortOrder),
      }));
      res.json({ ...pub, sections: sectionsWithMedia, pricing });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/publications/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pub = await storage.getPublication(req.params.id);
      if (!pub || pub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });

      const b = req.body;
      const now = new Date().toISOString();

      let resolvedSlug = b.slug ? slugify(b.slug) : undefined;
      if (resolvedSlug && await storage.isSlugTaken(resolvedSlug, pub.id)) {
        return res.status(400).json({ message: "This URL slug is already taken. Please choose a different one." });
      }

      const updates: Record<string, any> = {
        updatedAt: now,
        ...(b.title !== undefined && { title: b.title }),
        ...(b.subtitle !== undefined && { subtitle: b.subtitle }),
        ...(resolvedSlug !== undefined && { slug: resolvedSlug }),
        ...(b.introText !== undefined && { introText: b.introText }),
        ...(b.category !== undefined && { category: b.category }),
        ...(b.seoTitle !== undefined && { seoTitle: b.seoTitle }),
        ...(b.seoDescription !== undefined && { seoDescription: b.seoDescription }),
        ...(b.coverImageData !== undefined && { coverImageData: b.coverImageData }),
        ...(b.helpfulVotingEnabled !== undefined && { helpfulVotingEnabled: b.helpfulVotingEnabled }),
        ...(b.status !== undefined && { status: b.status }),
        ...(b.contactCtaEnabled !== undefined && { contactCtaEnabled: b.contactCtaEnabled }),
        ...(b.contactUseDefault !== undefined && { contactUseDefault: b.contactUseDefault }),
        ...(b.contactCompanyName !== undefined && { contactCompanyName: b.contactCompanyName }),
        ...(b.contactPhone !== undefined && { contactPhone: b.contactPhone }),
        ...(b.contactEmail !== undefined && { contactEmail: b.contactEmail }),
        ...(b.contactAddress !== undefined && { contactAddress: b.contactAddress }),
        ...(b.contactWebsite !== undefined && { contactWebsite: b.contactWebsite }),
        ...(b.contactCtaText !== undefined && { contactCtaText: b.contactCtaText }),
        ...(b.contactCtaLink !== undefined && { contactCtaLink: b.contactCtaLink }),
        ...(b.publicationFormat !== undefined && { publicationFormat: b.publicationFormat }),
        ...(b.brandingSource !== undefined && { brandingSource: b.brandingSource === "custom" ? "custom" : "company" }),
        ...(b.customBrandName !== undefined && { customBrandName: b.brandingSource === "custom" ? (b.customBrandName || null) : null }),
        ...(b.customBrandLogoUrl !== undefined && { customBrandLogoUrl: b.brandingSource === "custom" ? (b.customBrandLogoUrl || null) : null }),
      };

      if (b.status === "published" && !pub.publishedAt) {
        updates.publishedAt = now;
      }

      const updated = await storage.updatePublication(pub.id, updates);
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/publications/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pub = await storage.getPublication(req.params.id);
      if (!pub || pub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.deletePublication(pub.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Publication Sections ──────────────────────────────────────────────────
  app.post("/api/publications/:id/sections", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pub = await storage.getPublication(req.params.id);
      if (!pub || pub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      const existing = await storage.getPublicationSections(pub.id);
      const section = await storage.createPublicationSection({
        publicationId: pub.id,
        sectionType: req.body.sectionType || "text",
        title: req.body.title || null,
        body: req.body.body || null,
        sortOrder: existing.length,
        createdAt: now,
        updatedAt: now,
      });
      res.status(201).json({ ...section, media: [] });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/publications/:id/sections/:sectionId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pub = await storage.getPublication(req.params.id);
      if (!pub || pub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const b = req.body;
      const updates: Record<string, any> = {
        updatedAt: new Date().toISOString(),
        ...(b.title !== undefined && { title: b.title }),
        ...(b.body !== undefined && { body: b.body }),
        ...(b.sectionType !== undefined && { sectionType: b.sectionType }),
        ...(b.pricingItems !== undefined && { pricingItems: b.pricingItems }),
      };
      const section = await storage.updatePublicationSection(req.params.sectionId, updates);
      if (!section) return res.status(404).json({ message: "Section not found" });
      const media = await storage.getPublicationMediaBySection(section.id);
      res.json({ ...section, media });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/publications/:id/sections/:sectionId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pub = await storage.getPublication(req.params.id);
      if (!pub || pub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.deletePublicationSection(req.params.sectionId);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/publications/:id/sections/reorder", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pub = await storage.getPublication(req.params.id);
      if (!pub || pub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const { order } = req.body as { order: string[] };
      const now = new Date().toISOString();
      await Promise.all(order.map((sectionId, idx) =>
        storage.updatePublicationSection(sectionId, { sortOrder: idx, updatedAt: now })
      ));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Publication Media ──────────────────────────────────────────────────────
  app.post("/api/publications/:id/sections/:sectionId/media", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pub = await storage.getPublication(req.params.id);
      if (!pub || pub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const { imageData, caption } = req.body;
      if (!imageData) return res.status(400).json({ message: "imageData required" });
      const existing = await storage.getPublicationMediaBySection(req.params.sectionId);
      const now = new Date().toISOString();
      const media = await storage.createPublicationMedia({
        publicationId: pub.id,
        sectionId: req.params.sectionId,
        imageData,
        caption: caption || null,
        sortOrder: existing.length,
        createdAt: now,
      });
      res.status(201).json(media);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/publications/:id/media/:mediaId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pub = await storage.getPublication(req.params.id);
      if (!pub || pub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updatePublicationMedia(req.params.mediaId, req.body);
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/publications/:id/media/:mediaId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pub = await storage.getPublication(req.params.id);
      if (!pub || pub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.deletePublicationMedia(req.params.mediaId);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Publication Pricing ───────────────────────────────────────────────────
  app.post("/api/publications/:id/pricing", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pub = await storage.getPublication(req.params.id);
      if (!pub || pub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const existing = await storage.getPublicationPricing(pub.id);
      const now = new Date().toISOString();
      const item = await storage.createPublicationPricing({
        publicationId: pub.id,
        itemName: req.body.itemName || "Service Item",
        description: req.body.description || null,
        price: req.body.price || null,
        unit: req.body.unit || null,
        notes: req.body.notes || null,
        sortOrder: existing.length,
        createdAt: now,
      });
      res.status(201).json(item);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/publications/:id/pricing/:itemId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pub = await storage.getPublication(req.params.id);
      if (!pub || pub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updatePublicationPricing(req.params.itemId, req.body);
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/publications/:id/pricing/:itemId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const pub = await storage.getPublication(req.params.id);
      if (!pub || pub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.deletePublicationPricing(req.params.itemId);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Publication AI Assist ─────────────────────────────────────────────────
  app.post("/api/publications/ai-assist", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { text, action, context } = req.body;
      if (!text) return res.status(400).json({ message: "text required" });

      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // ── Format-specific structure generators (return JSON with sections array) ──
      const generateActions: Record<string, string> = {
        generate_blog: `You are a professional business content writer. Generate a blog-style publication structure for the given topic. Return a JSON object with a "sections" array. Each section must have "title" (string) and "body" (string). Generate 4-5 sections: an engaging intro, 2-3 main content sections, and a conclusion. Keep each body concise (3-5 sentences), professional, and relevant to the topic.`,
        generate_walkthrough: `You are a professional business writer specializing in step-by-step client walkthroughs. Generate a walkthrough for the given topic. Return a JSON object with a "sections" array. Each section must have "title" (string, formatted as "Step N: [action verb phrase]") and "body" (string, a short 1-3 sentence clear instruction). Generate 4-6 steps that are logical and easy to follow.`,
        generate_tutorial: `You are a professional business educator. Generate a detailed tutorial for the given topic. Return a JSON object with a "sections" array. Each section must have "title" (string) and "body" (string). Include these sections in order: Overview, Tools & Materials Needed, then 3-4 numbered step-by-step instruction sections, Tips & Best Practices, Common Mistakes to Avoid, and Final Result. Keep each body concise and practical.`,
      };

      if (generateActions[action]) {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: generateActions[action] },
            { role: "user", content: text },
          ],
          max_tokens: 900,
          response_format: { type: "json_object" },
        });
        const raw = completion.choices[0]?.message?.content?.trim() || "{}";
        try {
          const parsed = JSON.parse(raw);
          return res.json({ sections: parsed.sections || [] });
        } catch {
          return res.json({ sections: [] });
        }
      }

      // ── Existing text-improvement actions ──────────────────────────────────
      const systemPrompts: Record<string, string> = {
        improve: "You are a professional business writer. Improve the following text to be clear, professional, and engaging. Return only the improved text, no preamble.",
        professional: "You are an expert copywriter. Rewrite the following text in a professional, polished business tone. Return only the rewritten text.",
        summarize: "Summarize the following text concisely in 2-3 sentences. Return only the summary.",
        seo_description: "Write a compelling SEO meta description (max 155 characters) for a business publication about the following topic. Return only the description.",
        caption: "Write a short, professional image caption (1-2 sentences) for an image in a business publication. Context: " + (context || "general business photo") + ". Based on: ",
        intro: "Write a professional, engaging intro paragraph for a business publication about the following topic. Return only the paragraph.",
      };

      const systemPrompt = systemPrompts[action] || systemPrompts.improve;
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_tokens: 400,
      });

      const result = completion.choices[0]?.message?.content?.trim() || "";
      res.json({ result });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Publications (Public) ──────────────────────────────────────────────────
  app.get("/api/public/publications/:slug", async (req, res) => {
    try {
      const pub = await storage.getPublicationBySlug(req.params.slug);
      if (!pub || pub.status !== "published") return res.status(404).json({ message: "Publication not found" });

      const company = await storage.getCompany(pub.companyId);
      const [sections, allMedia, pricing, votes] = await Promise.all([
        storage.getPublicationSections(pub.id),
        storage.getPublicationMedia(pub.id),
        storage.getPublicationPricing(pub.id),
        storage.getPublicationVoteCounts(pub.id),
      ]);

      const sectionsWithMedia = sections.map(s => ({
        ...s,
        media: allMedia.filter(m => m.sectionId === s.id).sort((a, b) => a.sortOrder - b.sortOrder),
      }));

      const contactInfo = pub.contactCtaEnabled
        ? (pub.contactUseDefault !== false)
          ? {
              name: company?.name || null,
              logoUrl: company?.companyLogoUrl || null,
              phone: company?.companyPhone || null,
              email: company?.companyEmail || null,
              address: company?.address || null,
              website: null,
              ctaText: null,
              ctaLink: null,
            }
          : {
              name: pub.contactCompanyName || company?.name || null,
              logoUrl: company?.companyLogoUrl || null,
              phone: pub.contactPhone || null,
              email: pub.contactEmail || null,
              address: pub.contactAddress || null,
              website: pub.contactWebsite || null,
              ctaText: pub.contactCtaText || null,
              ctaLink: pub.contactCtaLink || null,
            }
        : null;

      // Resolve branding — custom overrides company if set
      const branding = pub.brandingSource === "custom"
        ? {
            name: pub.customBrandName || company?.name || null,
            logoUrl: pub.customBrandLogoUrl || company?.companyLogoUrl || null,
          }
        : {
            name: company?.name || null,
            logoUrl: company?.companyLogoUrl || null,
          };

      res.json({
        ...pub,
        sections: sectionsWithMedia,
        pricing,
        votes,
        company: company ? {
          name: company.name,
          logoUrl: company.companyLogoUrl,
          phone: company.companyPhone,
          email: company.companyEmail,
          address: company.address,
        } : null,
        branding,
        contactInfo,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/publications/:slug/vote", async (req, res) => {
    try {
      const pub = await storage.getPublicationBySlug(req.params.slug);
      if (!pub || pub.status !== "published" || !pub.helpfulVotingEnabled) {
        return res.status(404).json({ message: "Not found" });
      }
      const { vote, sessionId } = req.body;
      if (!["yes", "no"].includes(vote)) return res.status(400).json({ message: "vote must be yes or no" });
      await storage.createPublicationVote({
        publicationId: pub.id,
        vote,
        sessionId: sessionId || null,
        createdAt: new Date().toISOString(),
      });
      const counts = await storage.getPublicationVoteCounts(pub.id);
      res.json(counts);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Quote Forms (Admin) ──────────────────────────────────────────────────

  // Migrate old smart cleaning form configs to the new frequency field structure.
  // Detects forms that have a service step with the old "frequency" field (no "frequencyType")
  // and replaces the service step with the new SMART_CLEANING_CONFIG service step.
  async function maybeUpgradeSmartConfig(form: { id: string; config: string }): Promise<string> {
    try {
      const { SMART_CLEANING_CONFIG } = await import("@shared/schema");
      const parsed = JSON.parse(form.config);
      if (parsed?.smartMode !== "cleaning") return form.config;
      const serviceStep = parsed.steps?.find((s: any) => s.id === "service");
      const hasOldFreq = serviceStep?.fields?.some((f: any) => f.id === "frequency");
      const hasNewFreq = serviceStep?.fields?.some((f: any) => f.id === "frequencyType");
      if (!hasOldFreq && hasNewFreq) return form.config; // already up-to-date
      // Replace service step with the new one from SMART_CLEANING_CONFIG
      const newServiceStep = SMART_CLEANING_CONFIG.steps.find(s => s.id === "service");
      const newSteps = parsed.steps.map((s: any) => s.id === "service" ? newServiceStep : s);
      const upgraded = { ...parsed, steps: newSteps };
      const upgradedStr = JSON.stringify(upgraded);
      // Persist the upgrade to DB so it doesn't happen on every request
      await storage.updateQuoteForm(form.id, { config: upgradedStr });
      return upgradedStr;
    } catch { return form.config; }
  }

  app.get("/api/admin/quote-forms", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const forms = await storage.getQuoteFormsByCompany(user.companyId);
      const upgraded = await Promise.all(forms.map(async f => ({
        ...f, config: JSON.parse(await maybeUpgradeSmartConfig(f)),
      })));
      res.json(upgraded);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/quote-forms", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { name, config } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "form";
      const { DEFAULT_FORM_CONFIG, SMART_CLEANING_CONFIG } = await import("@shared/schema");
      // When smartMode === "cleaning", seed the full pre-built config (not empty steps)
      const finalConfig = config?.smartMode === "cleaning" ? SMART_CLEANING_CONFIG : (config ?? DEFAULT_FORM_CONFIG);
      const form = await storage.createQuoteForm({
        companyId: user.companyId,
        name,
        slug,
        isActive: true,
        config: JSON.stringify(finalConfig),
        createdAt: new Date().toISOString(),
      });
      res.json({ ...form, config: JSON.parse(form.config) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/quote-forms/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const form = await storage.getQuoteForm(req.params.id);
      if (!form || form.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const upgradedConfig = await maybeUpgradeSmartConfig(form);
      res.json({ ...form, config: JSON.parse(upgradedConfig) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/quote-forms/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const form = await storage.getQuoteForm(req.params.id);
      if (!form || form.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updates: any = {};
      if (req.body.name !== undefined) {
        updates.name = req.body.name;
        updates.slug = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "form";
      }
      if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
      if (req.body.config !== undefined) updates.config = JSON.stringify(req.body.config);
      const updated = await storage.updateQuoteForm(req.params.id, updates);
      res.json({ ...updated, config: JSON.parse(updated!.config) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/admin/quote-forms/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const form = await storage.getQuoteForm(req.params.id);
      if (!form || form.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.deleteQuoteForm(req.params.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/quote-forms/:id/submissions", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const form = await storage.getQuoteForm(req.params.id);
      if (!form || form.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const subs = await storage.getQuoteFormSubmissions(req.params.id);
      res.json(subs.map(s => ({ ...s, data: JSON.parse(s.data) })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/quote-forms/:formId/submissions/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const form = await storage.getQuoteForm(req.params.formId);
      if (!form || form.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateQuoteFormSubmission(req.params.id, { status: req.body.status });
      res.json({ ...updated, data: JSON.parse(updated!.data) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // All submissions across forms (for Submissions tab)
  app.get("/api/admin/submissions", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const [subs, forms, walkthroughSubIds] = await Promise.all([
        storage.getAllSubmissionsByCompany(user.companyId),
        storage.getQuoteFormsByCompany(user.companyId),
        storage.getWalkthroughSubmissionIdsByCompany(user.companyId),
      ]);
      const formMap: Record<string, string> = {};
      forms.forEach(f => { formMap[f.id] = f.name; });
      const walkthroughSet = new Set(walkthroughSubIds);
      res.json(subs.map(s => ({ ...s, data: JSON.parse(s.data), formName: formMap[s.formId] || "Unknown Form", hasWalkthrough: walkthroughSet.has(s.id) })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Single submission detail
  app.get("/api/admin/submissions/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getQuoteFormSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const [estimate, quote, activity, walkthrough] = await Promise.all([
        storage.getAiEstimateBySubmission(sub.id),
        storage.getFormQuoteBySubmission(sub.id),
        storage.getLeadActivity(sub.id),
        storage.getQuoteRequestWalkthroughBySubmission(sub.id),
      ]);
      const forms = await storage.getQuoteFormsByCompany(user.companyId);
      const form = forms.find(f => f.id === sub.formId);
      let walkthroughDetail: any = null;
      if (walkthrough) {
        const [photos, sections] = await Promise.all([
          storage.getQuoteRequestWalkthroughPhotos(walkthrough.id),
          storage.getQuoteRequestWalkthroughSections(walkthrough.id),
        ]);
        walkthroughDetail = { ...walkthrough, photos, sections };
      }
      res.json({ ...sub, data: JSON.parse(sub.data), formName: form?.name || "Unknown Form", estimate, quote, activity, walkthrough: walkthroughDetail });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Update submission (notes, stage, etc.)
  app.patch("/api/admin/submissions/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getQuoteFormSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const allowed = ["pipelineStage", "adminNotes", "status", "assignedTo", "archivedAt"] as const;
      const updates: any = {};
      allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
      if (req.body.pipelineStage && req.body.pipelineStage !== sub.pipelineStage) {
        await storage.addLeadActivity({
          submissionId: sub.id, companyId: user.companyId,
          eventType: "stage_changed",
          eventData: JSON.stringify({ from: sub.pipelineStage, to: req.body.pipelineStage }),
          createdByUserId: user.id, createdAt: new Date().toISOString(),
        });
      }
      const updated = await storage.updateQuoteFormSubmission(req.params.id, updates);
      res.json({ ...updated, data: JSON.parse(updated!.data) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Run AI estimate for a submission
  app.post("/api/admin/submissions/:id/estimate", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getQuoteFormSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });

      const settings = await storage.getEstimatorSettings(user.companyId);
      if (!settings) return res.status(400).json({ message: "Configure Estimator Settings first." });

      const now = new Date().toISOString();
      let data: any = {};
      try { data = JSON.parse(sub.data); } catch {}

      // Fetch walkthrough context if available
      const walkthroughForEstimate = await storage.getQuoteRequestWalkthroughBySubmission(sub.id);
      let walkthroughContext = "";
      if (walkthroughForEstimate) {
        const wtSections = await storage.getQuoteRequestWalkthroughSections(walkthroughForEstimate.id);
        walkthroughContext = `
WALKTHROUGH CONTEXT:
- Client submitted ${walkthroughForEstimate.photoCount} walkthrough photos${walkthroughForEstimate.durationSeconds ? ` and a ${Math.round(walkthroughForEstimate.durationSeconds / 60)}-minute voice note` : ""}
${walkthroughForEstimate.aiSummary ? `- AI Summary: ${walkthroughForEstimate.aiSummary}` : ""}
${walkthroughForEstimate.transcript ? `- Voice transcript: "${walkthroughForEstimate.transcript.substring(0, 500)}${walkthroughForEstimate.transcript.length > 500 ? "..." : ""}"` : ""}
${wtSections.length > 0 ? `- Photo sections identified: ${wtSections.map(s => `${s.title}: ${s.description}`).join("; ")}` : ""}
Use this visual context to refine your estimate. Add-ons or condition-based adjustments may apply.`;
      }

      // Create pending estimate record
      let estimate = await storage.createAiEstimate({
        submissionId: sub.id, companyId: user.companyId,
        status: "running", createdAt: now, updatedAt: now,
      });
      await storage.updateQuoteFormSubmission(sub.id, { estimateStatus: "running" });

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Detect residential vs commercial from submitted data
      const isCommercial = data.propertyType === "Commercial" ||
        ["Commercial", "Industrial / Warehouse"].includes(data.propertyCategory) ||
        ["Commercial Cleaning", "Office Cleaning"].includes(data.serviceType);

      // Select the right pricing profile — commercial profile is used when configured + job is commercial
      const commProfileAvailable = !!(settings.commHourlyRate && parseFloat(settings.commHourlyRate) > 0);
      const useCommProfile = isCommercial && commProfileAvailable;
      const pricingWarning = isCommercial && !commProfileAvailable
        ? "Commercial pricing settings are incomplete. Estimate used residential fallback defaults." : null;

      // Build the active pricing profile object
      const pricing = useCommProfile ? {
        hourlyRate: settings.commHourlyRate ?? settings.hourlyRate,
        minimumJobPrice: settings.commMinimumJobPrice ?? settings.minimumJobPrice,
        pricePerSqft: settings.commPricePerSqft ?? settings.pricePerSqft,
        supplyFee: settings.commSupplyFee ?? settings.supplyFee,
        travelFee: settings.commTravelFee ?? settings.travelFee,
        taxRate: settings.commTaxRate ?? settings.taxRate,
        profitMargin: settings.commProfitMargin ?? settings.profitMargin,
        defaultCrewSize: settings.commDefaultCrewSize ?? settings.defaultCrewSize,
        productivityRate: settings.commProductivityRate ?? settings.productivityRate,
        // Commercial-specific
        pricePerWashroom: settings.commPricePerWashroom,
        pricePerOffice: settings.commPricePerOffice,
        pricePerFloor: settings.commPricePerFloor,
        kitchenBreakroomAddOn: settings.commKitchenAddOn,
        garbageAddOn: settings.commGarbageAddOn,
        restockAddOn: settings.commRestockAddOn,
        floorCareAddOn: settings.commFloorCareAddOn,
        windowCleanAddOn: settings.commWindowCleanAddOn,
        afterHoursMultiplier: settings.commAfterHoursMultiplier,
        dailyServiceMultiplier: settings.commDailyServiceMultiplier,
        commercialMultiplier: settings.commCommercialMultiplier ?? settings.commercialMultiplier,
        customRules: settings.commCustomRules || settings.customRules,
      } : {
        hourlyRate: settings.hourlyRate,
        minimumJobPrice: settings.minimumJobPrice,
        pricePerSqft: settings.pricePerSqft,
        pricePerBathroom: settings.pricePerBathroom,
        pricePerRoom: settings.pricePerRoom,
        kitchenAddOn: settings.kitchenAddOn,
        basementAddOn: settings.basementAddOn,
        petFee: settings.petFee,
        supplyFee: settings.supplyFee,
        travelFee: settings.travelFee,
        taxRate: settings.taxRate,
        profitMargin: settings.profitMargin,
        defaultCrewSize: settings.defaultCrewSize,
        productivityRate: settings.productivityRate,
        deepCleanMultiplier: settings.deepCleanMultiplier,
        moveInOutMultiplier: settings.moveInOutMultiplier,
        postConstructionMultiplier: settings.postConstructionMultiplier,
        afterHoursMultiplier: settings.afterHoursMultiplier,
        customRules: settings.customRules,
      };

      // Resolve frequency details
      const frequencyType = data.frequencyType || data.frequency || "One-time";
      const isRecurring = !["One-time", "one-time", "one time", "One-Time"].includes(frequencyType);

      // Calculate estimated monthly visits
      let estimatedVisitsPerMonth = 1;
      if (frequencyType === "Weekly" && data.daysPerWeek) {
        estimatedVisitsPerMonth = Math.round(parseInt(data.daysPerWeek) * 4.33 * 10) / 10;
      } else if (frequencyType === "Bi-weekly" && data.visitsBiweekly) {
        estimatedVisitsPerMonth = Math.round(parseInt(data.visitsBiweekly) * 2.17 * 10) / 10;
      } else if (frequencyType === "Monthly" && data.visitsPerMonth) {
        estimatedVisitsPerMonth = parseInt(data.visitsPerMonth) || 1;
      } else if (frequencyType === "Custom schedule" && data.estimatedVisitsPerMonth) {
        estimatedVisitsPerMonth = parseFloat(data.estimatedVisitsPerMonth) || 1;
      }

      // Contract length in months
      const contractLengthRaw = data.contractLength ?? "";
      const contractMonths = contractLengthRaw.includes("12") ? 12
        : contractLengthRaw.includes("6") ? 6
        : contractLengthRaw.includes("3") ? 3
        : 0;

      const pricingRulesText = useCommProfile ? `
PRICING PROFILE: COMMERCIAL
- Hourly rate: $${pricing.hourlyRate}/hr
- Minimum job price: $${pricing.minimumJobPrice}
- Price per sq ft: $${pricing.pricePerSqft}
- Price per washroom: $${pricing.pricePerWashroom}
- Price per office/room: $${pricing.pricePerOffice}
- Price per floor: $${pricing.pricePerFloor}
- Kitchen/breakroom add-on: $${pricing.kitchenBreakroomAddOn}
- Garbage removal add-on: $${pricing.garbageAddOn}
- Restocking supplies add-on: $${pricing.restockAddOn}
- Floor care add-on: $${pricing.floorCareAddOn}
- Window cleaning add-on: $${pricing.windowCleanAddOn}
- Commercial multiplier: ${pricing.commercialMultiplier}x
- After-hours multiplier: ${pricing.afterHoursMultiplier}x
- Daily service multiplier: ${pricing.dailyServiceMultiplier}x
- Supply fee: $${pricing.supplyFee}
- Tax rate: ${pricing.taxRate}%
- Profit margin: ${pricing.profitMargin}%
- Default crew size: ${pricing.defaultCrewSize}
- Productivity: ${pricing.productivityRate} sq ft/hr/person
${pricing.customRules ? `- Custom rules: ${pricing.customRules}` : ""}` : `
PRICING PROFILE: RESIDENTIAL
- Hourly rate: $${pricing.hourlyRate}/hr
- Minimum job price: $${pricing.minimumJobPrice}
- Price per sq ft: $${pricing.pricePerSqft}
- Price per bathroom: $${pricing.pricePerBathroom}
- Price per bedroom/room: $${pricing.pricePerRoom}
- Kitchen add-on: $${pricing.kitchenAddOn}
- Basement add-on: $${pricing.basementAddOn}
- Pet fee: $${pricing.petFee}
- Deep clean multiplier: ${pricing.deepCleanMultiplier}x
- Move-in/out multiplier: ${pricing.moveInOutMultiplier}x
- Post-construction multiplier: ${pricing.postConstructionMultiplier}x
- After-hours multiplier: ${pricing.afterHoursMultiplier}x
- Supply fee: $${pricing.supplyFee}
- Tax rate: ${pricing.taxRate}%
- Profit margin: ${pricing.profitMargin}%
- Default crew size: ${pricing.defaultCrewSize}
- Productivity: ${pricing.productivityRate} sq ft/hr/person
${pricing.customRules ? `- Custom rules: ${pricing.customRules}` : ""}`;

      const prompt = `You are an expert cleaning service estimator.

JOB TYPE: ${isCommercial ? "COMMERCIAL" : "RESIDENTIAL"}
${pricingRulesText}

FREQUENCY TYPE: ${frequencyType}
${isRecurring ? `ESTIMATED MONTHLY VISITS: ${estimatedVisitsPerMonth}` : ""}
${isRecurring && data.daysPerWeek ? `DAYS PER WEEK: ${data.daysPerWeek}` : ""}
${isRecurring && data.visitsBiweekly ? `VISITS EVERY 2 WEEKS: ${data.visitsBiweekly}` : ""}
${isRecurring && data.visitsPerMonth ? `VISITS PER MONTH: ${data.visitsPerMonth}` : ""}
${isRecurring && data.contractLength ? `SERVICE AGREEMENT: ${data.contractLength} (${contractMonths > 0 ? contractMonths + " months" : "month-to-month"})` : ""}
${isRecurring && data.preferredDays ? `PREFERRED DAYS: ${data.preferredDays}` : ""}
${pricingWarning ? `WARNING: ${pricingWarning}` : ""}

CALCULATION RULES:
${frequencyType === "Weekly" && data.daysPerWeek ? `- Monthly visits = ${parseInt(data.daysPerWeek) || 1} days × 4.33 = ${estimatedVisitsPerMonth} visits/month` : ""}
${frequencyType === "Bi-weekly" && data.visitsBiweekly ? `- Monthly visits = ${parseInt(data.visitsBiweekly) || 1} × 2.17 = ${estimatedVisitsPerMonth} visits/month` : ""}
- monthly_price = per_visit_price × ${estimatedVisitsPerMonth} monthly visits
${contractMonths > 0 ? `- contract_total = monthly_price × ${contractMonths} months` : ""}

CLIENT SUBMISSION:
${JSON.stringify(data, null, 2)}
${walkthroughContext}

Return ONLY a valid JSON object (no extra text):
{
  "price_min": number,
  "price_max": number,
  "recommended_price": number,
  "billing_type": "${isRecurring ? "per_visit" : "one_time"}",
  "pricing_profile": "${isCommercial ? (commProfileAvailable ? "commercial" : "residential_fallback") : "residential"}",
  "labor_hours": number,
  "crew_size": number,
  "pricing_breakdown": [
    { "label": "Base cleaning", "amount": 0 },
    { "label": "Additional item", "amount": 0 }
  ],
  "estimated_visits_per_month": ${isRecurring ? estimatedVisitsPerMonth : "null"},
  "monthly_total": ${isRecurring ? "number (recommended_price × " + estimatedVisitsPerMonth + ")" : "null"},
  "contract_months": ${contractMonths > 0 ? contractMonths : "null"},
  "contract_total": ${isRecurring && contractMonths > 0 ? "number (monthly_total × " + contractMonths + ")" : "null"},
  "frequency_summary": "${isRecurring ? frequencyType + (data.daysPerWeek ? " · " + data.daysPerWeek : data.visitsBiweekly ? " · " + data.visitsBiweekly : data.visitsPerMonth ? " · " + data.visitsPerMonth : "") : "One-time service"}",
  "client_summary": "short professional summary for the client (2-3 sentences)",
  "suggested_services": "string describing recommended services",
  "add_ons": "string listing optional add-ons with prices",
  "risk_notes": "string describing any risks or special considerations",
  "follow_up_questions": "string with questions for the client if info is missing",
  "confidence_level": "high|medium|low",
  "confidence_note": "string explaining confidence"
}

RULES:
- Never return less than the minimum job price ($${pricing.minimumJobPrice})
- Show 3-6 pricing breakdown line items
- recommended_price = per-visit price for recurring jobs, total for one-time
- monthly_total = recommended_price × ${estimatedVisitsPerMonth} visits/month
${contractMonths > 0 ? `- contract_total = monthly_total × ${contractMonths} months` : ""}
- Recommended price must be between price_min and price_max
- Only use the pricing profile passed above — do not mix residential and commercial rates`;

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.3,
        });
        const result = JSON.parse(completion.choices[0].message.content || "{}");
        estimate = (await storage.updateAiEstimate(estimate.id, {
          status: "completed",
          priceMin: String(result.price_min ?? 0),
          priceMax: String(result.price_max ?? 0),
          recommendedPrice: String(result.recommended_price ?? 0),
          laborHours: String(result.labor_hours ?? 0),
          crewSize: result.crew_size ?? settings.defaultCrewSize,
          suggestedServices: result.client_summary ?? result.suggested_services ?? "",
          addOns: result.add_ons ?? "",
          suppliesNeeded: result.supplies_needed ?? "",
          riskNotes: result.risk_notes ?? "",
          followUpQuestions: result.follow_up_questions ?? "",
          confidenceLevel: result.confidence_level ?? "medium",
          confidenceNote: result.confidence_note ?? "",
          rawResponse: completion.choices[0].message.content,
          updatedAt: new Date().toISOString(),
        }))!;

        // Update submission + create quote draft
        await storage.updateQuoteFormSubmission(sub.id, {
          estimateStatus: "completed",
          pipelineStage: sub.pipelineStage === "new_request" ? "estimated" : sub.pipelineStage,
        });

        const existingQuote = await storage.getFormQuoteBySubmission(sub.id);
        if (!existingQuote) {
          await storage.createFormQuote({
            submissionId: sub.id, companyId: user.companyId,
            status: "draft",
            price: String(result.recommended_price ?? 0),
            scopeOfWork: result.suggested_services ?? "",
            addOns: result.add_ons ?? "",
            estimatedDuration: `${result.labor_hours ?? 0} hours`,
            notes: result.risk_notes ?? "",
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          });
        }

        await storage.addLeadActivity({
          submissionId: sub.id, companyId: user.companyId,
          eventType: "estimate_completed",
          eventData: JSON.stringify({ priceMin: result.price_min, priceMax: result.price_max, recommended: result.recommended_price }),
          createdByUserId: user.id, createdAt: new Date().toISOString(),
        });
      } catch (aiErr: any) {
        await storage.updateAiEstimate(estimate.id, {
          status: "failed", errorMessage: aiErr.message, updatedAt: new Date().toISOString(),
        });
        await storage.updateQuoteFormSubmission(sub.id, { estimateStatus: "failed" });
      }

      const final = await storage.getAiEstimateBySubmission(sub.id);
      res.json({ estimate: final });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Form Quotes CRUD
  app.get("/api/admin/submissions/:id/quote", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getQuoteFormSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const quote = await storage.getFormQuoteBySubmission(req.params.id);
      res.json(quote || null);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/admin/submissions/:id/quote", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getQuoteFormSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      let quote = await storage.getFormQuoteBySubmission(req.params.id);
      if (quote) {
        quote = (await storage.updateFormQuote(quote.id, { ...req.body, updatedAt: now }))!;
      } else {
        quote = await storage.createFormQuote({ submissionId: sub.id, companyId: user.companyId, ...req.body, createdAt: now, updatedAt: now });
      }
      if (req.body.status === "ready" || req.body.status === "sent") {
        await storage.updateQuoteFormSubmission(sub.id, { pipelineStage: req.body.status === "sent" ? "quote_sent" : "quote_ready" });
      }
      res.json(quote);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Lead activity
  app.get("/api/admin/submissions/:id/activity", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getQuoteFormSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const activity = await storage.getLeadActivity(req.params.id);
      res.json(activity);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/submissions/:id/activity", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getQuoteFormSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const item = await storage.addLeadActivity({
        submissionId: sub.id, companyId: user.companyId,
        eventType: req.body.eventType || "note",
        eventData: JSON.stringify({ note: req.body.note || "" }),
        createdByUserId: user.id, createdAt: new Date().toISOString(),
      });
      res.json(item);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Respond to submission via email
  app.post("/api/admin/submissions/:id/respond", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getQuoteFormSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });

      const { to, subject, message } = req.body;
      if (!to || !subject || !message) return res.status(400).json({ message: "to, subject, and message are required" });

      // Get company info for the from name
      const company = await storage.getCompany(user.companyId);
      const companyName = company?.name || "Your Cleaning Company";

      let emailSent = false;
      let emailError = "";
      try {
        const FormDataLib = (await import("form-data")).default;
        const Mailgun = (await import("mailgun.js")).default;
        const mg = new Mailgun(FormDataLib);
        const apiKey = process.env.MAILGUN_API_KEY;
        const domain = process.env.MAILGUN_DOMAIN;
        if (!apiKey || !domain) throw new Error("Email not configured");
        const client = mg.client({ username: "api", key: apiKey });
        const from = process.env.MAIL_FROM || `${companyName} <noreply@clockfield.ca>`;
        await client.messages.create(domain, {
          from,
          to: [to],
          subject,
          text: message,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<p style="white-space:pre-line;font-size:15px;color:#374151;line-height:1.7;">${message.replace(/\n/g, "<br/>")}</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
<p style="font-size:12px;color:#9ca3af;">${companyName}</p>
</div>`,
        });
        emailSent = true;
      } catch (mailErr: any) {
        emailError = mailErr.message;
      }

      // Log the activity
      await storage.addLeadActivity({
        submissionId: sub.id, companyId: user.companyId,
        eventType: "email_sent",
        eventData: JSON.stringify({ to, subject, emailSent, emailError, sentBy: user.id }),
        createdByUserId: user.id, createdAt: new Date().toISOString(),
      });

      // Move stage to "follow_up" if still at new_request
      if (sub.pipelineStage === "new_request") {
        await storage.updateQuoteFormSubmission(sub.id, { pipelineStage: "follow_up" });
      }

      if (emailSent) {
        res.json({ success: true, message: "Email sent successfully." });
      } else {
        res.json({ success: false, emailError, message: "Email could not be sent. Your message was saved." });
      }
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Estimator Settings
  app.get("/api/admin/estimator-settings", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const settings = await storage.getEstimatorSettings(user.companyId);
      res.json(settings || null);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/admin/estimator-settings", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const settings = await storage.upsertEstimatorSettings(user.companyId, req.body);
      res.json(settings);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Form Email Settings
  app.get("/api/admin/form-email-settings", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const settings = await storage.getFormEmailSettings(user.companyId);
      res.json(settings || null);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/admin/form-email-settings", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const settings = await storage.upsertFormEmailSettings(user.companyId, req.body);
      res.json(settings);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Proposals & Quotes (Admin) ───────────────────────────────────────────
  app.get("/api/proposals", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const all = await storage.getProposalsByCompany(user.companyId);
      res.json(all);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/proposals", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });
      const token = randomBytes(32).toString("hex");
      const proposalNumber = await storage.getNextProposalNumber(user.companyId);
      const now = new Date().toISOString();
      const snapshot = JSON.stringify({
        name: company.name,
        logoUrl: company.companyLogoUrl ?? null,
        address: company.address ?? null,
        city: company.city ?? null,
        province: company.province ?? null,
        postalCode: company.postalCode ?? null,
        phone: company.companyPhone ?? null,
        email: company.companyEmail ?? null,
        website: null,
        brandColor: company.brandColor ?? null,
      });
      const defaultPricing = JSON.stringify({
        lineItems: [],
        taxConfig: { type: "none", rate: 0, label: "No Tax" },
        subtotalOverride: null,
        notes: "",
      });
      const defaultTerms = `1. Proposal Validity\n   This proposal is valid until the expiry date shown on the document. Pricing and availability may be subject to change after this date.\n\n2. Scope of Work\n   The services included in this proposal are limited to the scope of work listed in this document. Any additional services, special requests, or work outside the agreed scope may require a separate quote or written approval.\n\n3. Service Schedule\n   Service days, times, and start date are subject to final confirmation between the client and the service provider. The preferred start date selected by the client will be reviewed and confirmed before service begins.\n\n4. Pricing and Taxes\n   All pricing is based on the service details, frequency, estimated labour, and scope listed in this proposal. Applicable taxes will be added where required. Final pricing may change if site conditions, service requirements, or cleaning frequency differ from the information provided.\n\n5. Supplies and Equipment\n   Unless stated otherwise, standard cleaning supplies and equipment required to complete the listed scope are included. Specialty supplies, consumables, paper products, dispensers, waste bags, floor care products, or equipment rentals may be billed separately if not included in this proposal.\n\n6. Access to Site\n   The client is responsible for providing safe and reasonable access to the service location during the agreed service time. Delays or missed access may affect scheduling and may result in additional charges.\n\n7. Health and Safety\n   The service provider may refuse or pause work if unsafe conditions are present. Hazardous materials, biohazards, pest issues, excessive debris, or unsafe areas may require additional assessment before work can continue.\n\n8. Changes and Cancellations\n   Any requested changes to the scope, schedule, or frequency should be communicated in advance. Cancellations, rescheduling, or service changes may be subject to the business's cancellation policy if applicable.\n\n9. Acceptance\n   By accepting this proposal, the client confirms that they have reviewed the scope of work, pricing, service details, and terms listed in this document. Acceptance does not replace a separate service agreement if one is required by the business.\n\n10. Payment Terms\n    Payment terms will be confirmed by the service provider. Invoices are due according to the agreed billing schedule. Late payments may affect future service scheduling.`;
      const defaultIncluded = JSON.stringify([
        { id: "labour", label: "Labour", status: "included" },
        { id: "basic_supplies", label: "Basic cleaning supplies", status: "included" },
        { id: "garbage_bags", label: "Garbage bags", status: "included" },
        { id: "paper_products", label: "Paper products", status: "not_included" },
        { id: "window_cleaning", label: "Window cleaning", status: "extra_cost" },
      ]);
      const proposal = await storage.createProposal({
        companyId: user.companyId,
        proposalNumber,
        title: req.body.title || "New Proposal",
        status: "draft",
        clientId: req.body.clientId ?? null,
        clientName: req.body.clientName ?? "",
        clientCompany: req.body.clientCompany ?? "",
        clientEmail: req.body.clientEmail ?? "",
        clientPhone: req.body.clientPhone ?? "",
        serviceAddress: req.body.serviceAddress ?? "",
        billingAddress: req.body.billingAddress ?? "",
        contactPerson: req.body.contactPerson ?? "",
        leadSource: req.body.leadSource ?? "",
        proposalDate: now.slice(0, 10),
        expiryDate: req.body.expiryDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        preparedByUserId: user.id,
        businessSnapshot: snapshot,
        serviceDetails: JSON.stringify({
          serviceType: "", frequency: "", daysPerWeek: "", hoursPerVisit: "",
          numCleaners: "1", preferredTime: "", contractLength: "", proposedStartDate: "",
        }),
        scopeSections: "[]",
        includedItems: defaultIncluded,
        pricingConfig: defaultPricing,
        termsText: defaultTerms,
        internalNotes: "",
        publicToken: token,
        clientResponse: "{}",
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      await storage.addProposalActivity({
        proposalId: proposal.id,
        companyId: user.companyId,
        eventType: "created",
        eventData: "{}",
        createdByUserId: user.id,
        createdAt: now,
      });
      res.json(proposal);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/proposals/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const p = await storage.getProposal(req.params.id);
      if (!p || p.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      res.json(p);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/proposals/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const p = await storage.getProposal(req.params.id);
      if (!p || p.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateProposal(req.params.id, {
        ...req.body,
        updatedAt: new Date().toISOString(),
      });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/proposals/:id/activity", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const p = await storage.getProposal(req.params.id);
      if (!p || p.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const logs = await storage.getProposalActivityLogs(req.params.id);
      res.json(logs);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/proposals/:id/send-email", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const p = await storage.getProposal(req.params.id);
      if (!p || p.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      // Use email from request body first, then fall back to stored clientEmail
      const toEmail = (req.body.to || p.clientEmail || "").trim();
      if (!toEmail) return res.status(400).json({ message: "No recipient email address provided. Add a client email and try again." });
      let snapshot: any = {};
      try { snapshot = JSON.parse(p.businessSnapshot); } catch {}
      const businessName = snapshot.name || "Your Service Provider";
      const brandColor = snapshot.brandColor || "#1e293b";
      const logoUrl = snapshot.logoUrl || null;
      const host = req.headers.host || "app.clockfield.ca";
      const proto = (req.headers["x-forwarded-proto"] as string || "https").split(",")[0].trim();
      const proposalUrl = `${proto}://${host}/public/proposals/${p.publicToken}`;
      const customSubject = req.body.subject || `Proposal from ${businessName} — ${p.proposalNumber}`;
      const customMessage = req.body.message || null;
      const sendCopyToSelf = req.body.sendCopyToSelf === true;
      const adminEmail = user.email || null;
      try {
        await sendProposalEmail({
          to: toEmail,
          clientName: p.clientName || "there",
          businessName,
          brandColor,
          logoUrl,
          proposalTitle: p.title,
          proposalNumber: p.proposalNumber,
          proposalUrl,
          expiryDate: p.expiryDate,
          customSubject,
          customMessage,
          businessPhone: snapshot.phone || null,
          businessEmail: snapshot.email || null,
        });
        if (sendCopyToSelf && adminEmail && adminEmail !== toEmail) {
          await sendProposalEmail({
            to: adminEmail,
            clientName: p.clientName || "there",
            businessName,
            brandColor,
            logoUrl,
            proposalTitle: p.title,
            proposalNumber: p.proposalNumber,
            proposalUrl,
            expiryDate: p.expiryDate,
            customSubject: `[COPY] ${customSubject}`,
            customMessage,
            businessPhone: snapshot.phone || null,
            businessEmail: snapshot.email || null,
          });
        }
        const now = new Date().toISOString();
        const updatedStatus = p.status === "draft" ? "sent" : p.status;
        // Also update clientEmail if the body provided a different one
        const patch: any = { status: updatedStatus, sentAt: now, updatedAt: now };
        if (req.body.to && req.body.to !== p.clientEmail) patch.clientEmail = req.body.to;
        await storage.updateProposal(p.id, patch);
        await storage.addProposalActivity({
          proposalId: p.id, companyId: user.companyId, eventType: "sent_email",
          eventData: JSON.stringify({ to: toEmail }), createdByUserId: user.id, createdAt: now,
        });
        res.json({ success: true });
      } catch (mailErr: any) {
        // Email failed — still return 200 with error description so frontend can show friendly message
        if (mailErr.message?.includes("Mailgun not configured")) {
          res.json({ success: false, emailError: "Email is not configured on this account. Copy the proposal link to share it manually." });
        } else {
          res.json({ success: false, emailError: "The proposal was saved but the email could not be sent. Please check your email settings or copy the proposal link instead." });
        }
      }
    } catch (e: any) {
      res.status(500).json({ message: "An unexpected error occurred. Please try again." });
    }
  });

  // Refresh business snapshot from current settings
  app.post("/api/proposals/:id/refresh-branding", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const p = await storage.getProposal(req.params.id);
      if (!p || p.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });
      const snapshot = JSON.stringify({
        name: company.name,
        logoUrl: company.companyLogoUrl ?? null,
        address: company.address ?? null,
        city: company.city ?? null,
        province: company.province ?? null,
        postalCode: company.postalCode ?? null,
        phone: company.companyPhone ?? null,
        email: company.companyEmail ?? null,
        website: null,
        brandColor: company.brandColor ?? null,
      });
      const updated = await storage.updateProposal(p.id, { businessSnapshot: snapshot, updatedAt: new Date().toISOString() });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Grammar cleanup via OpenAI
  app.post("/api/proposals/grammar-cleanup", requireAuth, async (req, res) => {
    try {
      const { rawText } = req.body;
      if (!rawText || typeof rawText !== "string") return res.status(400).json({ message: "rawText required" });
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional editor. Clean up the provided text: fix grammar, capitalization, punctuation, and phrasing. Keep the same meaning and bullet-point style if present. Return ONLY the cleaned text with no explanation." },
          { role: "user", content: rawText },
        ],
        max_tokens: 500,
      });
      const cleanText = completion.choices[0]?.message?.content?.trim() || rawText;
      res.json({ cleanText });
    } catch (e: any) {
      res.status(200).json({ cleanText: req.body.rawText, error: "Grammar cleanup failed — raw text returned." });
    }
  });

  app.post("/api/proposals/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const p = await storage.getProposal(req.params.id);
      if (!p || p.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const token = randomBytes(32).toString("hex");
      const proposalNumber = await storage.getNextProposalNumber(user.companyId);
      const now = new Date().toISOString();
      const dup = await storage.createProposal({
        companyId: p.companyId,
        proposalNumber,
        title: `${p.title} (Copy)`,
        status: "draft",
        clientId: p.clientId,
        clientName: p.clientName,
        clientCompany: p.clientCompany,
        clientEmail: p.clientEmail,
        clientPhone: p.clientPhone,
        serviceAddress: p.serviceAddress,
        billingAddress: p.billingAddress,
        contactPerson: p.contactPerson,
        leadSource: p.leadSource,
        proposalDate: now.slice(0, 10),
        expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        preparedByUserId: user.id,
        businessSnapshot: p.businessSnapshot,
        serviceDetails: p.serviceDetails,
        scopeSections: p.scopeSections,
        includedItems: p.includedItems,
        pricingConfig: p.pricingConfig,
        termsText: p.termsText,
        internalNotes: p.internalNotes,
        publicToken: token,
        clientResponse: "{}",
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      await storage.addProposalActivity({
        proposalId: dup.id, companyId: user.companyId, eventType: "created",
        eventData: JSON.stringify({ duplicatedFrom: p.id }), createdByUserId: user.id, createdAt: now,
      });
      res.json(dup);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/proposals/:id/archive", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const p = await storage.getProposal(req.params.id);
      if (!p || p.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      const updated = await storage.updateProposal(p.id, { isArchived: !p.isArchived, updatedAt: now });
      await storage.addProposalActivity({
        proposalId: p.id, companyId: user.companyId,
        eventType: updated!.isArchived ? "archived" : "unarchived",
        eventData: "{}", createdByUserId: user.id, createdAt: now,
      });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Proposals & Quotes (Public) ───────────────────────────────────────────
  app.get("/api/public/proposals/:token", async (req, res) => {
    try {
      const p = await storage.getProposalByToken(req.params.token);
      if (!p) return res.status(404).json({ message: "This proposal link is not available." });
      // Never expose internal notes or private fields
      const { internalNotes: _in, ...safe } = p;
      res.json(safe);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/proposals/:token/viewed", async (req, res) => {
    try {
      const p = await storage.getProposalByToken(req.params.token);
      if (!p) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      if (!p.viewedAt) {
        await storage.updateProposal(p.id, {
          viewedAt: now,
          status: p.status === "sent" ? "viewed" : p.status,
          updatedAt: now,
        });
        await storage.addProposalActivity({
          proposalId: p.id, companyId: p.companyId, eventType: "viewed",
          eventData: "{}", createdByUserId: null, createdAt: now,
        });
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/proposals/:token/accept", async (req, res) => {
    try {
      const p = await storage.getProposalByToken(req.params.token);
      if (!p) return res.status(404).json({ message: "Not found" });
      if (p.isArchived) return res.status(400).json({ message: "This proposal is no longer available." });
      const now = new Date().toISOString();
      const expiryPassed = p.expiryDate && new Date(p.expiryDate) < new Date();
      if (expiryPassed) return res.status(400).json({ message: "This proposal has expired." });
      await storage.updateProposal(p.id, {
        status: "accepted",
        acceptedAt: now,
        clientResponse: JSON.stringify(req.body),
        updatedAt: now,
      });
      await storage.addProposalActivity({
        proposalId: p.id, companyId: p.companyId, eventType: "accepted",
        eventData: JSON.stringify(req.body), createdByUserId: null, createdAt: now,
      });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/proposals/:token/reject", async (req, res) => {
    try {
      const p = await storage.getProposalByToken(req.params.token);
      if (!p) return res.status(404).json({ message: "Not found" });
      if (p.isArchived) return res.status(400).json({ message: "This proposal is no longer available." });
      const now = new Date().toISOString();
      await storage.updateProposal(p.id, {
        status: "rejected",
        rejectedAt: now,
        clientResponse: JSON.stringify(req.body),
        updatedAt: now,
      });
      await storage.addProposalActivity({
        proposalId: p.id, companyId: p.companyId, eventType: "rejected",
        eventData: JSON.stringify(req.body), createdByUserId: null, createdAt: now,
      });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/proposals/:token/thinking", async (req, res) => {
    try {
      const p = await storage.getProposalByToken(req.params.token);
      if (!p) return res.status(404).json({ message: "Not found" });
      if (p.isArchived) return res.status(400).json({ message: "This proposal is no longer available." });
      const now = new Date().toISOString();
      await storage.updateProposal(p.id, {
        status: "thinking",
        thinkingAt: now,
        clientResponse: JSON.stringify(req.body),
        updatedAt: now,
      });
      await storage.addProposalActivity({
        proposalId: p.id, companyId: p.companyId, eventType: "thinking",
        eventData: JSON.stringify(req.body), createdByUserId: null, createdAt: now,
      });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Quote Forms (Public) ──────────────────────────────────────────────────
  app.get("/api/public/forms/:companyId/:slug", async (req, res) => {
    try {
      const form = await storage.getQuoteFormBySlug(req.params.companyId, req.params.slug);
      if (!form || !form.isActive) return res.status(404).json({ message: "Form not found" });
      const company = await storage.getCompany(req.params.companyId);
      const upgradedConfig = await maybeUpgradeSmartConfig(form);
      res.json({
        id: form.id,
        name: form.name,
        config: JSON.parse(upgradedConfig),
        companyName: company?.name ?? "",
        companyLogo: company?.companyLogoUrl ?? null,
        brandColor: company?.brandColor ?? null,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/forms/:companyId/:slug/submit", async (req, res) => {
    try {
      const form = await storage.getQuoteFormBySlug(req.params.companyId, req.params.slug);
      if (!form || !form.isActive) return res.status(404).json({ message: "Form not found" });
      const d = req.body as Record<string, any>;
      const now = new Date().toISOString();

      // Extract CRM fields from submitted data
      const clientName = [d.firstName, d.lastName].filter(Boolean).join(" ") || d.name || "";
      const clientEmail = d.email || d.clientEmail || "";
      const clientPhone = d.phone || d.clientPhone || "";
      const serviceType = d.serviceType || d.service_type || "";
      const addressParts = [d.street, d.city, d.province, d.postalCode].filter(Boolean);
      const serviceAddress = d.address || addressParts.join(", ") || "";

      const submission = await storage.createQuoteFormSubmission({
        formId: form.id,
        companyId: req.params.companyId,
        data: JSON.stringify(d),
        status: "new",
        submittedAt: now,
        clientName,
        clientEmail,
        clientPhone,
        serviceType,
        serviceAddress,
        pipelineStage: "new_request",
        estimateStatus: "pending",
      });

      // Log submission activity
      await storage.addLeadActivity({
        submissionId: submission.id, companyId: req.params.companyId,
        eventType: "submitted", eventData: JSON.stringify({ formName: form.name }),
        createdAt: now,
      });

      // Send confirmation email if enabled
      try {
        const emailSettings = await storage.getFormEmailSettings(req.params.companyId);
        const company = await storage.getCompany(req.params.companyId);
        if (emailSettings?.confirmationEnabled && clientEmail) {
          const companyName = company?.name || "Us";
          const firstName = d.firstName || clientName.split(" ")[0] || "there";
          const body = (emailSettings.confirmationBody || "")
            .replace(/{client_first_name}/g, firstName)
            .replace(/{client_full_name}/g, clientName)
            .replace(/{company_name}/g, companyName)
            .replace(/{service_type}/g, serviceType)
            .replace(/{service_address}/g, serviceAddress)
            .replace(/{submission_date}/g, new Date().toLocaleDateString());
          const subject = (emailSettings.confirmationSubject || "We received your request!")
            .replace(/{company_name}/g, companyName);
          const { sendProposalEmail } = await import("./mail");
          await sendProposalEmail({ to: clientEmail, subject, message: body, sendCopyToSelf: false });
          await storage.updateQuoteFormSubmission(submission.id, { confirmationEmailSentAt: new Date().toISOString() });
        }
      } catch (emailErr) {
        console.error("[form-submit] Confirmation email failed:", emailErr);
      }

      res.json({ id: submission.id });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Agreement Templates (Admin) ─────────────────────────────────────────
  app.get("/api/admin/agreement-templates", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const templates = await storage.getAgreementTemplates(user.companyId);
      res.json(templates);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/agreement-templates", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const now = new Date().toISOString();
      const template = await storage.createAgreementTemplate({
        companyId: user.companyId,
        name: req.body.name || "Untitled Template",
        title: req.body.title || "Service Agreement",
        body: req.body.body || "",
        termsText: req.body.termsText || "",
        paymentTerms: req.body.paymentTerms || "",
        contractDuration: req.body.contractDuration || "",
        cancellationPolicy: req.body.cancellationPolicy || "",
        witnessEnabled: req.body.witnessEnabled ?? false,
        isDefault: req.body.isDefault ?? false,
        createdAt: now, updatedAt: now,
      });
      res.json(template);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/agreement-templates/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const template = await storage.getAgreementTemplate(req.params.id);
      if (!template || template.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateAgreementTemplate(req.params.id, { ...req.body, updatedAt: new Date().toISOString() });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/admin/agreement-templates/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const template = await storage.getAgreementTemplate(req.params.id);
      if (!template || template.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.deleteAgreementTemplate(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Agreements (Admin) ──────────────────────────────────────────────────
  app.get("/api/admin/agreements", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const list = await storage.getAgreementsByCompany(user.companyId);
      res.json(list);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/agreements/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const agr = await storage.getAgreement(req.params.id);
      if (!agr || agr.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      res.json(agr);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/agreements/:id/activity", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const agr = await storage.getAgreement(req.params.id);
      if (!agr || agr.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const logs = await storage.getAgreementActivity(req.params.id);
      res.json(logs);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/agreements", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const now = new Date().toISOString();
      const token = `agr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      // If proposalId given, pull client info from proposal
      let clientInfo: any = {};
      if (req.body.proposalId) {
        const proposal = await storage.getProposal(req.body.proposalId);
        if (proposal && proposal.companyId === user.companyId) {
          clientInfo = {
            clientName: proposal.clientName || "",
            clientEmail: proposal.clientEmail || "",
            clientCompany: proposal.clientCompany || "",
            clientPhone: proposal.clientPhone || "",
            serviceAddress: proposal.serviceAddress || "",
          };
        }
      }
      const agr = await storage.createAgreement({
        companyId: user.companyId,
        proposalId: req.body.proposalId || null,
        templateId: req.body.templateId || null,
        title: req.body.title || "Service Agreement",
        content: req.body.content || "",
        status: "draft",
        ...clientInfo,
        ...req.body.clientInfo,
        publicToken: token,
        witnessEnabled: req.body.witnessEnabled ?? false,
        internalNotes: req.body.internalNotes || "",
        createdAt: now, updatedAt: now,
      });
      await storage.addAgreementActivity({ agreementId: agr.id, companyId: user.companyId, eventType: "created", eventData: "{}", createdAt: now });
      res.json(agr);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/agreements/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const agr = await storage.getAgreement(req.params.id);
      if (!agr || agr.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      if (agr.status === "signed" || agr.status === "completed") return res.status(400).json({ message: "Cannot edit a signed agreement." });
      const updated = await storage.updateAgreement(req.params.id, { ...req.body, updatedAt: new Date().toISOString() });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/agreements/:id/send-email", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const agr = await storage.getAgreement(req.params.id);
      if (!agr || agr.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const business = await storage.getCompany(user.companyId);
      const businessName = business?.name || "Your Service Provider";
      const proto = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost:5000";
      const publicUrl = `${proto}://${host}/public/agreements/${agr.publicToken}`;
      const clientFirst = (agr.clientName || "").split(" ")[0] || "there";
      const emailHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a1a1a">Agreement Ready for Signature</h2>
          <p>Hi ${clientFirst},</p>
          <p>${businessName} has prepared an agreement for your review and signature. Please click the button below to view and sign it.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${publicUrl}" style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">View & Sign Agreement</a>
          </div>
          <p style="color:#666;font-size:14px">Or copy this link: ${publicUrl}</p>
          <p style="color:#666;font-size:12px;margin-top:32px">${businessName}</p>
        </div>`;
      const now = new Date().toISOString();
      try {
        const { sendProposalEmail } = await import("./mail");
        await sendProposalEmail({ to: agr.clientEmail, subject: req.body.subject || `Agreement for Your Review — ${businessName}`, message: emailHtml, sendCopyToSelf: true });
        await storage.updateAgreement(agr.id, { status: agr.status === "draft" ? "sent" : agr.status, sentAt: now, updatedAt: now });
        await storage.addAgreementActivity({ agreementId: agr.id, companyId: user.companyId, eventType: "sent_email", eventData: JSON.stringify({ to: agr.clientEmail }), createdAt: now });
        res.json({ success: true, publicUrl });
      } catch (mailErr: any) {
        await storage.updateAgreement(agr.id, { status: agr.status === "draft" ? "sent" : agr.status, sentAt: now, updatedAt: now });
        await storage.addAgreementActivity({ agreementId: agr.id, companyId: user.companyId, eventType: "sent_link", eventData: "{}", createdAt: now });
        res.json({ success: false, emailError: "Email could not be sent. Copy the link to share it manually.", publicUrl });
      }
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Agreement AI Text Improvement ──────────────────────────────────────
  app.post("/api/admin/agreements/improve-text", requireAuth, async (req, res) => {
    try {
      const { text, instruction } = req.body as { text: string; instruction: string };
      if (!text || !instruction) return res.status(400).json({ message: "text and instruction required" });
      const instructionMap: Record<string, string> = {
        improve: "Improve the clarity and professionalism of this text. Keep the same meaning and approximate length.",
        professional: "Rewrite this text in a formal, legally professional tone suitable for a B2B service contract.",
        expand: "Expand this text with more detail and context while keeping it professional.",
        shorten: "Shorten this text to its essential points while keeping the professional tone.",
        voice_clean: "Clean up this voice-to-text transcription for a service agreement. Fix grammar, capitalize properly, and make it professional.",
      };
      const systemPrompt = instructionMap[instruction] || instructionMap.improve;
      const { OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `You are a professional contract writer for cleaning service businesses. ${systemPrompt} Return only the improved text, no preamble or explanation.` },
          { role: "user", content: text },
        ],
        max_tokens: 600,
        temperature: 0.4,
      });
      const result = completion.choices[0]?.message?.content?.trim() || text;
      res.json({ result });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Public Agreement Routes ─────────────────────────────────────────────
  app.get("/api/public/agreements/:token", async (req, res) => {
    try {
      const agr = await storage.getAgreementByToken(req.params.token);
      if (!agr) return res.status(404).json({ message: "Agreement not found" });
      const business = await storage.getCompany(agr.companyId);
      // Mark as viewed if first time
      if (!agr.viewedAt) {
        const now = new Date().toISOString();
        await storage.updateAgreement(agr.id, { viewedAt: now, status: agr.status === "sent" ? "viewed" : agr.status, updatedAt: now });
        await storage.addAgreementActivity({ agreementId: agr.id, companyId: agr.companyId, eventType: "viewed", eventData: "{}", createdAt: now });
      }
      res.json({ agreement: agr, business: { name: business?.name, logo: (business as any)?.logo } });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/agreements/:token/sign", async (req, res) => {
    try {
      const agr = await storage.getAgreementByToken(req.params.token);
      if (!agr) return res.status(404).json({ message: "Agreement not found" });
      if (agr.status === "signed" || agr.status === "completed") return res.status(400).json({ message: "This agreement has already been signed." });
      if (agr.status === "declined") return res.status(400).json({ message: "This agreement was declined." });
      const { signerName, signatureImage, witnessName, witnessContact, witnessSignature, agreed } = req.body;
      if (!agreed) return res.status(400).json({ message: "You must agree to the terms." });
      if (!signerName?.trim()) return res.status(400).json({ message: "Signer name is required." });
      if (!signatureImage) return res.status(400).json({ message: "Signature is required." });
      const now = new Date().toISOString();
      const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
      const updateData: any = {
        status: "signed", signedAt: now, signerName: signerName.trim(),
        signerIp: ip, signatureImage, updatedAt: now,
      };
      if (agr.witnessEnabled && witnessName) {
        updateData.witnessName = witnessName;
        updateData.witnessContact = witnessContact || "";
        updateData.witnessSignature = witnessSignature || "";
        updateData.witnessSignedAt = witnessSignature ? now : null;
      }
      await storage.updateAgreement(agr.id, updateData);
      await storage.addAgreementActivity({ agreementId: agr.id, companyId: agr.companyId, eventType: "signed", eventData: JSON.stringify({ signerName, ip }), createdAt: now });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Public Walkthrough Routes ──────────────────────────────────────────────
  // Create walkthrough (called when client starts recording)
  app.post("/api/public/walkthrough/start", async (req, res) => {
    try {
      const { companyId } = req.body;
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const now = new Date().toISOString();
      const walkthrough = await storage.createQuoteRequestWalkthrough({
        companyId, submissionId: null as any,
        aiStatus: "not_started", photoCount: 0,
        createdAt: now, updatedAt: now,
      });
      res.json({ walkthroughId: walkthrough.id });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Upload a photo to a walkthrough
  app.post("/api/public/walkthrough/:walkthroughId/photo", async (req, res) => {
    try {
      const { walkthroughId } = req.params;
      const walkthrough = await storage.getQuoteRequestWalkthrough(walkthroughId);
      if (!walkthrough) return res.status(404).json({ message: "Walkthrough not found" });
      const { fileUrl, orderIndex, timestampSeconds } = req.body;
      if (!fileUrl) return res.status(400).json({ message: "fileUrl required" });
      // Validate it's a data URL (security)
      if (!fileUrl.startsWith("data:image/")) return res.status(400).json({ message: "Invalid file type" });
      // Check limit
      const existing = await storage.getQuoteRequestWalkthroughPhotos(walkthroughId);
      if (existing.length >= 40) return res.status(400).json({ message: "Maximum 40 photos reached" });
      const now = new Date().toISOString();
      const photo = await storage.addQuoteRequestWalkthroughPhoto({
        walkthroughId, submissionId: walkthrough.submissionId,
        companyId: walkthrough.companyId,
        fileUrl, orderIndex: orderIndex ?? existing.length,
        capturedAt: now,
        timestampSeconds: timestampSeconds ?? null,
        createdAt: now,
      });
      // Update photoCount
      await storage.updateQuoteRequestWalkthrough(walkthroughId, {
        photoCount: existing.length + 1,
        updatedAt: now,
      });
      res.json({ photoId: photo.id, orderIndex: photo.orderIndex });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Remove a photo from a walkthrough
  app.delete("/api/public/walkthrough/:walkthroughId/photo/:photoId", async (req, res) => {
    try {
      const { walkthroughId, photoId } = req.params;
      const walkthrough = await storage.getQuoteRequestWalkthrough(walkthroughId);
      if (!walkthrough) return res.status(404).json({ message: "Not found" });
      await storage.deleteQuoteRequestWalkthroughPhoto(photoId);
      const remaining = await storage.getQuoteRequestWalkthroughPhotos(walkthroughId);
      const now = new Date().toISOString();
      await storage.updateQuoteRequestWalkthrough(walkthroughId, { photoCount: remaining.length, updatedAt: now });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Upload audio and finalize walkthrough
  app.post("/api/public/walkthrough/:walkthroughId/stop", async (req, res) => {
    try {
      const { walkthroughId } = req.params;
      const walkthrough = await storage.getQuoteRequestWalkthrough(walkthroughId);
      if (!walkthrough) return res.status(404).json({ message: "Not found" });
      const { audioUrl, durationSeconds, transcript } = req.body;
      const now = new Date().toISOString();
      const updated = await storage.updateQuoteRequestWalkthrough(walkthroughId, {
        audioUrl: audioUrl || null,
        durationSeconds: durationSeconds || null,
        transcript: transcript || null,
        updatedAt: now,
      });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Link walkthrough to submission after form submit
  app.post("/api/public/walkthrough/:walkthroughId/link", async (req, res) => {
    try {
      const { walkthroughId } = req.params;
      const { submissionId } = req.body;
      if (!submissionId) return res.status(400).json({ message: "submissionId required" });
      const walkthrough = await storage.getQuoteRequestWalkthrough(walkthroughId);
      if (!walkthrough) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      await storage.updateQuoteRequestWalkthrough(walkthroughId, { submissionId, updatedAt: now });
      // Also update all photos with submissionId
      const photos = await storage.getQuoteRequestWalkthroughPhotos(walkthroughId);
      for (const photo of photos) {
        await storage.updateQuoteRequestWalkthroughPhoto(photo.id, { submissionId });
      }
      // Trigger AI processing async
      processWalkthroughAI(walkthroughId, walkthrough.companyId, submissionId).catch(err =>
        console.error("[Walkthrough] AI processing error:", err.message)
      );
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Admin Walkthrough Routes ───────────────────────────────────────────────
  // Get walkthrough detail for a submission
  app.get("/api/admin/submissions/:id/walkthrough", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getQuoteFormSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const walkthrough = await storage.getQuoteRequestWalkthroughBySubmission(sub.id);
      if (!walkthrough) return res.json(null);
      const [photos, sections] = await Promise.all([
        storage.getQuoteRequestWalkthroughPhotos(walkthrough.id),
        storage.getQuoteRequestWalkthroughSections(walkthrough.id),
      ]);
      res.json({ ...walkthrough, photos, sections });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Reprocess AI for a walkthrough
  app.post("/api/admin/submissions/:id/walkthrough/process-ai", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getQuoteFormSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const walkthrough = await storage.getQuoteRequestWalkthroughBySubmission(sub.id);
      if (!walkthrough) return res.status(404).json({ message: "No walkthrough found" });
      processWalkthroughAI(walkthrough.id, user.companyId, sub.id).catch(() => {});
      res.json({ success: true, message: "AI processing started" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Edit walkthrough section
  app.patch("/api/admin/submissions/:id/walkthrough/sections/:sectionId", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getQuoteFormSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const { title, description, adminNotes } = req.body;
      const now = new Date().toISOString();
      const updated = await storage.updateQuoteRequestWalkthroughSection(req.params.sectionId, {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(adminNotes !== undefined && { adminNotes }),
        adminEdited: true,
        updatedAt: now,
      });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Edit walkthrough photo label
  app.patch("/api/admin/submissions/:id/walkthrough/photos/:photoId", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getQuoteFormSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const { adminLabel, adminDescription } = req.body;
      const updated = await storage.updateQuoteRequestWalkthroughPhoto(req.params.photoId, {
        ...(adminLabel !== undefined && { adminLabel }),
        ...(adminDescription !== undefined && { adminDescription }),
      });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/agreements/:token/decline", async (req, res) => {
    try {
      const agr = await storage.getAgreementByToken(req.params.token);
      if (!agr) return res.status(404).json({ message: "Agreement not found" });
      if (agr.status === "signed" || agr.status === "completed") return res.status(400).json({ message: "Agreement already signed." });
      const now = new Date().toISOString();
      await storage.updateAgreement(agr.id, { status: "declined", declinedAt: now, updatedAt: now });
      await storage.addAgreementActivity({ agreementId: agr.id, companyId: agr.companyId, eventType: "declined", eventData: "{}", createdAt: now });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Walkthrough AI Processing ──────────────────────────────────────────────
  async function processWalkthroughAI(walkthroughId: string, companyId: string, submissionId: string) {
    try {
      await storage.updateQuoteRequestWalkthrough(walkthroughId, { aiStatus: "pending", updatedAt: new Date().toISOString() });
      const photos = await storage.getQuoteRequestWalkthroughPhotos(walkthroughId);
      const walkthrough = await storage.getQuoteRequestWalkthrough(walkthroughId);
      if (!walkthrough || photos.length === 0) {
        await storage.updateQuoteRequestWalkthrough(walkthroughId, { aiStatus: "completed", updatedAt: new Date().toISOString() });
        return;
      }
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const photoCount = photos.length;
      const transcript = walkthrough.transcript || "";
      const prompt = `You are analyzing a client walkthrough of a property for a cleaning service quote.
The client submitted ${photoCount} photos${walkthrough.durationSeconds ? ` and a ${Math.round(walkthrough.durationSeconds / 60)} minute voice note` : ""}.
${transcript ? `Voice note transcript: "${transcript}"` : ""}

Group the ${photoCount} photos into sections of up to 4 photos each.
For each section, create a descriptive title and short description based on what would typically be in that section of a home walkthrough.

Return ONLY valid JSON:
{
  "title": "Quick walkthrough title",
  "summary": "2-3 sentence overall summary of the property walkthrough",
  "sections": [
    {
      "title": "Section title (e.g. Main Kitchen Area)",
      "description": "Short description of what was shown in these photos",
      "photoStartIndex": 0,
      "photoEndIndex": 3,
      "suggestedAddons": ["addon1", "addon2"]
    }
  ]
}`;
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0].message.content || "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch {}
      const now = new Date().toISOString();
      await storage.updateQuoteRequestWalkthrough(walkthroughId, {
        aiTitle: parsed.title || "Client Walkthrough",
        aiSummary: parsed.summary || "",
        aiStatus: "completed",
        aiRaw: raw,
        updatedAt: now,
      });
      // Create sections based on AI groupings
      const aiSections: any[] = parsed.sections || [];
      if (aiSections.length === 0) {
        // Fallback: group every 4 photos automatically
        for (let i = 0; i < photoCount; i += 4) {
          const sectionPhotos = photos.slice(i, i + 4);
          const sectionNum = Math.floor(i / 4) + 1;
          await storage.createQuoteRequestWalkthroughSection({
            walkthroughId, submissionId, companyId,
            title: `Section ${sectionNum}`,
            description: "",
            orderIndex: sectionNum - 1,
            photoIds: JSON.stringify(sectionPhotos.map(p => p.id)),
            aiGenerated: true, adminEdited: false,
            createdAt: now, updatedAt: now,
          });
        }
      } else {
        for (let i = 0; i < aiSections.length; i++) {
          const section = aiSections[i];
          const start = section.photoStartIndex ?? (i * 4);
          const end = section.photoEndIndex ?? Math.min(start + 3, photoCount - 1);
          const sectionPhotos = photos.slice(start, end + 1);
          await storage.createQuoteRequestWalkthroughSection({
            walkthroughId, submissionId, companyId,
            title: section.title || `Section ${i + 1}`,
            description: section.description || "",
            orderIndex: i,
            photoIds: JSON.stringify(sectionPhotos.map(p => p.id)),
            aiGenerated: true, adminEdited: false,
            createdAt: now, updatedAt: now,
          });
        }
      }
    } catch (err: any) {
      console.error("[WalkthroughAI] Error:", err.message);
      await storage.updateQuoteRequestWalkthrough(walkthroughId, { aiStatus: "failed", updatedAt: new Date().toISOString() });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Scheduled Field Notes ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // ── Admin: Templates ──────────────────────────────────────────────────────
  app.get("/api/admin/scheduled-field-notes/templates", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const templates = await storage.getScheduledFieldNoteTemplates(user.companyId);
      // For each template, get step count
      const withCounts = await Promise.all(templates.map(async t => {
        const [sections, steps] = await Promise.all([
          storage.getScheduledFieldNoteSections(t.id),
          storage.getScheduledFieldNoteSteps(t.id),
        ]);
        const assignments = await storage.getScheduledFieldNoteAssignmentsByTemplate(t.id);
        return { ...t, sectionCount: sections.length, stepCount: steps.length, assignmentCount: assignments.filter(a => a.status === "active").length };
      }));
      res.json(withCounts);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/scheduled-field-notes/templates", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const now = new Date().toISOString();
      const template = await storage.createScheduledFieldNoteTemplate({
        companyId: user.companyId, clientId: req.body.clientId || null,
        name: req.body.name || "Untitled Checklist", description: req.body.description || "",
        templateType: req.body.templateType || "commercial",
        frequency: req.body.frequency || "daily", requiredBeforeClockOut: req.body.requiredBeforeClockOut ?? true,
        introText: req.body.introText || "", outroText: req.body.outroText || "",
        status: "active", createdAt: now, updatedAt: now,
      });
      res.json(template);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/scheduled-field-notes/templates/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const template = await storage.getScheduledFieldNoteTemplate(req.params.id);
      if (!template || template.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const [sections, assignments] = await Promise.all([
        storage.getScheduledFieldNoteSections(template.id),
        storage.getScheduledFieldNoteAssignmentsByTemplate(template.id),
      ]);
      // Fetch steps per section directly (most reliable — avoids templateId mismatch issues)
      const sectionsWithSteps = await Promise.all(sections.map(async s => ({
        ...s, steps: await storage.getScheduledFieldNoteStepsBySection(s.id),
      })));
      res.json({ ...template, sections: sectionsWithSteps, assignments });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/scheduled-field-notes/templates/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const template = await storage.getScheduledFieldNoteTemplate(req.params.id);
      if (!template || template.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateScheduledFieldNoteTemplate(req.params.id, { ...req.body, updatedAt: new Date().toISOString() });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/admin/scheduled-field-notes/templates/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const template = await storage.getScheduledFieldNoteTemplate(req.params.id);
      if (!template || template.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.deleteScheduledFieldNoteTemplate(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/scheduled-field-notes/templates/:id/duplicate", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const template = await storage.getScheduledFieldNoteTemplate(req.params.id);
      if (!template || template.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      const newTemplate = await storage.createScheduledFieldNoteTemplate({
        companyId: user.companyId, clientId: template.clientId,
        name: `${template.name} (Copy)`, description: template.description,
        templateType: (template as any).templateType || "commercial",
        frequency: template.frequency, requiredBeforeClockOut: template.requiredBeforeClockOut,
        introText: template.introText, outroText: template.outroText,
        status: "inactive", createdAt: now, updatedAt: now,
      });
      // Duplicate sections and steps
      const sections = await storage.getScheduledFieldNoteSections(template.id);
      for (const section of sections) {
        const newSection = await storage.createScheduledFieldNoteSection({
          templateId: newTemplate.id, companyId: user.companyId,
          title: section.title, description: section.description,
          sortOrder: section.sortOrder, createdAt: now,
        });
        const steps = await storage.getScheduledFieldNoteStepsBySection(section.id);
        for (const step of steps) {
          await storage.createScheduledFieldNoteStep({
            templateId: newTemplate.id, sectionId: newSection.id, companyId: user.companyId,
            title: step.title, description: step.description,
            areaCategory: (step as any).areaCategory || null,
            areaName: (step as any).areaName || null,
            itemType: (step as any).itemType || null,
            customAreaName: (step as any).customAreaName || null,
            customItemType: (step as any).customItemType || null,
            referenceImageUrl: step.referenceImageUrl,
            isRequired: step.isRequired, sortOrder: step.sortOrder, createdAt: now,
          });
        }
      }
      res.json({ id: newTemplate.id, name: newTemplate.name });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Admin: Sections ───────────────────────────────────────────────────────
  app.post("/api/admin/scheduled-field-notes/templates/:id/sections", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const template = await storage.getScheduledFieldNoteTemplate(req.params.id);
      if (!template || template.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = new Date().toISOString();
      const existingSections = await storage.getScheduledFieldNoteSections(template.id);
      const section = await storage.createScheduledFieldNoteSection({
        templateId: template.id, companyId: user.companyId,
        title: req.body.title || "New Section", description: req.body.description || "",
        sortOrder: existingSections.length, createdAt: now,
      });
      res.json(section);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/scheduled-field-notes/sections/:id", requireRole("admin"), async (req, res) => {
    try {
      const updated = await storage.updateScheduledFieldNoteSection(req.params.id, req.body);
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/admin/scheduled-field-notes/sections/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteScheduledFieldNoteSection(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Admin: Steps ──────────────────────────────────────────────────────────
  app.post("/api/admin/scheduled-field-notes/sections/:sectionId/steps", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const now = new Date().toISOString();
      const existingSteps = await storage.getScheduledFieldNoteStepsBySection(req.params.sectionId);
      const step = await storage.createScheduledFieldNoteStep({
        templateId: req.body.templateId, sectionId: req.params.sectionId, companyId: user.companyId,
        title: req.body.title || "Take a photo", description: req.body.description || "",
        areaCategory: req.body.areaCategory || null,
        areaName: req.body.areaName || null,
        itemType: req.body.itemType || null,
        customAreaName: req.body.customAreaName || null,
        customItemType: req.body.customItemType || null,
        referenceImageUrl: req.body.referenceImageUrl || null,
        isRequired: req.body.isRequired ?? true,
        sortOrder: req.body.sortOrder ?? existingSteps.length, createdAt: now,
      });
      res.json(step);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/scheduled-field-notes/steps/:id", requireRole("admin"), async (req, res) => {
    try {
      const updated = await storage.updateScheduledFieldNoteStep(req.params.id, req.body);
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/admin/scheduled-field-notes/steps/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteScheduledFieldNoteStep(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Admin: Assignments ────────────────────────────────────────────────────
  app.get("/api/admin/scheduled-field-notes/assignments", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const assignments = await storage.getScheduledFieldNoteAssignments(user.companyId);
      const templates = await storage.getScheduledFieldNoteTemplates(user.companyId);
      const templateMap = Object.fromEntries(templates.map(t => [t.id, t]));
      const employees = await storage.getEmployeesByCompany(user.companyId);
      const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
      const clients = await storage.getClientsByCompany(user.companyId);
      const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
      const allSchedules = await storage.getRecurringSchedulesByCompany(user.companyId);
      const scheduleMap = Object.fromEntries(allSchedules.map(s => [s.id, s]));
      res.json(assignments.map(a => ({
        ...a,
        templateName: templateMap[a.templateId]?.name || "Unknown",
        cleanerName: employeeMap[a.cleanerId] ? `${employeeMap[a.cleanerId].firstName} ${employeeMap[a.cleanerId].lastName}` : "Unknown",
        clientName: a.clientId ? (clientMap[a.clientId]?.name || "Unknown") : null,
        scheduleSummary: a.scheduleId ? (() => {
          const s = scheduleMap[a.scheduleId];
          if (!s) return null;
          const days = (s.repeatDays || []).join(", ");
          return `${s.shiftLabel || days} ${s.scheduledStartTime}–${s.scheduledEndTime}`;
        })() : null,
      })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/scheduled-field-notes/assignments", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const assignment = await storage.createScheduledFieldNoteAssignment({
        templateId: req.body.templateId, companyId: user.companyId,
        cleanerId: req.body.cleanerId, clientId: req.body.clientId || null,
        scheduleId: req.body.scheduleId || null,
        status: "active", createdAt: new Date().toISOString(),
      });
      res.json(assignment);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/scheduled-field-notes/assignments/:id", requireRole("admin"), async (req, res) => {
    try {
      const updated = await storage.updateScheduledFieldNoteAssignment(req.params.id, req.body);
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/admin/scheduled-field-notes/assignments/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteScheduledFieldNoteAssignment(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Admin: Submissions ────────────────────────────────────────────────────
  app.get("/api/admin/scheduled-field-notes/submissions", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const submissions = await storage.getScheduledFieldNoteSubmissions(user.companyId);
      const templates = await storage.getScheduledFieldNoteTemplates(user.companyId);
      const templateMap = Object.fromEntries(templates.map(t => [t.id, t]));
      const employees = await storage.getEmployeesByCompany(user.companyId);
      const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
      const clients = await storage.getClientsByCompany(user.companyId);
      const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
      res.json(submissions.map(s => ({
        ...s,
        templateName: templateMap[s.templateId]?.name || "Unknown",
        cleanerName: employeeMap[s.cleanerId] ? `${employeeMap[s.cleanerId].firstName} ${employeeMap[s.cleanerId].lastName}` : "Unknown",
        clientName: s.clientId ? (clientMap[s.clientId]?.name || "Unknown") : null,
      })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/scheduled-field-notes/submissions/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getScheduledFieldNoteSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const [template, stepSubs] = await Promise.all([
        storage.getScheduledFieldNoteTemplate(sub.templateId),
        storage.getScheduledFieldNoteStepSubmissions(sub.id),
      ]);
      let sections: any[] = [], steps: any[] = [];
      if (template) {
        [sections, steps] = await Promise.all([
          storage.getScheduledFieldNoteSections(template.id),
          storage.getScheduledFieldNoteSteps(template.id),
        ]);
      }
      const employees = await storage.getEmployeesByCompany(user.companyId);
      const cleaner = employees.find(e => e.id === sub.cleanerId);
      const clients = await storage.getClientsByCompany(user.companyId);
      const client = clients.find(c => c.id === sub.clientId);
      const sectionsWithSteps = sections.map(s => ({
        ...s,
        steps: steps.filter(st => st.sectionId === s.id).map(st => ({
          ...st,
          submission: stepSubs.find(ss => ss.stepId === st.id) || null,
        })),
      }));
      res.json({ ...sub, template, sections: sectionsWithSteps, stepSubmissions: stepSubs, cleanerName: cleaner ? `${cleaner.firstName} ${cleaner.lastName}` : "Unknown", clientName: client?.name || null });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/scheduled-field-notes/submissions/:id/generate-link", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getScheduledFieldNoteSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      let publicId = sub.publicId;
      if (!publicId) {
        publicId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        await storage.updateScheduledFieldNoteSubmission(sub.id, { publicId, publicEnabled: true, updatedAt: new Date().toISOString() });
      } else {
        await storage.updateScheduledFieldNoteSubmission(sub.id, { publicEnabled: true, updatedAt: new Date().toISOString() });
      }
      res.json({ publicId, url: `/public/scheduled-field-notes/${publicId}` });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/scheduled-field-notes/submissions/:id/disable-link", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getScheduledFieldNoteSubmission(req.params.id);
      if (!sub || sub.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.updateScheduledFieldNoteSubmission(sub.id, { publicEnabled: false, updatedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Employee: Scheduled Field Notes ──────────────────────────────────────
  app.get("/api/employee/scheduled-field-notes/today", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      // user.id IS the cleaner/employee ID in this system
      const assignments = await storage.getScheduledFieldNoteAssignmentsByCleaner(user.id);
      if (assignments.length === 0) return res.json([]);
      const today = new Date().toISOString().split("T")[0];
      const result = [];
      for (const assignment of assignments) {
        const template = await storage.getScheduledFieldNoteTemplate(assignment.templateId);
        if (!template || template.status !== "active") continue;
        // Get or check today's submission
        const existing = await storage.getScheduledFieldNoteSubmissionByAssignmentAndDate(assignment.id, today);
        const steps = await storage.getScheduledFieldNoteSteps(template.id);
        const clients = await storage.getClientsByCompany(template.companyId);
        const client = clients.find(c => c.id === (assignment.clientId || template.clientId));
        result.push({
          assignment,
          template: { ...template, stepCount: steps.length, requiredStepCount: steps.filter(s => s.isRequired).length },
          submission: existing || null,
          clientName: client?.name || null,
          today,
        });
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/employee/scheduled-field-notes/start", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { assignmentId } = req.body;
      const myAssignments = await storage.getScheduledFieldNoteAssignmentsByCleaner(user.id);
      const found = myAssignments.find(a => a.id === assignmentId);
      if (!found) return res.status(403).json({ message: "Not your assignment" });
      const template = await storage.getScheduledFieldNoteTemplate(found.templateId);
      if (!template) return res.status(404).json({ message: "Template not found" });
      const today = new Date().toISOString().split("T")[0];
      // Check if submission already exists
      const existing = await storage.getScheduledFieldNoteSubmissionByAssignmentAndDate(assignmentId, today);
      if (existing) return res.json(existing);
      // Get active clock entry
      const clockEntry = await storage.getActiveTimeEntry(user.id);
      const steps = await storage.getScheduledFieldNoteSteps(template.id);
      const requiredSteps = steps.filter(s => s.isRequired);
      const now = new Date().toISOString();
      const submission = await storage.createScheduledFieldNoteSubmission({
        templateId: template.id, assignmentId, companyId: user.companyId,
        clientId: found.clientId || template.clientId,
        cleanerId: user.id, clockInId: clockEntry?.id || null,
        submissionDate: today, status: "in_progress",
        startedAt: now, completedAt: null,
        totalSteps: requiredSteps.length, completedSteps: 0,
        publicId: null, publicEnabled: false,
        createdAt: now, updatedAt: now,
      });
      res.json(submission);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/employee/scheduled-field-notes/submissions/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getScheduledFieldNoteSubmission(req.params.id);
      if (!sub || sub.cleanerId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const [template, stepSubs] = await Promise.all([
        storage.getScheduledFieldNoteTemplate(sub.templateId),
        storage.getScheduledFieldNoteStepSubmissions(sub.id),
      ]);
      let sections: any[] = [];
      if (template) {
        sections = await storage.getScheduledFieldNoteSections(template.id);
      }
      // Query steps per-section (avoids templateId mismatch issues)
      const sectionsWithSteps = await Promise.all(sections.map(async s => ({
        ...s,
        steps: (await storage.getScheduledFieldNoteStepsBySection(s.id)).map(st => ({
          ...st,
          submission: stepSubs.find(ss => ss.stepId === st.id) || null,
        })),
      })));
      res.json({ ...sub, template, sections: sectionsWithSteps });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/employee/scheduled-field-notes/submissions/:id/steps/:stepId", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getScheduledFieldNoteSubmission(req.params.id);
      if (!sub || sub.cleanerId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (sub.status === "completed") return res.status(400).json({ message: "Submission already completed" });
      const { imageUrl } = req.body;
      if (!imageUrl || !imageUrl.startsWith("data:image/")) return res.status(400).json({ message: "Invalid image" });
      const now = new Date().toISOString();
      // Check if already submitted — allow retake
      const existing = await storage.getScheduledFieldNoteStepSubmissionByStep(sub.id, req.params.stepId);
      let stepSub: any;
      if (existing) {
        stepSub = await storage.updateScheduledFieldNoteStepSubmission(existing.id, { submittedImageUrl: imageUrl, submittedAt: now });
      } else {
        // Look up step directly by ID — avoids templateId mismatch issues
        const stepInfo = await storage.getScheduledFieldNoteStepById(req.params.stepId);
        stepSub = await storage.createScheduledFieldNoteStepSubmission({
          submissionId: sub.id, templateId: sub.templateId,
          sectionId: stepInfo?.sectionId || "", stepId: req.params.stepId,
          companyId: sub.companyId, cleanerId: user.id,
          submittedImageUrl: imageUrl, submittedAt: now, createdAt: now,
        });
        // Update completed steps count (only for required steps, and only on first submission)
        const sections = await storage.getScheduledFieldNoteSections(sub.templateId);
        const allStepsNested = await Promise.all(sections.map(s => storage.getScheduledFieldNoteStepsBySection(s.id)));
        const allSteps = allStepsNested.flat();
        const allStepSubs = await storage.getScheduledFieldNoteStepSubmissions(sub.id);
        const completedRequiredCount = allStepSubs.filter(ss => {
          const s = allSteps.find(st => st.id === ss.stepId);
          return s?.isRequired;
        }).length + (stepInfo?.isRequired ? 1 : 0);
        await storage.updateScheduledFieldNoteSubmission(sub.id, {
          completedSteps: completedRequiredCount, updatedAt: now,
        });
      }
      // Re-fetch submission for updated counts
      const updated = await storage.getScheduledFieldNoteSubmission(sub.id);
      res.json({ stepSubmission: stepSub, submission: updated });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/employee/scheduled-field-notes/submissions/:id/complete", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getScheduledFieldNoteSubmission(req.params.id);
      if (!sub || sub.cleanerId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const now = new Date().toISOString();
      // Use section-based step query to avoid templateId mismatch issues
      const sections = await storage.getScheduledFieldNoteSections(sub.templateId);
      const allStepsNested = await Promise.all(sections.map(s => storage.getScheduledFieldNoteStepsBySection(s.id)));
      const allSteps = allStepsNested.flat();
      const requiredSteps = allSteps.filter(s => s.isRequired);
      const stepSubs = await storage.getScheduledFieldNoteStepSubmissions(sub.id);
      const completedRequiredIds = stepSubs.map(ss => ss.stepId).filter(id => requiredSteps.some(s => s.id === id));
      if (completedRequiredIds.length < requiredSteps.length) {
        return res.status(400).json({
          message: "Not all required steps are complete",
          missing: requiredSteps.length - completedRequiredIds.length,
        });
      }
      const updated = await storage.updateScheduledFieldNoteSubmission(sub.id, {
        status: "completed", completedAt: now, completedSteps: requiredSteps.length, updatedAt: now,
      });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Clock-out check: are there any incomplete required scheduled field notes today?
  app.get("/api/employee/scheduled-field-notes/clock-out-check", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const assignments = await storage.getScheduledFieldNoteAssignmentsByCleaner(user.id);
      const today = new Date().toISOString().split("T")[0];
      const incomplete = [];
      for (const assignment of assignments) {
        const template = await storage.getScheduledFieldNoteTemplate(assignment.templateId);
        if (!template || template.status !== "active" || !template.requiredBeforeClockOut) continue;
        const submission = await storage.getScheduledFieldNoteSubmissionByAssignmentAndDate(assignment.id, today);
        if (!submission || submission.status !== "completed") {
          incomplete.push({ assignmentId: assignment.id, templateName: template.name, submissionId: submission?.id || null });
        }
      }
      res.json({ hasIncomplete: incomplete.length > 0, count: incomplete.length, items: incomplete });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Public: Scheduled Field Note Report ──────────────────────────────────
  app.get("/api/public/scheduled-field-notes/:publicId", async (req, res) => {
    try {
      const sub = await storage.getScheduledFieldNoteSubmissionByPublicId(req.params.publicId);
      if (!sub || !sub.publicEnabled) return res.status(404).json({ message: "Report not found or not public" });
      const [template, stepSubs] = await Promise.all([
        storage.getScheduledFieldNoteTemplate(sub.templateId),
        storage.getScheduledFieldNoteStepSubmissions(sub.id),
      ]);
      let sections: any[] = [], steps: any[] = [];
      if (template) {
        [sections, steps] = await Promise.all([
          storage.getScheduledFieldNoteSections(template.id),
          storage.getScheduledFieldNoteSteps(template.id),
        ]);
      }
      const company = await storage.getCompany(sub.companyId);
      const employees = await storage.getEmployeesByCompany(sub.companyId);
      const cleaner = employees.find(e => e.id === sub.cleanerId);
      const clients = await storage.getClientsByCompany(sub.companyId);
      const client = clients.find(c => c.id === sub.clientId);
      const sectionsWithSteps = sections.map(s => ({
        id: s.id, title: s.title, sortOrder: s.sortOrder,
        steps: steps.filter(st => st.sectionId === s.id).map(st => ({
          id: st.id, title: st.title, description: st.description,
          referenceImageUrl: st.referenceImageUrl || null,
          isRequired: st.isRequired, sortOrder: st.sortOrder,
          submission: stepSubs.find(ss => ss.stepId === st.id) || null,
        })),
      }));
      res.json({
        companyName: company?.name || "Unknown Company",
        companyLogo: company?.logoUrl || null,
        templateName: template?.name || "Scheduled Field Note",
        introText: template?.introText || "",
        outroText: template?.outroText || "",
        clientName: client?.name || null,
        cleanerName: cleaner ? `${cleaner.firstName} ${cleaner.lastName}` : null,
        submissionDate: sub.submissionDate,
        status: sub.status,
        startedAt: sub.startedAt,
        completedAt: sub.completedAt,
        totalSteps: sub.totalSteps,
        completedSteps: sub.completedSteps,
        sections: sectionsWithSteps,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Hiring Package (Publications tab) ─────────────────────────────────────
  const hpUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
  const hpNow = () => new Date().toISOString();

  // Ensure company has a default template, create one if not
  const ensureHPTemplate = async (companyId: string) => {
    let tpl = await storage.getHPDefaultTemplate(companyId);
    if (!tpl) {
      tpl = await storage.createHPTemplate({
        companyId,
        name: "Default Template",
        policies: [],
        bootReimbursementAmount: "60.00",
        requireDateOfBirth: false,
        isDefault: true,
        createdAt: hpNow(),
        updatedAt: hpNow(),
      } as any);
    }
    return tpl;
  };

  // GET /api/hiring-package/template — get or create default template
  app.get("/api/hiring-package/template", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      const tpl = await ensureHPTemplate(companyId);
      res.json(tpl);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/hiring-package/template/:id
  app.patch("/api/hiring-package/template/:id", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getHPTemplate(id);
      if (!existing || existing.companyId !== req.user.companyId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateHPTemplate(id, { ...req.body, updatedAt: hpNow() });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/hiring-package/packages
  app.get("/api/hiring-package/packages", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const pkgs = await storage.getHPPackagesByCompany(req.user.companyId);
      res.json(pkgs);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/hiring-package/packages — create package
  app.post("/api/hiring-package/packages", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { employeeName, employeeEmail, position } = req.body;
      if (!employeeName || !employeeEmail) return res.status(400).json({ message: "employeeName and employeeEmail are required" });
      const tpl = await ensureHPTemplate(req.user.companyId);
      const token = randomBytes(32).toString("hex");
      const now = hpNow();
      const pkg = await storage.createHPPackage({
        companyId: req.user.companyId,
        templateId: tpl.id,
        employeeName,
        employeeEmail,
        position: position ?? "",
        publicToken: token,
        status: "draft",
        sentAt: null,
        expiresAt: null,
        createdBy: req.user.id,
        createdAt: now,
        updatedAt: now,
      } as any);
      res.status(201).json(pkg);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/hiring-package/packages/:id/send — send email
  app.post("/api/hiring-package/packages/:id/send", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const pkg = await storage.getHPPackage(req.params.id);
      if (!pkg || pkg.companyId !== req.user.companyId) return res.status(404).json({ message: "Not found" });
      const company = await storage.getCompany(req.user.companyId);
      const publicLink = `${req.protocol}://${req.get("host")}/public/hiring-package/${pkg.publicToken}`;
      await sendHiringPackageEmail({
        to: pkg.employeeEmail,
        employeeName: pkg.employeeName,
        companyName: company?.name ?? "Your Employer",
        publicLink,
      });
      const updated = await storage.updateHPPackage(pkg.id, { status: "sent", sentAt: hpNow(), updatedAt: hpNow() });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/hiring-package/packages/:id
  app.delete("/api/hiring-package/packages/:id", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const pkg = await storage.getHPPackage(req.params.id);
      if (!pkg || pkg.companyId !== req.user.companyId) return res.status(404).json({ message: "Not found" });
      // delete submission if any
      const sub = await storage.getHPSubmissionByPackage(pkg.id);
      if (sub) {
        // delete documents
        const docs = await storage.getHPDocuments(sub.id);
        for (const doc of docs) {
          await storage.deleteHPDocument(sub.id, doc.documentType);
        }
      }
      await storage.deleteHPPackage(pkg.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/hiring-package/submissions
  app.get("/api/hiring-package/submissions", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const subs = await storage.getHPSubmissionsByCompany(req.user.companyId);
      res.json(subs);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/hiring-package/submissions/:id
  app.get("/api/hiring-package/submissions/:id", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const sub = await storage.getHPSubmission(req.params.id);
      if (!sub || sub.companyId !== req.user.companyId) return res.status(404).json({ message: "Not found" });
      const policyAcceptances = await storage.getHPPolicyAcceptances(sub.id);
      const documents = await storage.getHPDocuments(sub.id);
      res.json({ submission: sub, policyAcceptances, documents });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/hiring-package/submissions/:id — admin review
  app.patch("/api/hiring-package/submissions/:id", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const sub = await storage.getHPSubmission(req.params.id);
      if (!sub || sub.companyId !== req.user.companyId) return res.status(404).json({ message: "Not found" });
      const allowed = ["reviewStatus", "adminNotes", "missingDocsMessage", "requestedMissingDocs"];
      const data: any = { updatedAt: hpNow() };
      for (const k of allowed) { if (req.body[k] !== undefined) data[k] = req.body[k]; }
      const updated = await storage.updateHPSubmission(sub.id, data);
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/hiring-package/packages/:id/detail — package + submission + template
  app.get("/api/hiring-package/packages/:id/detail", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const pkg = await storage.getHPPackage(req.params.id);
      if (!pkg || pkg.companyId !== req.user.companyId) return res.status(404).json({ message: "Not found" });
      const sub = await storage.getHPSubmissionByPackage(pkg.id);
      const tpl = await storage.getHPTemplate(pkg.templateId);
      const policyAcceptances = sub ? await storage.getHPPolicyAcceptances(sub.id) : [];
      const documents = sub ? await storage.getHPDocuments(sub.id) : [];
      res.json({ package: pkg, submission: sub ?? null, template: tpl ?? null, policyAcceptances, documents });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Public HP routes (no auth) ──────────────────────────────────────────────

  // GET /api/public/hiring-package/:token
  app.get("/api/public/hiring-package/:token", async (req, res) => {
    try {
      const pkg = await storage.getHPPackageByToken(req.params.token);
      if (!pkg) return res.status(404).json({ message: "Package not found" });
      const tpl = await storage.getHPTemplate(pkg.templateId);
      let sub = await storage.getHPSubmissionByPackage(pkg.id);
      if (!sub) {
        // auto-create submission on first visit
        const now = hpNow();
        sub = await storage.createHPSubmission({
          companyId: pkg.companyId,
          packageId: pkg.id,
          publicToken: pkg.publicToken,
          currentStep: 1,
          status: "started",
          createdAt: now,
          updatedAt: now,
        } as any);
        // mark package as started
        if (pkg.status === "sent" || pkg.status === "draft") {
          await storage.updateHPPackage(pkg.id, { status: "sent", updatedAt: now });
        }
      }
      const policyAcceptances = await storage.getHPPolicyAcceptances(sub.id);
      const documents = await storage.getHPDocuments(sub.id);
      const company = await storage.getCompany(pkg.companyId);
      const safeDocuments = documents.map(d => ({
        id: d.id, documentType: d.documentType, originalName: d.originalName,
        fileSize: d.fileSize, uploadedAt: d.uploadedAt,
      }));
      res.json({
        package: { id: pkg.id, employeeName: pkg.employeeName, employeeEmail: pkg.employeeEmail, position: pkg.position, status: pkg.status, sentAt: pkg.sentAt },
        submission: { id: sub.id, currentStep: sub.currentStep, status: sub.status, personalInfoJson: sub.personalInfoJson, emergencyContactsJson: sub.emergencyContactsJson, medicalInfoJson: sub.medicalInfoJson, finalAcknowledgement: sub.finalAcknowledgement, signatureData: sub.signatureData, submittedAt: sub.submittedAt, lastSavedAt: sub.lastSavedAt, requestedMissingDocs: sub.requestedMissingDocs },
        template: tpl ? { id: tpl.id, name: tpl.name, policies: tpl.policies, bootReimbursementAmount: tpl.bootReimbursementAmount, requireDateOfBirth: tpl.requireDateOfBirth } : null,
        policyAcceptances,
        documents: safeDocuments,
        companyName: company?.name ?? "Your Employer",
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/public/hiring-package/:token/personal-info
  app.patch("/api/public/hiring-package/:token/personal-info", async (req, res) => {
    try {
      const pkg = await storage.getHPPackageByToken(req.params.token);
      if (!pkg) return res.status(404).json({ message: "Not found" });
      const sub = await storage.getHPSubmissionByPackage(pkg.id);
      if (!sub) return res.status(404).json({ message: "Submission not found" });
      if (sub.status === "submitted") return res.status(400).json({ message: "Already submitted" });
      const now = hpNow();
      const updated = await storage.updateHPSubmission(sub.id, { personalInfoJson: req.body.personalInfoJson, currentStep: Math.max(sub.currentStep ?? 1, 2), lastSavedAt: now, updatedAt: now });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/public/hiring-package/:token/emergency-contacts
  app.patch("/api/public/hiring-package/:token/emergency-contacts", async (req, res) => {
    try {
      const pkg = await storage.getHPPackageByToken(req.params.token);
      if (!pkg) return res.status(404).json({ message: "Not found" });
      const sub = await storage.getHPSubmissionByPackage(pkg.id);
      if (!sub) return res.status(404).json({ message: "Submission not found" });
      if (sub.status === "submitted") return res.status(400).json({ message: "Already submitted" });
      const now = hpNow();
      const updated = await storage.updateHPSubmission(sub.id, { emergencyContactsJson: req.body.emergencyContactsJson, currentStep: Math.max(sub.currentStep ?? 1, 3), lastSavedAt: now, updatedAt: now });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/public/hiring-package/:token/medical-info
  app.patch("/api/public/hiring-package/:token/medical-info", async (req, res) => {
    try {
      const pkg = await storage.getHPPackageByToken(req.params.token);
      if (!pkg) return res.status(404).json({ message: "Not found" });
      const sub = await storage.getHPSubmissionByPackage(pkg.id);
      if (!sub) return res.status(404).json({ message: "Submission not found" });
      if (sub.status === "submitted") return res.status(400).json({ message: "Already submitted" });
      const now = hpNow();
      const updated = await storage.updateHPSubmission(sub.id, { medicalInfoJson: req.body.medicalInfoJson, currentStep: Math.max(sub.currentStep ?? 1, 4), lastSavedAt: now, updatedAt: now });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/public/hiring-package/:token/policy-accept
  app.post("/api/public/hiring-package/:token/policy-accept", async (req, res) => {
    try {
      const pkg = await storage.getHPPackageByToken(req.params.token);
      if (!pkg) return res.status(404).json({ message: "Not found" });
      const sub = await storage.getHPSubmissionByPackage(pkg.id);
      if (!sub) return res.status(404).json({ message: "Submission not found" });
      if (sub.status === "submitted") return res.status(400).json({ message: "Already submitted" });
      const { policyId, policyTitle, policyContentSnapshot } = req.body;
      const now = hpNow();
      const acceptance = await storage.createHPPolicyAcceptance({
        companyId: pkg.companyId,
        submissionId: sub.id,
        policyId,
        policyTitle,
        policyVersion: "1.0",
        policyContentSnapshot,
        acceptedAt: now,
        ipAddress: req.ip ?? "",
        userAgent: req.headers["user-agent"] ?? "",
        createdAt: now,
      } as any);
      await storage.updateHPSubmission(sub.id, { currentStep: Math.max(sub.currentStep ?? 1, 5), lastSavedAt: now, updatedAt: now });
      res.json(acceptance);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/public/hiring-package/:token/documents — file upload
  app.post("/api/public/hiring-package/:token/documents", hpUpload.single("file"), async (req, res) => {
    try {
      const pkg = await storage.getHPPackageByToken(req.params.token);
      if (!pkg) return res.status(404).json({ message: "Not found" });
      const sub = await storage.getHPSubmissionByPackage(pkg.id);
      if (!sub) return res.status(404).json({ message: "Submission not found" });
      if (sub.status === "submitted") return res.status(400).json({ message: "Already submitted" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const { documentType } = req.body;
      if (!documentType) return res.status(400).json({ message: "documentType required" });
      const now = hpNow();
      const fileData = req.file.buffer.toString("base64");
      const doc = await storage.upsertHPDocument(sub.id, documentType, {
        companyId: pkg.companyId,
        submissionId: sub.id,
        documentType,
        originalName: req.file.originalname,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        fileData,
        required: true,
        uploadedAt: now,
        createdAt: now,
      } as any);
      await storage.updateHPSubmission(sub.id, { currentStep: Math.max(sub.currentStep ?? 1, 6), lastSavedAt: now, updatedAt: now });
      res.json({ id: doc.id, documentType: doc.documentType, originalName: doc.originalName, fileSize: doc.fileSize });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/public/hiring-package/:token/documents/:documentType
  app.delete("/api/public/hiring-package/:token/documents/:documentType", async (req, res) => {
    try {
      const pkg = await storage.getHPPackageByToken(req.params.token);
      if (!pkg) return res.status(404).json({ message: "Not found" });
      const sub = await storage.getHPSubmissionByPackage(pkg.id);
      if (!sub) return res.status(404).json({ message: "Submission not found" });
      if (sub.status === "submitted") return res.status(400).json({ message: "Already submitted" });
      await storage.deleteHPDocument(sub.id, req.params.documentType);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/public/hiring-package/:token/signature
  app.patch("/api/public/hiring-package/:token/signature", async (req, res) => {
    try {
      const pkg = await storage.getHPPackageByToken(req.params.token);
      if (!pkg) return res.status(404).json({ message: "Not found" });
      const sub = await storage.getHPSubmissionByPackage(pkg.id);
      if (!sub) return res.status(404).json({ message: "Submission not found" });
      if (sub.status === "submitted") return res.status(400).json({ message: "Already submitted" });
      const now = hpNow();
      const updated = await storage.updateHPSubmission(sub.id, {
        signatureData: req.body.signatureData,
        finalAcknowledgement: req.body.finalAcknowledgement,
        signatureUploadedAt: now,
        currentStep: Math.max(sub.currentStep ?? 1, 7),
        lastSavedAt: now,
        updatedAt: now,
      });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/public/hiring-package/:token/submit
  app.post("/api/public/hiring-package/:token/submit", async (req, res) => {
    try {
      const pkg = await storage.getHPPackageByToken(req.params.token);
      if (!pkg) return res.status(404).json({ message: "Not found" });
      const sub = await storage.getHPSubmissionByPackage(pkg.id);
      if (!sub) return res.status(404).json({ message: "Submission not found" });
      if (sub.status === "submitted") return res.status(400).json({ message: "Already submitted" });
      const now = hpNow();
      const updated = await storage.updateHPSubmission(sub.id, {
        status: "submitted",
        submittedAt: now,
        currentStep: 7,
        updatedAt: now,
      });
      await storage.updateHPPackage(pkg.id, { status: "submitted", updatedAt: now });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Training Hub API ──────────────────────────────────────────────────────

  function trainingNow() { return new Date().toISOString(); }
  function genCertCode() { return "CERT-" + Math.random().toString(36).substring(2, 10).toUpperCase(); }

  function scoreTrainingQuestion(q: { questionType: string; correctAnswerJson: string }, answer: any): boolean {
    if (answer === undefined || answer === null || answer === "") return false;
    let correct: any;
    try { correct = JSON.parse(q.correctAnswerJson); } catch { return false; }
    const norm = (v: any) => String(v ?? "").toLowerCase().trim();
    switch (q.questionType) {
      case "multiple_choice": return String(answer).trim() === String(correct).trim();
      case "true_false":      return norm(answer) === norm(correct);
      case "short_answer":    return norm(answer) === norm(correct);
      default: return false;
    }
  }

  // Idempotent cert issuance gated on (a) all required modules complete, (b) if quiz exists & required → must have passed.
  // Returns the cert summary if issued/already-issued and gates pass, otherwise null.
  async function tryIssueTrainingCertificate(opts: {
    courseId: string;
    companyId: string;
    employeeId?: string | null;
    publicLearnerId?: string | null;
    learnerName: string;
  }): Promise<{ certificateCode: string; issuedAt: string } | null> {
    const course = await storage.getTrainingCourse(opts.courseId);
    if (!course || !course.certificateEnabled) return null;

    const modules = await storage.getTrainingModules(opts.courseId);
    if (modules.length === 0) return null;
    const required = modules.filter(m => m.isRequired);
    const progress = await storage.getTrainingProgress(opts.courseId, opts.employeeId ?? undefined, opts.publicLearnerId ?? undefined);
    const completedIds = new Set(progress.map(p => p.moduleId));
    const moduleCheck = required.length > 0
      ? required.every(m => completedIds.has(m.id))
      : modules.every(m => completedIds.has(m.id));
    if (!moduleCheck) return null;

    const quiz = await storage.getTrainingQuizByCourse(opts.courseId);
    if (quiz && quiz.isRequired) {
      const passed = await storage.hasPassedTrainingQuiz(quiz.id, opts.employeeId ?? undefined, opts.publicLearnerId ?? undefined);
      if (!passed) return null;
    }

    const existing = await storage.getTrainingCertificate(opts.courseId, opts.employeeId ?? undefined, opts.publicLearnerId ?? undefined);
    if (existing) return { certificateCode: existing.certificateCode, issuedAt: existing.issuedAt };

    const now = trainingNow();
    const cert = await storage.createTrainingCertificate({
      courseId: opts.courseId,
      companyId: opts.companyId,
      employeeId: opts.employeeId ?? null,
      publicLearnerId: opts.publicLearnerId ?? null,
      learnerName: opts.learnerName,
      certificateCode: genCertCode(),
      issuedAt: now,
      createdAt: now,
    });
    await storage.updateTrainingCourse(opts.courseId, { updatedAt: now });
    return { certificateCode: cert.certificateCode, issuedAt: cert.issuedAt };
  }
  function genPublicId() { return Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12); }

  function parseYoutubeId(url: string): string | null {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
    return null;
  }

  // GET /api/training/stats
  app.get("/api/training/stats", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const stats = await storage.getTrainingStats(user.companyId);
      res.json(stats);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/training/courses
  app.get("/api/training/courses", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const courses = await storage.getTrainingCourses(user.companyId);
      res.json(courses);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/training/courses
  app.post("/api/training/courses", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const now = trainingNow();
      const publicId = req.body.publicLinkEnabled ? genPublicId() : null;
      const course = await storage.createTrainingCourse({
        ...req.body,
        companyId: user.companyId,
        createdBy: user.id,
        publicId,
        createdAt: now,
        updatedAt: now,
      });
      res.json(course);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/training/courses/:id
  app.get("/api/training/courses/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const course = await storage.getTrainingCourse(req.params.id);
      if (!course || course.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const modules = await storage.getTrainingModules(course.id);
      const assignments = await storage.getTrainingAssignments(course.id);
      const completions = await storage.getTrainingCompletions(course.id);
      const assigned = assignments.length;
      const completedEmployees = new Set(assignments.filter(a => {
        const empCompletions = completions.filter(c => c.employeeId === a.employeeId);
        return empCompletions.length >= modules.filter(m => m.isRequired).length && modules.filter(m => m.isRequired).length > 0;
      }).map(a => a.employeeId));
      const started = new Set(completions.filter(c => c.employeeId).map(c => c.employeeId)).size;
      const completed = completedEmployees.size;
      const completionPct = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

      // Enrich completions with actorName + moduleTitle for the activity pulse view
      const moduleMap = new Map(modules.map((m: any) => [m.id, m.title]));
      const empNameMap = new Map(assignments.map((a: any) => [a.employeeId, a.employeeName]));
      const publicLearnerIds = Array.from(new Set(completions.filter(c => c.publicLearnerId).map(c => c.publicLearnerId as string)));
      let publicNameMap = new Map<string, string>();
      if (publicLearnerIds.length > 0) {
        const publicRows = await db.select({ id: trainingPublicLearners.id, name: trainingPublicLearners.name })
          .from(trainingPublicLearners)
          .where(inArray(trainingPublicLearners.id, publicLearnerIds));
        publicNameMap = new Map(publicRows.map(r => [r.id, r.name]));
      }
      const completionsEnriched = completions.map(c => ({
        ...c,
        moduleTitle: moduleMap.get(c.moduleId) ?? "Unknown module",
        actorName: c.employeeId
          ? (empNameMap.get(c.employeeId) ?? "Unknown")
          : c.publicLearnerId
          ? (publicNameMap.get(c.publicLearnerId) ?? "Public learner")
          : "Unknown",
      }));

      res.json({ course, modules, assignments, completions: completionsEnriched, stats: { assigned, started, completed, completionPct } });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/training/courses/:id/public-learners — admin roster of public learners
  // Returns name / email / progress / quiz score / pass-fail / certificate /
  // last activity. Tenant-scoped via the company check on the parent course.
  app.get("/api/training/courses/:id/public-learners", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const course = await storage.getTrainingCourse(req.params.id);
      if (!course || course.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const learners = await storage.listPublicLearnersForCourse(course.id, user.companyId);
      res.json(learners);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/training/courses/:id
  app.patch("/api/training/courses/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const course = await storage.getTrainingCourse(req.params.id);
      if (!course || course.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const updateData: any = { ...req.body, updatedAt: trainingNow() };
      if (req.body.publicLinkEnabled && !course.publicId) updateData.publicId = genPublicId();
      const updated = await storage.updateTrainingCourse(req.params.id, updateData);
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/training/courses/:id
  app.delete("/api/training/courses/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const course = await storage.getTrainingCourse(req.params.id);
      if (!course || course.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.deleteTrainingCourse(req.params.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/training/courses/:id/modules
  app.post("/api/training/courses/:id/modules", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const course = await storage.getTrainingCourse(req.params.id);
      if (!course || course.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = trainingNow();
      const youtubeEmbedId = req.body.youtubeUrl ? parseYoutubeId(req.body.youtubeUrl) : null;
      const module = await storage.createTrainingModule({
        ...req.body,
        courseId: req.params.id,
        companyId: user.companyId,
        youtubeEmbedId,
        createdAt: now,
        updatedAt: now,
      });
      if (req.body.assets && Array.isArray(req.body.assets)) {
        for (let i = 0; i < req.body.assets.length; i++) {
          const a = req.body.assets[i];
          if (a.assetData) await storage.createTrainingModuleAsset({ moduleId: module.id, assetData: a.assetData, assetType: a.assetType ?? "image", sortOrder: i, createdAt: now });
        }
      }
      res.json(module);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/training/courses/:courseId/modules/:moduleId
  app.patch("/api/training/courses/:courseId/modules/:moduleId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const course = await storage.getTrainingCourse(req.params.courseId);
      if (!course || course.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const now = trainingNow();
      const youtubeEmbedId = req.body.youtubeUrl ? parseYoutubeId(req.body.youtubeUrl) : undefined;
      const updateData: any = { ...req.body, updatedAt: now };
      if (youtubeEmbedId !== undefined) updateData.youtubeEmbedId = youtubeEmbedId;
      delete updateData.assets;
      const updated = await storage.updateTrainingModule(req.params.moduleId, updateData);
      if (req.body.assets && Array.isArray(req.body.assets)) {
        await storage.deleteTrainingModuleAssets(req.params.moduleId);
        for (let i = 0; i < req.body.assets.length; i++) {
          const a = req.body.assets[i];
          if (a.assetData) await storage.createTrainingModuleAsset({ moduleId: req.params.moduleId, assetData: a.assetData, assetType: a.assetType ?? "image", sortOrder: i, createdAt: now });
        }
      }
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/training/courses/:courseId/modules/:moduleId
  app.delete("/api/training/courses/:courseId/modules/:moduleId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const course = await storage.getTrainingCourse(req.params.courseId);
      if (!course || course.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      await storage.deleteTrainingModule(req.params.moduleId);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/training/courses/:id/assign
  app.post("/api/training/courses/:id/assign", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const course = await storage.getTrainingCourse(req.params.id);
      if (!course || course.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const { employeeIds } = req.body;
      if (!Array.isArray(employeeIds)) return res.status(400).json({ message: "employeeIds required" });
      await storage.assignTrainingCourse(req.params.id, user.companyId, employeeIds, user.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/training/my-courses — employee
  app.get("/api/training/my-courses", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== "employee") return res.status(403).json({ message: "Forbidden" });
      const courses = await storage.getMyTrainingCourses(user.id, user.companyId);
      res.json(courses);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/training/my-courses/:courseId — employee course detail
  app.get("/api/training/my-courses/:courseId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== "employee") return res.status(403).json({ message: "Forbidden" });
      const detail = await storage.getMyTrainingCourse(req.params.courseId, user.id);
      if (!detail) return res.status(404).json({ message: "Not found" });
      res.json(detail);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/training/my-courses/:courseId/progress/:moduleId — employee mark complete
  app.post("/api/training/my-courses/:courseId/progress/:moduleId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== "employee") return res.status(403).json({ message: "Forbidden" });
      const course = await storage.getTrainingCourse(req.params.courseId);
      if (!course || course.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      // 15-second engagement gate: skip if module already completed (idempotent re-mark allowed).
      const existingProgress = await storage.getTrainingProgress(req.params.courseId, user.id, undefined);
      const alreadyCompleted = existingProgress.some(p => p.moduleId === req.params.moduleId);
      if (!alreadyCompleted) {
        const elapsed = Number((req.body as any)?.elapsedSeconds);
        if (!Number.isFinite(elapsed) || elapsed < 15) {
          return res.status(400).json({
            message: "Please spend at least 15 seconds reading or listening to this module before marking it complete.",
            code: "TIME_GATE",
            requiredSeconds: 15,
          });
        }
      }
      await storage.markModuleComplete(req.params.courseId, req.params.moduleId, user.companyId, user.id, undefined);
      const certificate = await tryIssueTrainingCertificate({
        courseId: req.params.courseId,
        companyId: user.companyId,
        employeeId: user.id,
        learnerName: `${user.firstName} ${user.lastName}`,
      });
      // Compute fresh module-completion state for the client (avoids cache races on the quiz unlock).
      const modules = await storage.getTrainingModules(req.params.courseId);
      const progress = await storage.getTrainingProgress(req.params.courseId, user.id, undefined);
      const completedIds = new Set(progress.map(p => p.moduleId));
      const required = modules.filter(m => m.isRequired);
      const modulesComplete = modules.length > 0 && (
        required.length > 0 ? required.every(m => completedIds.has(m.id)) : modules.every(m => completedIds.has(m.id))
      );
      res.json({
        ok: true,
        moduleId: req.params.moduleId,
        modulesComplete,
        completedModules: completedIds.size,
        totalModules: modules.length,
        certificate,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Public Training Routes ────────────────────────────────────────────────

  // GET /api/public/training/:publicId
  app.get("/api/public/training/:publicId", async (req, res) => {
    try {
      const course = await storage.getTrainingCourseByPublicId(req.params.publicId);
      if (!course || !course.publicLinkEnabled || !course.isPublished) return res.status(404).json({ message: "Course not found" });
      const company = await storage.getCompany(course.companyId);
      const modules = await storage.getTrainingModules(course.id);
      res.json({
        id: course.id,
        title: course.title,
        description: course.description,
        category: course.category,
        thumbnailData: course.thumbnailData,
        estimatedDuration: course.estimatedDuration,
        certificateEnabled: course.certificateEnabled,
        companyName: company?.name ?? "Company",
        modules: modules.map(m => ({
          id: m.id,
          title: m.title,
          description: m.description,
          youtubeEmbedId: m.youtubeEmbedId,
          lessonText: m.lessonText,
          sortOrder: m.sortOrder,
          assets: m.assets,
        })),
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/public/training/:publicId/start
  app.post("/api/public/training/:publicId/start", async (req, res) => {
    try {
      const course = await storage.getTrainingCourseByPublicId(req.params.publicId);
      if (!course || !course.publicLinkEnabled || !course.isPublished) return res.status(404).json({ message: "Course not found" });
      const { name, email } = req.body;
      if (!name || !email) return res.status(400).json({ message: "name and email required" });
      const now = trainingNow();
      const learner = await storage.createPublicLearner({ courseId: course.id, companyId: course.companyId, name, email, startedAt: now, completedAt: null, createdAt: now });
      res.json({ learnerId: learner.id });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/public/training/:publicId/progress/:moduleId
  app.post("/api/public/training/:publicId/progress/:moduleId", async (req, res) => {
    try {
      const course = await storage.getTrainingCourseByPublicId(req.params.publicId);
      if (!course || !course.publicLinkEnabled || !course.isPublished) return res.status(404).json({ message: "Course not found" });
      const { learnerId } = req.body;
      if (!learnerId) return res.status(400).json({ message: "learnerId required" });
      const learner = await storage.getPublicLearner(learnerId);
      if (!learner) return res.status(404).json({ message: "Learner not found" });
      await storage.markModuleComplete(course.id, req.params.moduleId, course.companyId, undefined, learnerId);
      const modules = await storage.getTrainingModules(course.id);
      const progress = await storage.getTrainingProgress(course.id, undefined, learnerId);
      const completedIds = new Set(progress.map(p => p.moduleId));
      const reqModules = modules.filter(m => m.isRequired);
      const modulesComplete = modules.length > 0 && (
        reqModules.length > 0 ? reqModules.every(m => completedIds.has(m.id)) : modules.every(m => completedIds.has(m.id))
      );
      const isCompleted = modulesComplete;
      let certificate = null;
      if (isCompleted) {
        await storage.updatePublicLearner(learnerId, { completedAt: trainingNow() });
      }
      certificate = await tryIssueTrainingCertificate({
        courseId: course.id,
        companyId: course.companyId,
        publicLearnerId: learnerId,
        learnerName: learner.name,
      });
      res.json({
        moduleId: req.params.moduleId,
        isCompleted,
        modulesComplete,
        completedModules: completedIds.size,
        totalModules: modules.length,
        certificate,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Training Quiz: Attempt + Scoring ──────────────────────────────────────

  // Build the public-facing quiz payload (sanitized: no correct answers/explanations on questions)
  // along with the learner's attempt history and gating flags.
  async function buildQuizPayload(courseId: string, employeeId: string | undefined, publicLearnerId: string | undefined) {
    const quiz = await storage.getTrainingQuizByCourse(courseId);
    if (!quiz) return null;

    // Modules-completed gate (matches cert helper)
    const modules = await storage.getTrainingModules(courseId);
    const required = modules.filter(m => m.isRequired);
    const progress = await storage.getTrainingProgress(courseId, employeeId, publicLearnerId);
    const completedIds = new Set(progress.map(p => p.moduleId));
    const modulesComplete = modules.length > 0 && (
      required.length > 0 ? required.every(m => completedIds.has(m.id)) : modules.every(m => completedIds.has(m.id))
    );

    const attempts = await storage.getTrainingQuizAttempts(quiz.id, employeeId, publicLearnerId);
    const lastCompleted = attempts.find(a => a.completedAt);
    const hasPassed = attempts.some(a => a.passed);
    const canRetake = !hasPassed && quiz.allowRetake;

    return {
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        passingScore: quiz.passingScore,
        allowRetake: quiz.allowRetake,
        showCorrectAnswers: quiz.showCorrectAnswers,
        isRequired: quiz.isRequired,
        questions: quiz.questions.map(q => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          optionsJson: q.optionsJson,
          sortOrder: q.sortOrder,
        })),
      },
      modulesComplete,
      attemptCount: attempts.length,
      lastAttempt: lastCompleted ? {
        id: lastCompleted.id,
        score: lastCompleted.score,
        passed: lastCompleted.passed,
        completedAt: lastCompleted.completedAt,
      } : null,
      hasPassed,
      canRetake: canRetake || (!hasPassed && attempts.length === 0),
    };
  }

  async function startQuizAttempt(courseId: string, companyId: string, employeeId: string | undefined, publicLearnerId: string | undefined) {
    const quiz = await storage.getTrainingQuizByCourse(courseId);
    if (!quiz) return { error: { status: 404, message: "Quiz not found" } } as const;

    // Block if modules aren't done yet
    const modules = await storage.getTrainingModules(courseId);
    const required = modules.filter(m => m.isRequired);
    const progress = await storage.getTrainingProgress(courseId, employeeId, publicLearnerId);
    const completedIds = new Set(progress.map(p => p.moduleId));
    const modulesComplete = modules.length > 0 && (
      required.length > 0 ? required.every(m => completedIds.has(m.id)) : modules.every(m => completedIds.has(m.id))
    );
    if (!modulesComplete) return { error: { status: 400, message: "Complete all modules before starting the quiz" } } as const;

    // Block re-attempt if already passed (regardless of allowRetake)
    const passed = await storage.hasPassedTrainingQuiz(quiz.id, employeeId, publicLearnerId);
    if (passed) return { error: { status: 400, message: "Quiz already passed" } } as const;

    // Block new attempt if a prior failed attempt exists and retakes are disabled
    if (!quiz.allowRetake) {
      const attempts = await storage.getTrainingQuizAttempts(quiz.id, employeeId, publicLearnerId);
      if (attempts.some(a => a.completedAt)) return { error: { status: 400, message: "Retakes are disabled for this quiz" } } as const;
    }

    const attempt = await storage.createTrainingQuizAttempt({
      quizId: quiz.id,
      courseId,
      companyId,
      employeeId: employeeId ?? null,
      publicLearnerId: publicLearnerId ?? null,
      score: null,
      passed: false,
      answersJson: null,
      startedAt: trainingNow(),
      completedAt: null,
    } as any);
    return { attempt, quiz } as const;
  }

  async function submitQuizAttempt(attemptId: string, answers: Record<string, any>, identity: { employeeId?: string; publicLearnerId?: string }) {
    const attempt = await storage.getTrainingQuizAttempt(attemptId);
    if (!attempt) return { error: { status: 404, message: "Attempt not found" } } as const;
    if (attempt.completedAt) return { error: { status: 400, message: "Attempt already submitted" } } as const;
    if (identity.employeeId && attempt.employeeId !== identity.employeeId) return { error: { status: 403, message: "Forbidden" } } as const;
    if (identity.publicLearnerId && attempt.publicLearnerId !== identity.publicLearnerId) return { error: { status: 403, message: "Forbidden" } } as const;

    const quiz = await storage.getTrainingQuizByCourse(attempt.courseId);
    if (!quiz) return { error: { status: 404, message: "Quiz not found" } } as const;

    let correctCount = 0;
    const review = quiz.questions.map(q => {
      const given = answers?.[q.id];
      const isCorrect = scoreTrainingQuestion(q, given);
      if (isCorrect) correctCount++;
      let correctAnswer: any = null;
      try { correctAnswer = JSON.parse(q.correctAnswerJson); } catch {}
      return {
        questionId: q.id,
        given: given ?? null,
        isCorrect,
        correctAnswer,
        explanation: q.explanation,
      };
    });
    const total = quiz.questions.length || 1;
    const score = Math.round((correctCount / total) * 100);
    const passed = score >= quiz.passingScore;

    await storage.updateTrainingQuizAttempt(attempt.id, {
      score,
      passed,
      answersJson: JSON.stringify(answers ?? {}),
      completedAt: trainingNow(),
    } as any);

    return { quiz, attempt, score, passed, correctCount, total, review } as const;
  }

  // GET /api/training/my-courses/:courseId/quiz — employee
  app.get("/api/training/my-courses/:courseId/quiz", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== "employee") return res.status(403).json({ message: "Forbidden" });
      // Assignment check: getMyTrainingCourse only returns when the employee is assigned/visible
      const detail = await storage.getMyTrainingCourse(req.params.courseId, user.id);
      if (!detail) return res.status(404).json({ message: "Course not found" });
      const payload = await buildQuizPayload(req.params.courseId, user.id, undefined);
      if (!payload) return res.status(404).json({ message: "No quiz for this course" });
      res.json(payload);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/training/my-courses/:courseId/quiz/start — employee
  app.post("/api/training/my-courses/:courseId/quiz/start", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== "employee") return res.status(403).json({ message: "Forbidden" });
      const detail = await storage.getMyTrainingCourse(req.params.courseId, user.id);
      if (!detail) return res.status(404).json({ message: "Course not found" });
      const result = await startQuizAttempt(req.params.courseId, user.companyId, user.id, undefined);
      if ("error" in result) return res.status(result.error.status).json({ message: result.error.message });
      res.json({ attemptId: result.attempt.id });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/training/quiz-attempts/:attemptId/submit — employee
  app.post("/api/training/quiz-attempts/:attemptId/submit", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== "employee") return res.status(403).json({ message: "Forbidden" });
      const { answers } = req.body || {};
      if (!answers || typeof answers !== "object") return res.status(400).json({ message: "answers required" });
      const result = await submitQuizAttempt(req.params.attemptId, answers, { employeeId: user.id });
      if ("error" in result) return res.status(result.error.status).json({ message: result.error.message });
      // Tenant guard
      if (result.attempt.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });
      const cert = result.passed ? await tryIssueTrainingCertificate({
        courseId: result.attempt.courseId,
        companyId: user.companyId,
        employeeId: user.id,
        learnerName: `${user.firstName} ${user.lastName}`,
      }) : null;
      const showAnswers = result.quiz.showCorrectAnswers || result.passed;
      res.json({
        score: result.score,
        passed: result.passed,
        passingScore: result.quiz.passingScore,
        correctCount: result.correctCount,
        total: result.total,
        review: showAnswers ? result.review : result.review.map(r => ({ questionId: r.questionId, given: r.given, isCorrect: r.isCorrect })),
        certificate: cert,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/public/training/:publicId/quiz?learnerId=... — public
  app.get("/api/public/training/:publicId/quiz", async (req, res) => {
    try {
      const course = await storage.getTrainingCourseByPublicId(req.params.publicId);
      if (!course || !course.publicLinkEnabled || !course.isPublished) return res.status(404).json({ message: "Course not found" });
      const learnerId = (req.query.learnerId as string) || undefined;
      if (!learnerId) return res.status(400).json({ message: "learnerId required" });
      const learner = await storage.getPublicLearner(learnerId);
      if (!learner || learner.courseId !== course.id) return res.status(404).json({ message: "Learner not found" });
      const payload = await buildQuizPayload(course.id, undefined, learnerId);
      if (!payload) return res.status(404).json({ message: "No quiz for this course" });
      res.json(payload);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/public/training/:publicId/quiz/start — public
  app.post("/api/public/training/:publicId/quiz/start", async (req, res) => {
    try {
      const course = await storage.getTrainingCourseByPublicId(req.params.publicId);
      if (!course || !course.publicLinkEnabled || !course.isPublished) return res.status(404).json({ message: "Course not found" });
      const { learnerId } = req.body || {};
      if (!learnerId) return res.status(400).json({ message: "learnerId required" });
      const learner = await storage.getPublicLearner(learnerId);
      if (!learner || learner.courseId !== course.id) return res.status(404).json({ message: "Learner not found" });
      const result = await startQuizAttempt(course.id, course.companyId, undefined, learnerId);
      if ("error" in result) return res.status(result.error.status).json({ message: result.error.message });
      res.json({ attemptId: result.attempt.id });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/public/training/:publicId/quiz/submit — public
  app.post("/api/public/training/:publicId/quiz/submit", async (req, res) => {
    try {
      const course = await storage.getTrainingCourseByPublicId(req.params.publicId);
      if (!course || !course.publicLinkEnabled || !course.isPublished) return res.status(404).json({ message: "Course not found" });
      const { learnerId, attemptId, answers } = req.body || {};
      if (!learnerId || !attemptId || !answers || typeof answers !== "object") {
        return res.status(400).json({ message: "learnerId, attemptId, answers required" });
      }
      const learner = await storage.getPublicLearner(learnerId);
      if (!learner || learner.courseId !== course.id) return res.status(404).json({ message: "Learner not found" });
      const result = await submitQuizAttempt(attemptId, answers, { publicLearnerId: learnerId });
      if ("error" in result) return res.status(result.error.status).json({ message: result.error.message });
      if (result.attempt.courseId !== course.id) return res.status(403).json({ message: "Forbidden" });
      const cert = result.passed ? await tryIssueTrainingCertificate({
        courseId: course.id,
        companyId: course.companyId,
        publicLearnerId: learnerId,
        learnerName: learner.name,
      }) : null;
      const showAnswers = result.quiz.showCorrectAnswers || result.passed;
      res.json({
        score: result.score,
        passed: result.passed,
        passingScore: result.quiz.passingScore,
        correctCount: result.correctCount,
        total: result.total,
        review: showAnswers ? result.review : result.review.map(r => ({ questionId: r.questionId, given: r.given, isCorrect: r.isCorrect })),
        certificate: cert,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Training AI Backbone ──────────────────────────────────────────────────

  // POST /api/training/ai/generate-course — wizard step 2 backbone
  app.post("/api/training/ai/generate-course", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      if (!isAIAvailable()) return res.status(503).json({ message: "AI not available" });
      const { topic, industry, employeeLevel, audience, trainingGoal, moduleCount, includeQuiz, quizQuestionCount, questionTypeMix, passingScore, wantVideos, wantImages, tone } = req.body || {};
      if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
        return res.status(400).json({ message: "topic is required (min 3 chars)" });
      }
      const draft = await generateCourseDraft({
        topic: topic.trim(),
        industry: industry || undefined,
        employeeLevel: (employeeLevel ?? audience) || undefined,
        trainingGoal: trainingGoal || undefined,
        moduleCount: typeof moduleCount === "number" ? moduleCount : undefined,
        includeQuiz: includeQuiz !== false,
        quizQuestionCount: typeof quizQuestionCount === "number" ? quizQuestionCount : undefined,
        questionTypeMix: questionTypeMix && typeof questionTypeMix === "object" ? questionTypeMix : undefined,
        passingScore: typeof passingScore === "number" ? passingScore : undefined,
        wantVideos: !!wantVideos,
        wantImages: !!wantImages,
        tone: tone as ToneOption | undefined,
      });
      res.json(draft);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "AI generation failed" });
    }
  });

  // POST /api/training/ai/improve — improve/grammar/shorter/clearer/professional/safety/etc
  app.post("/api/training/ai/improve", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      if (!isAIAvailable()) return res.status(503).json({ message: "AI not available" });
      const { text, action, context } = req.body || {};
      if (!text || typeof text !== "string") return res.status(400).json({ message: "text required" });
      if (!action || typeof action !== "string") return res.status(400).json({ message: "action required" });
      const result = await improveText(text, action as ImproveAction, context);
      res.json({ result });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "AI generation failed" });
    }
  });

  // POST /api/training/ai/generate-module — generate or fill out a single module body
  app.post("/api/training/ai/generate-module", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      if (!isAIAvailable()) return res.status(503).json({ message: "AI not available" });
      const { moduleTitle, courseTitle, courseDescription, tone } = req.body || {};
      if (!moduleTitle || typeof moduleTitle !== "string") return res.status(400).json({ message: "moduleTitle required" });
      const draft = await generateModuleContent({
        moduleTitle,
        courseTitle: courseTitle || undefined,
        courseDescription: courseDescription || null,
        tone: tone as ToneOption | undefined,
      });
      res.json(draft);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "AI generation failed" });
    }
  });

  // POST /api/training/ai/save-draft — atomically save an edited AI course draft (course + modules + quiz + questions)
  app.post("/api/training/ai/save-draft", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const { course: courseInput, modules: moduleInputs, quiz: quizInput } = req.body || {};

      // ── Validation ────────────────────────────────────────────────────────
      if (!courseInput || typeof courseInput.title !== "string" || !courseInput.title.trim()) {
        return res.status(400).json({ message: "Course title is required" });
      }
      if (!Array.isArray(moduleInputs) || moduleInputs.length === 0) {
        return res.status(400).json({ message: "At least one module is required" });
      }
      for (let i = 0; i < moduleInputs.length; i++) {
        const m = moduleInputs[i];
        if (!m || typeof m.title !== "string" || !m.title.trim()) {
          return res.status(400).json({ message: `Module #${i + 1} is missing a title`, field: `modules[${i}].title` });
        }
        if (typeof m.lessonText !== "string" || !m.lessonText.trim()) {
          return res.status(400).json({ message: `Module #${i + 1} ("${m.title}") is missing lesson content`, field: `modules[${i}].lessonText` });
        }
      }
      if (quizInput && quizInput.enabled !== false && Array.isArray(quizInput.questions)) {
        if (quizInput.questions.length === 0) {
          return res.status(400).json({ message: `Quiz is enabled but has no questions. Add at least one question or disable the quiz.`, field: `quiz.questions` });
        }
        for (let i = 0; i < quizInput.questions.length; i++) {
          const q = quizInput.questions[i];
          if (!q || typeof q.questionText !== "string" || !q.questionText.trim()) {
            return res.status(400).json({ message: `Quiz question #${i + 1} is missing text`, field: `quiz.questions[${i}].questionText` });
          }
          if (!["multiple_choice", "true_false", "short_answer"].includes(q.questionType)) {
            return res.status(400).json({ message: `Quiz question #${i + 1} has invalid type`, field: `quiz.questions[${i}].questionType` });
          }
          if (q.questionType === "multiple_choice") {
            const opts = Array.isArray(q.options) ? q.options.filter((o: any) => typeof o === "string" && o.trim()) : [];
            if (opts.length < 2) {
              return res.status(400).json({ message: `Quiz question #${i + 1} needs at least 2 options`, field: `quiz.questions[${i}].options` });
            }
            if (!q.correctAnswer || !opts.includes(q.correctAnswer)) {
              return res.status(400).json({ message: `Quiz question #${i + 1} needs a correct answer that matches one of the options`, field: `quiz.questions[${i}].correctAnswer` });
            }
          } else if (q.questionType === "true_false") {
            if (q.correctAnswer !== "True" && q.correctAnswer !== "False") {
              return res.status(400).json({ message: `Quiz question #${i + 1} needs a True/False answer`, field: `quiz.questions[${i}].correctAnswer` });
            }
          } else if (q.questionType === "short_answer") {
            if (typeof q.correctAnswer !== "string" || !q.correctAnswer.trim()) {
              return res.status(400).json({ message: `Quiz question #${i + 1} needs an expected answer`, field: `quiz.questions[${i}].correctAnswer` });
            }
          }
        }
      }

      const now = trainingNow();
      const publicId = courseInput.publicLinkEnabled ? genPublicId() : null;

      // ── Atomic insert via DB transaction ──────────────────────────────────
      const courseId = await db.transaction(async (tx) => {
        const [course] = await tx.insert(trainingCourses).values({
          companyId: user.companyId,
          createdBy: user.id,
          title: String(courseInput.title).trim(),
          description: courseInput.description ? String(courseInput.description) : null,
          category: courseInput.category ? String(courseInput.category) : null,
          estimatedDuration: courseInput.estimatedDuration ? String(courseInput.estimatedDuration) : null,
          thumbnailData: courseInput.thumbnailData ? String(courseInput.thumbnailData) : null,
          isRequired: !!courseInput.isRequired,
          isPublished: false,
          publicLinkEnabled: !!courseInput.publicLinkEnabled,
          publicId,
          certificateEnabled: courseInput.certificateEnabled !== false,
          createdAt: now,
          updatedAt: now,
        } as any).returning();

        const insertedModuleIds: string[] = [];
        for (let i = 0; i < moduleInputs.length; i++) {
          const m = moduleInputs[i];
          const embedId = m.youtubeUrl ? parseYoutubeId(String(m.youtubeUrl)) : null;
          const [insertedModule] = await tx.insert(trainingModules).values({
            courseId: course.id,
            companyId: user.companyId,
            title: String(m.title).trim(),
            description: m.description ? String(m.description) : null,
            youtubeUrl: m.youtubeUrl ? String(m.youtubeUrl) : null,
            youtubeEmbedId: embedId,
            lessonText: m.lessonText ? String(m.lessonText) : null,
            sortOrder: typeof m.sortOrder === "number" ? m.sortOrder : i,
            isRequired: m.isRequired !== false,
            createdAt: now,
            updatedAt: now,
          } as any).returning();
          insertedModuleIds.push(insertedModule.id);

          if (Array.isArray(m.assets) && m.assets.length > 0) {
            const assetRows = m.assets
              .map((a: any, ai: number) => {
                const data = typeof a === "string" ? a : a?.assetData;
                if (!data || typeof data !== "string") return null;
                return {
                  moduleId: insertedModule.id,
                  assetData: data,
                  assetType: (a && typeof a === "object" && a.assetType) ? String(a.assetType) : "image",
                  sortOrder: ai,
                  createdAt: now,
                };
              })
              .filter(Boolean);
            if (assetRows.length > 0) {
              await tx.insert(trainingModuleAssets).values(assetRows as any);
            }
          }
        }

        if (quizInput && quizInput.enabled !== false && Array.isArray(quizInput.questions) && quizInput.questions.length > 0) {
          const [quiz] = await tx.insert(trainingQuizzes).values({
            courseId: course.id,
            companyId: user.companyId,
            title: quizInput.title ? String(quizInput.title) : `${course.title} — Final Quiz`,
            description: quizInput.description ? String(quizInput.description) : null,
            passingScore: typeof quizInput.passingScore === "number" ? Math.max(0, Math.min(100, quizInput.passingScore)) : 80,
            allowRetake: quizInput.allowRetake !== false,
            showCorrectAnswers: !!quizInput.showCorrectAnswers,
            isRequired: quizInput.isRequired !== false,
            createdAt: now,
            updatedAt: now,
          } as any).returning();

          const rows = aiQuestionsToInsertRows(quizInput.questions as AIQuizQuestion[]).map(r => ({
            ...r,
            quizId: quiz.id,
            createdAt: now,
          }));
          if (rows.length > 0) {
            await tx.insert(trainingQuizQuestions).values(rows as any);
          }
        }

        return course.id;
      });

      res.json({ id: courseId, courseId });
    } catch (e: any) {
      console.error("[training/ai/save-draft] error:", e);
      res.status(500).json({ message: e.message || "Failed to save draft" });
    }
  });

  // POST /api/training/ai/generate-quiz — generate quiz questions from existing course modules
  app.post("/api/training/ai/generate-quiz", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      if (!isAIAvailable()) return res.status(503).json({ message: "AI not available" });
      const user = (req as any).user;
      const { courseId, count, questionTypeMix, tone, modules: inlineModules, courseTitle, courseDescription } = req.body || {};

      // Two modes:
      //   (a) courseId provided → load saved course + modules from DB (existing behavior).
      //   (b) inlineModules provided → score modules from the wizard before save (regenerate quiz preview).
      let titleForPrompt: string;
      let descriptionForPrompt: string | null = null;
      let modulesWithContent: { title: string; description?: string | null; lessonText?: string | null }[];

      if (courseId) {
        const course = await storage.getTrainingCourse(courseId);
        if (!course || course.companyId !== user.companyId) return res.status(404).json({ message: "Course not found" });
        const dbModules = await storage.getTrainingModules(courseId);
        modulesWithContent = dbModules
          .filter(m => (m.lessonText && m.lessonText.trim().length > 20) || (m.description && m.description.trim().length > 10))
          .map(m => ({ title: m.title, description: m.description, lessonText: m.lessonText }));
        titleForPrompt = course.title;
        descriptionForPrompt = course.description ?? null;
      } else if (Array.isArray(inlineModules) && inlineModules.length > 0) {
        modulesWithContent = inlineModules
          .filter((m: any) => m && typeof m.title === "string" && ((m.lessonText && String(m.lessonText).trim().length > 20) || (m.description && String(m.description).trim().length > 10)))
          .map((m: any) => ({ title: String(m.title), description: m.description ? String(m.description) : null, lessonText: m.lessonText ? String(m.lessonText) : null }));
        titleForPrompt = typeof courseTitle === "string" && courseTitle.trim() ? courseTitle.trim() : "Training Course";
        descriptionForPrompt = typeof courseDescription === "string" ? courseDescription : null;
      } else {
        return res.status(400).json({ message: "Either courseId or modules array is required" });
      }

      if (modulesWithContent.length === 0) {
        return res.status(400).json({ message: "No module has enough content to generate quiz questions yet. Add lesson text to at least one module before generating a quiz." });
      }
      const questions = await generateQuizFromCourse({
        courseTitle: titleForPrompt,
        courseDescription: descriptionForPrompt,
        modules: modulesWithContent,
        count: typeof count === "number" ? count : 15,
        questionTypeMix: questionTypeMix && typeof questionTypeMix === "object" ? questionTypeMix : undefined,
        tone: tone as ToneOption | undefined,
      });
      res.json({ questions });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "AI generation failed" });
    }
  });

  // ── Training Quiz CRUD ────────────────────────────────────────────────────

  function aiQuestionsToInsertRows(questions: AIQuizQuestion[]) {
    return questions.map((q, i) => ({
      questionText: q.questionText,
      questionType: q.questionType,
      optionsJson: q.options ? JSON.stringify(q.options) : null,
      correctAnswerJson: JSON.stringify(q.correctAnswer),
      explanation: q.explanation || null,
      sortOrder: i,
    }));
  }

  // GET /api/training/courses/:courseId/quiz — admin
  app.get("/api/training/courses/:courseId/quiz", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const course = await storage.getTrainingCourse(req.params.courseId);
      if (!course || course.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const quiz = await storage.getTrainingQuizByCourse(req.params.courseId);
      res.json(quiz ?? null);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/training/courses/:courseId/quiz — create or replace quiz (with optional questions array)
  app.post("/api/training/courses/:courseId/quiz", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const course = await storage.getTrainingCourse(req.params.courseId);
      if (!course || course.companyId !== user.companyId) return res.status(404).json({ message: "Not found" });
      const { title, description, passingScore, allowRetake, showCorrectAnswers, isRequired, questions, aiQuestions } = req.body || {};
      const now = trainingNow();
      const existing = await storage.getTrainingQuizByCourse(course.id);
      let quiz: TrainingQuizLike;
      if (existing) {
        quiz = (await storage.updateTrainingQuiz(existing.id, {
          title: title ?? existing.title,
          description: description ?? existing.description,
          passingScore: typeof passingScore === "number" ? passingScore : existing.passingScore,
          allowRetake: typeof allowRetake === "boolean" ? allowRetake : existing.allowRetake,
          showCorrectAnswers: typeof showCorrectAnswers === "boolean" ? showCorrectAnswers : existing.showCorrectAnswers,
          isRequired: typeof isRequired === "boolean" ? isRequired : existing.isRequired,
          updatedAt: now,
        }))!;
      } else {
        quiz = await storage.createTrainingQuiz({
          courseId: course.id,
          companyId: user.companyId,
          title: title ?? `${course.title} — Final Quiz`,
          description: description ?? null,
          passingScore: typeof passingScore === "number" ? passingScore : 80,
          allowRetake: typeof allowRetake === "boolean" ? allowRetake : true,
          showCorrectAnswers: typeof showCorrectAnswers === "boolean" ? showCorrectAnswers : false,
          isRequired: typeof isRequired === "boolean" ? isRequired : true,
          createdAt: now,
          updatedAt: now,
        });
      }

      let savedQuestions = null;
      if (Array.isArray(aiQuestions)) {
        savedQuestions = await storage.replaceTrainingQuizQuestions(quiz.id, aiQuestionsToInsertRows(aiQuestions as AIQuizQuestion[]));
      } else if (Array.isArray(questions)) {
        savedQuestions = await storage.replaceTrainingQuizQuestions(quiz.id, questions.map((q: any, i: number) => ({
          questionText: String(q.questionText ?? ""),
          questionType: q.questionType === "true_false" || q.questionType === "short_answer" ? q.questionType : "multiple_choice",
          optionsJson: q.options ? JSON.stringify(q.options) : (q.optionsJson ?? null),
          correctAnswerJson: typeof q.correctAnswerJson === "string" ? q.correctAnswerJson : JSON.stringify(q.correctAnswer ?? ""),
          explanation: q.explanation ?? null,
          sortOrder: typeof q.sortOrder === "number" ? q.sortOrder : i,
        })));
      }
      const full = await storage.getTrainingQuizByCourse(course.id);
      res.json(full ?? { ...quiz, questions: savedQuestions ?? [] });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Tenant ownership helpers — load before mutate
  async function loadQuizForCompany(quizId: string, companyId: string) {
    const { trainingQuizzes: tq } = await import("@shared/schema");
    const [row] = await db.select().from(tq).where(and(eq(tq.id, quizId), eq(tq.companyId, companyId)));
    return row ?? null;
  }
  async function loadQuestionForCompany(questionId: string, companyId: string) {
    const { trainingQuizzes: tq, trainingQuizQuestions: tqq } = await import("@shared/schema");
    const [row] = await db
      .select({ q: tqq, quiz: tq })
      .from(tqq)
      .innerJoin(tq, eq(tqq.quizId, tq.id))
      .where(and(eq(tqq.id, questionId), eq(tq.companyId, companyId)));
    return row ? { question: row.q, quiz: row.quiz } : null;
  }

  // PUT /api/training/quizzes/:quizId — update quiz settings
  app.put("/api/training/quizzes/:quizId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const existing = await loadQuizForCompany(req.params.quizId, user.companyId);
      if (!existing) return res.status(404).json({ message: "Not found" });
      // Whitelist mutable fields; never trust client to set companyId / courseId / id
      const { title, description, passingScore, allowRetake, showCorrectAnswers, isRequired } = req.body || {};
      const patch: any = { updatedAt: trainingNow() };
      if (typeof title === "string") patch.title = title;
      if (description !== undefined) patch.description = description;
      if (typeof passingScore === "number") patch.passingScore = passingScore;
      if (typeof allowRetake === "boolean") patch.allowRetake = allowRetake;
      if (typeof showCorrectAnswers === "boolean") patch.showCorrectAnswers = showCorrectAnswers;
      if (typeof isRequired === "boolean") patch.isRequired = isRequired;
      const updated = await storage.updateTrainingQuiz(req.params.quizId, patch);
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/training/quizzes/:quizId
  app.delete("/api/training/quizzes/:quizId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const existing = await loadQuizForCompany(req.params.quizId, user.companyId);
      if (!existing) return res.status(404).json({ message: "Not found" });
      await storage.deleteTrainingQuiz(req.params.quizId);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/training/quizzes/:quizId/questions — add a question
  app.post("/api/training/quizzes/:quizId/questions", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const existing = await loadQuizForCompany(req.params.quizId, user.companyId);
      if (!existing) return res.status(404).json({ message: "Not found" });
      const { questionText, questionType, options, correctAnswer, explanation, sortOrder } = req.body || {};
      if (!questionText) return res.status(400).json({ message: "questionText required" });
      const q = await storage.createTrainingQuizQuestion({
        quizId: req.params.quizId,
        questionText,
        questionType: questionType === "true_false" || questionType === "short_answer" ? questionType : "multiple_choice",
        optionsJson: options ? JSON.stringify(options) : null,
        correctAnswerJson: JSON.stringify(correctAnswer ?? ""),
        explanation: explanation ?? null,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
        createdAt: trainingNow(),
      });
      res.json(q);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PUT /api/training/quiz-questions/:id
  app.put("/api/training/quiz-questions/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const existing = await loadQuestionForCompany(req.params.id, user.companyId);
      if (!existing) return res.status(404).json({ message: "Not found" });
      const { questionText, questionType, options, correctAnswer, explanation, sortOrder } = req.body || {};
      const patch: any = {};
      if (typeof questionText === "string") patch.questionText = questionText;
      if (questionType === "multiple_choice" || questionType === "true_false" || questionType === "short_answer") patch.questionType = questionType;
      if (options !== undefined) patch.optionsJson = options ? JSON.stringify(options) : null;
      if (correctAnswer !== undefined) patch.correctAnswerJson = JSON.stringify(correctAnswer);
      if (explanation !== undefined) patch.explanation = explanation;
      if (typeof sortOrder === "number") patch.sortOrder = sortOrder;
      const q = await storage.updateTrainingQuizQuestion(req.params.id, patch);
      res.json(q);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/training/quiz-questions/:id
  app.delete("/api/training/quiz-questions/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user;
      const existing = await loadQuestionForCompany(req.params.id, user.companyId);
      if (!existing) return res.status(404).json({ message: "Not found" });
      await storage.deleteTrainingQuizQuestion(req.params.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  return httpServer;
}

type TrainingQuizLike = Awaited<ReturnType<typeof storage.createTrainingQuiz>>;

