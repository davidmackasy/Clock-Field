import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertCircle, Camera, ClipboardCheck, Building2, ChevronLeft, ChevronRight, X } from "lucide-react";
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

// ─── Lightbox — 9:16 preview for full-size view ───────────────────────────────
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
    <div className="fixed inset-0 z-50 bg-black/94 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative flex flex-col items-center" onClick={e => e.stopPropagation()}>
        {/* Full-size photo — object-contain, no cropping */}
        <img src={img.src} alt={img.label} className="max-h-[85vh] max-w-[90vw] w-auto object-contain rounded-xl" />
        <button onClick={onClose} className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors">
          <X className="w-4 h-4" />
        </button>
        {idx > 0 && (
          <button onClick={() => setIdx(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {idx < images.length - 1 && (
          <button onClick={() => setIdx(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2">
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        <div className="mt-3 text-center">
          <p className="text-white text-sm font-medium">{img.label}</p>
          {img.sublabel && <p className="text-white/60 text-xs mt-0.5">{img.sublabel}</p>}
          {images.length > 1 && <p className="text-white/40 text-xs mt-1">{idx + 1} / {images.length}</p>}
        </div>
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
          <Skeleton className="h-24 rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
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
          <p className="text-muted-foreground text-sm">This report is unavailable or the link has been disabled.</p>
        </div>
      </div>
    );
  }

  // ─── Count from actual step submissions (fix completion count bug) ───────────
  const allSteps = report.sections.flatMap(s => s.steps);
  const submittedCount = allSteps.filter(s => s.submission?.submittedImageUrl).length;
  const totalCount = allSteps.length;
  const progressPct = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;

  // Build gallery of submitted photos only (for public report — no reference photos)
  const sectionGalleries = new Map<string, LightboxImg[]>();
  for (const section of report.sections) {
    const imgs: LightboxImg[] = section.steps
      .filter(s => s.submission?.submittedImageUrl)
      .map(s => ({
        src: s.submission!.submittedImageUrl,
        label: s.title,
        sublabel: `${section.title} · ${format(parseISO(s.submission!.submittedAt), "h:mm a")}`,
      }));
    sectionGalleries.set(section.id, imgs);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {lightbox && <Lightbox images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />}

      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-5">
          <div className="flex items-start gap-4">
            {report.companyLogo ? (
              <img src={report.companyLogo} alt={report.companyName} className="w-12 h-12 rounded-xl object-cover border shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{report.companyName}</p>
              <h1 className="text-lg md:text-xl font-bold mt-0.5 leading-tight">{report.templateName}</h1>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                <span>📅 {format(parseISO(report.submissionDate), "MMMM d, yyyy")}</span>
                {report.clientName && <span>📍 {report.clientName}</span>}
                {report.cleanerName && <span>👤 {report.cleanerName}</span>}
              </div>
            </div>
            <div className={cn("shrink-0 px-3 py-1 rounded-full text-sm font-semibold", report.status === "completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")}>
              {report.status === "completed" ? "✓ Complete" : "In Progress"}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">{submittedCount} of {totalCount} steps completed</span>
              <span className={cn("font-semibold", report.status === "completed" ? "text-green-600" : "text-blue-600")}>{progressPct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className={cn("h-full rounded-full transition-all", report.status === "completed" ? "bg-green-500" : "bg-blue-500")}
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {report.introText && (
            <p className="mt-3 text-sm text-muted-foreground bg-gray-50 rounded-lg p-3 border leading-relaxed">{report.introText}</p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 space-y-3">
        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-xl font-bold text-primary">{totalCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Steps</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-xl font-bold text-green-600">{submittedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-sm font-semibold">{report.startedAt ? format(parseISO(report.startedAt), "h:mm a") : "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Started</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-sm font-semibold">{report.completedAt ? format(parseISO(report.completedAt), "h:mm a") : "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Completed At</p>
          </div>
        </div>

        {/* Sections — submitted photos only, compact grid */}
        {(report.sections || []).sort((a, b) => a.sortOrder - b.sortOrder).map(section => {
          const steps = (section.steps || []).sort((a, b) => a.sortOrder - b.sortOrder);
          const gallery = sectionGalleries.get(section.id) || [];
          const submittedSteps = steps.filter(s => s.submission?.submittedImageUrl);

          return (
            <div key={section.id} className="bg-white rounded-2xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-sm">{section.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{submittedSteps.length} of {steps.length} completed</p>
                </div>
                {submittedSteps.length === steps.length && steps.length > 0 && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                )}
              </div>

              <div className="p-3">
                {submittedSteps.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No photos submitted for this section</p>
                ) : (
                  /* Compact submitted-photo grid */
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                    {steps.map((step, stepIdx) => {
                      if (!step.submission?.submittedImageUrl) {
                        // Show placeholder for not-yet-submitted required steps
                        if (!step.isRequired) return null;
                        return (
                          <div key={step.id} className="min-w-0">
                            <div className="aspect-square rounded-lg bg-gray-100 border border-dashed border-gray-200 flex items-center justify-center">
                              <Camera className="w-3 h-3 text-gray-300" />
                            </div>
                            <p className="text-[9px] text-muted-foreground truncate mt-0.5">{step.title}</p>
                          </div>
                        );
                      }
                      const galleryIdx = gallery.findIndex(img => img.label === step.title);
                      return (
                        <div key={step.id} className="group cursor-pointer min-w-0"
                          onClick={() => setLightbox({ images: gallery, index: galleryIdx >= 0 ? galleryIdx : 0 })}>
                          <div className="relative aspect-square rounded-lg overflow-hidden border border-green-100 group-hover:border-primary/40 transition-all group-hover:shadow-sm">
                            <img src={step.submission.submittedImageUrl} alt={step.title} className="absolute inset-0 w-full h-full object-cover" />
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                            {/* Completion dot */}
                            <div className="absolute bottom-0.5 right-0.5">
                              <CheckCircle2 className="w-3 h-3 text-green-500 drop-shadow" />
                            </div>
                          </div>
                          <p className="text-[10px] font-medium truncate mt-0.5 leading-tight" title={step.title}>{step.title}</p>
                          <p className="text-[9px] text-muted-foreground">{format(parseISO(step.submission.submittedAt), "h:mm a")}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Outro */}
        {report.outroText && (
          <div className="bg-white rounded-2xl p-5 border text-center">
            <ClipboardCheck className="w-7 h-7 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">{report.outroText}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-5 space-y-1">
          <p className="text-xs text-muted-foreground">
            Report generated by <span className="font-medium">{report.companyName}</span>
          </p>
          <p className="text-xs text-muted-foreground">Powered by Clockfield · Proof of work documentation</p>
        </div>
      </div>
    </div>
  );
}
