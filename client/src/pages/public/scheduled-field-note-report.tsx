import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertCircle, Camera, ClipboardCheck, Building2, ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

type PublicStep = {
  id: string; title: string; description: string;
  referenceImageUrl: string | null; isRequired: boolean; sortOrder: number;
  submission: { id: string; submittedImageUrl: string; submittedAt: string } | null;
};
type PublicReport = {
  companyName: string; companyLogo: string | null;
  templateName: string; introText: string; outroText: string;
  clientName: string | null; cleanerName: string | null;
  submissionDate: string; status: string;
  startedAt: string; completedAt: string | null;
  totalSteps: number; completedSteps: number;
  sections: { id: string; title: string; sortOrder: number; steps: PublicStep[] }[];
};
type LightboxImg = { src: string; label: string; sublabel?: string };

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ images, initialIndex, onClose }: {
  images: LightboxImg[]; initialIndex: number; onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const img = images[idx];
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && idx > 0) setIdx(i => i - 1);
      if (e.key === "ArrowRight" && idx < images.length - 1) setIdx(i => i + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, images.length, onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
        <img src={img.src} alt={img.label} className="w-full max-h-[85vh] object-contain rounded-xl" />
        <button onClick={onClose} className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"><X className="w-4 h-4" /></button>
        {idx > 0 && <button onClick={() => setIdx(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2"><ChevronLeft className="w-5 h-5" /></button>}
        {idx < images.length - 1 && <button onClick={() => setIdx(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2"><ChevronRight className="w-5 h-5" /></button>}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 rounded-b-xl p-4">
          <p className="text-white text-sm font-medium">{img.label}</p>
          {img.sublabel && <p className="text-white/70 text-xs mt-0.5">{img.sublabel}</p>}
        </div>
        {images.length > 1 && <div className="absolute bottom-4 right-4 text-white/50 text-xs">{idx + 1} / {images.length}</div>}
      </div>
    </div>
  );
}

export default function PublicScheduledFieldNoteReport() {
  const [, params] = useRoute("/public/scheduled-field-notes/:publicId");
  const publicId = params?.publicId || "";
  const [lightbox, setLightbox] = useState<{ images: LightboxImg[]; index: number } | null>(null);

  const { data: report, isLoading, isError } = useQuery<PublicReport>({
    queryKey: ["/api/public/scheduled-field-notes", publicId],
    queryFn: () => fetch(`/api/public/scheduled-field-notes/${publicId}`).then(r => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    }),
    enabled: !!publicId,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Report Not Found</h1>
          <p className="text-muted-foreground text-sm">This report is not available or the link has been disabled.</p>
        </div>
      </div>
    );
  }

  const allSteps = report.sections.flatMap(s => s.steps);
  const completedCount = allSteps.filter(s => s.submission).length;
  const totalCount = allSteps.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Build a flat gallery for lightbox navigation across entire report
  const allImages: LightboxImg[] = report.sections.flatMap(section =>
    section.steps.flatMap(step => {
      const imgs: LightboxImg[] = [];
      if (step.referenceImageUrl) imgs.push({ src: step.referenceImageUrl, label: step.title, sublabel: `${section.title} — Reference` });
      if (step.submission?.submittedImageUrl) imgs.push({ src: step.submission.submittedImageUrl, label: step.title, sublabel: `${section.title} — Submitted ${format(parseISO(step.submission.submittedAt), "h:mm a")}` });
      return imgs;
    })
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {lightbox && <Lightbox images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />}

      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
          <div className="flex items-start gap-4">
            {report.companyLogo ? (
              <img src={report.companyLogo} alt={report.companyName} className="w-14 h-14 rounded-xl object-cover border shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{report.companyName}</p>
              <h1 className="text-xl md:text-2xl font-bold mt-0.5">{report.templateName}</h1>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                <span>📅 {format(parseISO(report.submissionDate), "MMMM d, yyyy")}</span>
                {report.clientName && <span>📍 {report.clientName}</span>}
                {report.cleanerName && <span>👤 {report.cleanerName}</span>}
              </div>
            </div>
            <div className={cn("shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold", report.status === "completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")}>
              {report.status === "completed" ? "✓ Complete" : "In Progress"}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">{completedCount} of {totalCount} steps completed</span>
              <span className={cn("font-semibold", report.status === "completed" ? "text-green-600" : "text-blue-600")}>{progressPct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className={cn("h-full rounded-full transition-all", report.status === "completed" ? "bg-green-500" : "bg-blue-500")} style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {report.introText && (
            <p className="mt-4 text-sm text-muted-foreground bg-gray-50 rounded-xl p-4 border leading-relaxed">
              {report.introText}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-3">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Steps</p>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{completedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Completed</p>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-sm font-semibold text-foreground">{report.startedAt ? format(parseISO(report.startedAt), "h:mm a") : "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Started</p>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-sm font-semibold text-foreground">{report.completedAt ? format(parseISO(report.completedAt), "h:mm a") : "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Completed</p>
          </div>
        </div>

        {/* Sections */}
        {(report.sections || []).sort((a, b) => a.sortOrder - b.sortOrder).map(section => {
          const steps = (section.steps || []).sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <div key={section.id} className="bg-white rounded-2xl border overflow-hidden">
              <div className="px-5 py-4 border-b bg-gray-50">
                <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{section.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{steps.filter(s => s.submission).length} / {steps.length} completed</p>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {steps.map((step, idx) => {
                    const refImgGlobal = allImages.findIndex(i => i.sublabel?.includes(section.title) && i.sublabel?.includes("Reference") && i.label === step.title);
                    const subImgGlobal = allImages.findIndex(i => i.sublabel?.includes(section.title) && i.sublabel?.includes("Submitted") && i.label === step.title);
                    return (
                      <div key={step.id} className={cn("border rounded-xl overflow-hidden", step.submission ? "border-green-100" : "border-gray-100")}>
                        {/* Card header */}
                        <div className="px-3 py-2.5 border-b bg-gray-50/50">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold", step.submission ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                              {step.submission ? <CheckCircle2 className="w-3 h-3" /> : idx + 1}
                            </div>
                            <p className="text-xs font-semibold flex-1 line-clamp-1">{step.title}</p>
                          </div>
                          {step.description && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{step.description}</p>}
                        </div>

                        {/* Reference photo */}
                        {step.referenceImageUrl ? (
                          <div
                            className="relative cursor-pointer group border-b"
                            style={{ aspectRatio: "9/16" }}
                            onClick={() => setLightbox({ images: allImages, index: refImgGlobal >= 0 ? refImgGlobal : 0 })}
                          >
                            <img src={step.referenceImageUrl} alt="Reference" className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 p-2">
                              <p className="text-white text-[10px] font-medium">Reference</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center bg-gray-50 text-gray-300 border-b" style={{ aspectRatio: "9/16" }}>
                            <div className="text-center">
                              <Camera className="w-6 h-6 mx-auto mb-1" />
                              <p className="text-[9px]">No reference</p>
                            </div>
                          </div>
                        )}

                        {/* Submitted photo */}
                        {step.submission?.submittedImageUrl ? (
                          <div
                            className="relative cursor-pointer group"
                            style={{ aspectRatio: "9/16" }}
                            onClick={() => setLightbox({ images: allImages, index: subImgGlobal >= 0 ? subImgGlobal : 0 })}
                          >
                            <img src={step.submission.submittedImageUrl} alt="Submitted" className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 p-2">
                              <p className="text-white text-[10px] font-medium">Submitted</p>
                              <p className="text-white/70 text-[9px]">{format(parseISO(step.submission.submittedAt), "h:mm a")}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center bg-gray-50 text-gray-300" style={{ aspectRatio: "9/16" }}>
                            <div className="text-center">
                              <Camera className="w-5 h-5 mx-auto mb-1" />
                              <p className="text-[9px]">Not submitted</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Outro */}
        {report.outroText && (
          <div className="bg-white rounded-2xl p-6 border text-center">
            <ClipboardCheck className="w-8 h-8 text-green-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">{report.outroText}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6 space-y-1">
          <p className="text-xs text-muted-foreground">
            This report was generated by <span className="font-medium">{report.companyName}</span> using Clockfield Scheduled Notes.
          </p>
          <p className="text-xs text-muted-foreground">
            Documentation of daily cleaning completion and proof of work.
          </p>
        </div>
      </div>
    </div>
  );
}
