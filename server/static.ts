import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { buildReviewMetaTags, extractReviewToken } from "./review-meta";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", async (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    let html = await fs.promises.readFile(indexPath, "utf-8");

    // Inject OG/Twitter meta tags for review share pages
    const reviewToken = extractReviewToken(req.originalUrl);
    if (reviewToken) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const metaTags = await buildReviewMetaTags(reviewToken, baseUrl);
      if (metaTags) {
        html = html
          .replace("<head>", `<head>\n    ${metaTags}`)
          .replace(`<title>ClockField</title>`, "");
      }
    }

    res.set("Content-Type", "text/html").send(html);
  });
}
