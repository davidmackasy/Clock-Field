import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { storage } from "./storage";
import type { Express, Request } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const PgSession = connectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "employee-tracking-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Standard email + password strategy
  passport.use(
    "local",
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) return done(null, false, { message: "Invalid credentials" });
          if (!user.isActive) return done(null, false, { message: "Account is disabled" });
          const isValid = await comparePasswords(password, user.password);
          if (!isValid) return done(null, false, { message: "Invalid credentials" });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // Employee ID + PIN/password strategy
  passport.use(
    "employee-local",
    new LocalStrategy(
      { usernameField: "employeeId", passwordField: "pin" },
      async (employeeId, pin, done) => {
        try {
          const user = await storage.getUserByEmployeeId(employeeId.toUpperCase());
          if (!user) return done(null, false, { message: "Invalid Employee ID or PIN" });
          if (!user.loginEnabled) return done(null, false, { message: "Login access not enabled for this account" });
          if (user.accountStatus === "disabled") return done(null, false, { message: "Account is disabled" });
          if (!user.isActive) return done(null, false, { message: "Account is disabled" });
          const isValid = await comparePasswords(pin, user.password);
          if (!isValid) return done(null, false, { message: "Invalid Employee ID or PIN" });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (err) {
      done(err);
    }
  });
}

export function requireAuth(req: Request, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as any;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
