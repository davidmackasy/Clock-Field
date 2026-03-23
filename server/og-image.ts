import { createCanvas } from "@napi-rs/canvas";

interface ReviewOgData {
  companyName: string;
  reviewText: string;
  clientName: string;
  clientCompany?: string | null;
  rating?: number | null;
  workDate?: string | null;
  locationName?: string | null;
  employeeName?: string | null;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "\u2026";
}

function fmtDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function drawStar(ctx: any, cx: number, cy: number, outerR: number, innerR: number) {
  const points = 5;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawStarRow(ctx: any, rating: number, x: number, y: number, size: number) {
  for (let i = 0; i < 5; i++) {
    const starX = x + i * (size + 6);
    ctx.fillStyle = i < rating ? "#fbbf24" : "rgba(255,255,255,0.3)";
    drawStar(ctx, starX + size / 2, y + size / 2, size / 2, size / 4.5);
  }
}

function roundedRectPath(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function roundedRectTopPath(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
  const words = text.split(" ");
  let line = "";
  let lineCount = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      if (lineCount >= maxLines - 1) {
        const truncLine = line.trimEnd() + "\u2026";
        ctx.fillText(truncLine, x, y + lineCount * lineHeight);
        return lineCount + 1;
      }
      ctx.fillText(line.trimEnd(), x, y + lineCount * lineHeight);
      line = words[n] + " ";
      lineCount++;
    } else {
      line = testLine;
    }
  }
  if (line.trim()) {
    ctx.fillText(line.trimEnd(), x, y + lineCount * lineHeight);
    lineCount++;
  }
  return lineCount;
}

export async function generateReviewOgImage(data: ReviewOgData): Promise<Buffer> {
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as any;

  // ── Background ──────────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#f0f4ff");
  bgGrad.addColorStop(1, "#e8eeff");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle dot pattern
  ctx.fillStyle = "rgba(59, 130, 246, 0.04)";
  for (let r = 0; r < H; r += 24) {
    for (let c = 0; c < W; c += 24) {
      ctx.beginPath();
      ctx.arc(c, r, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Card ────────────────────────────────────────────────────────────────────
  const PAD = 56;
  const cX = PAD;
  const cY = PAD;
  const cW = W - PAD * 2;
  const cH = H - PAD * 2;
  const RADIUS = 28;

  // Shadow
  ctx.save();
  ctx.shadowColor = "rgba(30, 58, 138, 0.18)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#ffffff";
  roundedRectPath(ctx, cX, cY, cW, cH, RADIUS);
  ctx.fill();
  ctx.restore();

  // ── Blue header ─────────────────────────────────────────────────────────────
  const headerH = 86;
  ctx.save();
  roundedRectTopPath(ctx, cX, cY, cW, headerH, RADIUS);
  ctx.clip();
  const hGrad = ctx.createLinearGradient(cX, 0, cX + cW, 0);
  hGrad.addColorStop(0, "#2563eb");
  hGrad.addColorStop(1, "#1e40af");
  ctx.fillStyle = hGrad;
  ctx.fillRect(cX, cY, cW, headerH);
  ctx.restore();

  // "VERIFIED CLIENT REVIEW" label with shield icon concept
  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.font = "bold 17px sans-serif";
  ctx.fillText("✓  VERIFIED CLIENT REVIEW", cX + 36, cY + 38);

  // Stars in header (right side)
  if (data.rating) {
    const starsW = data.rating * (28 + 6) + (5 - data.rating) * (28 + 6);
    drawStarRow(ctx, data.rating, cX + cW - starsW - 28, cY + 22, 28);
  }

  // ── Body content ─────────────────────────────────────────────────────────────
  const bodyX = cX + 40;
  let curY = cY + headerH + 42;

  // Company name
  ctx.fillStyle = "#1e3a8a";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText(truncate(data.companyName, 38), bodyX, curY);
  curY += 46;

  // Decorative quote
  ctx.fillStyle = "#dbeafe";
  ctx.font = "bold 72px serif";
  ctx.fillText("\u201C", bodyX - 6, curY + 42);

  // Review text
  ctx.fillStyle = "#1e293b";
  ctx.font = "italic 24px sans-serif";
  const quoteMaxW = cW - 90;
  const linesUsed = wrapText(ctx, data.reviewText, bodyX + 48, curY, quoteMaxW, 34, 3);
  curY += linesUsed * 34 + 28;

  // Separator line
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(bodyX, curY, cW - 80, 1.5);
  curY += 18;

  // Reviewer name + company
  ctx.fillStyle = "#111827";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(data.clientName, bodyX, curY);
  if (data.clientCompany) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "18px sans-serif";
    ctx.fillText(data.clientCompany, bodyX, curY + 26);
    curY += 26;
  }
  curY += 32;

  // Meta: service date · location · employee
  const metaParts: string[] = [];
  if (data.workDate) metaParts.push(`\uD83D\uDCC5  ${fmtDate(data.workDate)}`);
  if (data.locationName) metaParts.push(`\uD83D\uDCCD  ${data.locationName}`);
  if (data.employeeName) metaParts.push(`\uD83D\uDC64  Completed by ${data.employeeName}`);
  if (metaParts.length > 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px sans-serif";
    ctx.fillText(metaParts.join("    "), bodyX, curY);
    curY += 26;
  }

  // ── Footer bar ───────────────────────────────────────────────────────────────
  const footerY = cY + cH - 46;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(cX, footerY, cW, 46);

  // Footer divider
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(cX, footerY, cW, 1);

  // Footer text
  ctx.fillStyle = "#10b981";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText("Verified by ClockField.com  \u00B7  Submitted through completed service report", bodyX, footerY + 28);

  return canvas.toBuffer("image/png");
}
