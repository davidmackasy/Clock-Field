import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { buildReviewMetaTags, extractReviewToken } from "./review-meta";
import { buildReportMetaTags, extractReportToken } from "./report-meta";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      const baseUrl = `${req.protocol}://${req.get("host")}`;

      // Inject OG/Twitter meta tags for review share pages
      const reviewToken = extractReviewToken(url);
      if (reviewToken) {
        const metaTags = await buildReviewMetaTags(reviewToken, baseUrl);
        if (metaTags) {
          template = template
            .replace("<head>", `<head>\n    ${metaTags}`)
            .replace(`<title>ClockField</title>`, "");
        }
      }

      // Inject OG/Twitter meta tags for public work-report pages (/public/work-report/:token and /r/:code)
      const reportToken = extractReportToken(url);
      if (reportToken) {
        const metaTags = await buildReportMetaTags(reportToken, baseUrl);
        if (metaTags) {
          template = template
            .replace("<head>", `<head>\n    ${metaTags}`)
            .replace(`<title>ClockField</title>`, "");
        }
      }

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
