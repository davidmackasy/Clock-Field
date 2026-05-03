/**
 * Training Hub certificate export.
 * Renders a clean, fixed-size A4-landscape certificate into an off-screen DOM
 * node, snapshots it with html2canvas, and triggers a PNG download. This
 * intentionally avoids window.print() so the output never picks up the
 * browser's print chrome (timestamp, page URL, "about:blank", page numbers).
 */
export type CertificateExportInput = {
  name: string;
  courseTitle: string;
  certificateCode: string;
  issuedAt: string | Date;
  companyName?: string;
};

const CERT_W = 1123;
const CERT_H = 794;

function buildCertificateNode(input: CertificateExportInput): HTMLDivElement {
  const issued = typeof input.issuedAt === "string" ? new Date(input.issuedAt) : input.issuedAt;
  const dateStr = issued.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const company = input.companyName?.trim() || "ClockField Training";

  const wrap = document.createElement("div");
  wrap.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${CERT_W}px`,
    `height:${CERT_H}px`,
    "background:#fff",
    "font-family:Georgia, 'Times New Roman', serif",
    "z-index:-1",
    "pointer-events:none",
  ].join(";");

  wrap.innerHTML = `
    <div style="
      width:100%;height:100%;box-sizing:border-box;padding:32px;
      background:linear-gradient(135deg,#eff6ff 0%,#fff 50%,#eff6ff 100%);
    ">
      <div style="
        width:100%;height:100%;box-sizing:border-box;
        border:8px solid #1e40af;border-radius:14px;
        padding:48px 72px;display:flex;flex-direction:column;
        align-items:center;justify-content:space-between;text-align:center;
      ">
        <div>
          <div style="color:#1e40af;font-size:14px;text-transform:uppercase;letter-spacing:4px;font-weight:600;">Certificate of Completion</div>
          <div style="font-size:40px;color:#1e3a8a;font-style:italic;margin:18px 0 6px;">This is to certify that</div>
        </div>
        <div style="width:100%;">
          <div style="font-size:54px;color:#111827;font-style:italic;border-bottom:2px solid #1e40af;padding:0 60px 6px;display:inline-block;">${escapeHtml(input.name)}</div>
          <div style="font-size:16px;color:#6b7280;margin-top:14px;">has successfully completed the training course</div>
          <div style="font-size:26px;color:#1e40af;font-weight:bold;margin-top:10px;">${escapeHtml(input.courseTitle)}</div>
          <div style="font-size:14px;color:#6b7280;margin-top:8px;">Completed on ${dateStr}</div>
        </div>
        <div style="width:100%;border-top:1px solid #e5e7eb;padding-top:14px;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:22px;font-weight:bold;color:#1e40af;">${escapeHtml(company)}</div>
          <div style="font-family:'Courier New', monospace;font-size:12px;color:#9ca3af;">Certificate ID: ${escapeHtml(input.certificateCode)}</div>
        </div>
      </div>
    </div>
  `;
  return wrap;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function downloadCertificate(input: CertificateExportInput): Promise<void> {
  const html2canvas = (await import("html2canvas")).default;
  const node = buildCertificateNode(input);
  document.body.appendChild(node);
  try {
    const canvas = await html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      width: CERT_W,
      height: CERT_H,
      windowWidth: CERT_W,
      windowHeight: CERT_H,
      useCORS: true,
      logging: false,
    });
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Failed to generate certificate image");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Certificate-${input.certificateCode}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    node.remove();
  }
}
