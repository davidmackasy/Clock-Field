import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { uploadsDirectory } from "./file-storage";
import { readPersistentFile } from "./persistent-files";

const app = express();
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use("/uploads", async (req, res, next) => {
  if (!process.env.SUPABASE_URL) return next();
  const filename = req.path.slice(1);
  if (!filename || path.basename(filename) !== filename) return res.sendStatus(404);
  try {
    const data = await readPersistentFile(path.join(uploadsDirectory, filename));
    if (!data) return res.sendStatus(404);
    res.set("X-Content-Type-Options", "nosniff").type(path.extname(filename)).send(data);
  } catch (error) { next(error); }
});
app.use("/uploads", express.static(uploadsDirectory));
app.get("/healthz", (_req, res) => res.json({ status: "ok", revision: process.env.APP_DEPLOYMENT_REVISION }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && process.env.NODE_ENV !== "production") {
        // Redact endpoints whose responses contain large/sensitive payloads
        // (employee document file data, training module assets, etc.) to keep
        // PII out of server logs and prevent log bloat.
        const isDocumentDetail = /^\/api\/employees\/[^/]+\/documents\/[^/]+$/.test(path) && req.method === "GET";
        if (isDocumentDetail) {
          logLine += ` :: [redacted]`;
        } else {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // Run idempotent startup migrations (grandfathering, super admin grants, etc.)
  const { runStartupMigrations } = await import("./migrations");
  await runStartupMigrations();

  const { seedDatabase } = await import("./seed");
  await seedDatabase();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  const shutdown = () => {
    httpServer.close(() => process.exit(0));
    httpServer.closeIdleConnections();
    setTimeout(() => process.exit(0), 30_000).unref();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: process.platform === "linux",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
