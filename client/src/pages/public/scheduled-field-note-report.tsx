import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle, Building2, ChevronLeft, ChevronRight,
  X, ChevronDown, ChevronUp, ImageIcon,
} from "lucide-react";
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

// ─── Lightbox ────────────────────────────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative flex flex-col items-center max-w-3xl w-full" onClick={e => e.stopPropagation()}>
        <img src={img.src} alt={img.label}
          className="max-h-[80vh] max-w-full w-auto object-contain rounded-xl shadow-2xl" />
        <button onClick={onClose}
          className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors">
          <X className="w-4 h-4" />
        </button>
        {idx > 0 && (
          <button onClick={() => setIdx(i => i - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {idx < images.length - 1 && (
          <button onClick={() => setIdx(i => i + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        <div className="mt-4 text-center">
          <p className="text-white font-medium text-sm">{img.label}</p>
          {img.sublabel && <p className="text-white/50 text-xs mt-0.5">{img.sublabel}</p>}
          {images.length > 1 && (
            <p className="text-white/30 text-xs mt-1">{idx + 1} / {images.length}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Area card in thumbnail grid ──────────────────────────────────────────────
function AreaCard({ section, photoCount, thumbnailSrc, timeRange, isOpen, onToggle }: {
  section: { id: string; title: string };
  photoCount: number;
  thumbnailSrc: string | null;
  timeRange: string | null;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "group w-full rounded-2xl overflow-hidden border bg-white shadow-sm hover:shadow-md transition-all duration-200 text-left",
        isOpen && "ring-2 ring-primary/40 shadow-md"
      )}
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-[4/3] bg-gray-100 overflow-hidden">
        {thumbnailSrc ? (
          <img src={thumbnailSrc} alt={section.title}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-300" />
          </div>
        )}
        {/* Photo count badge */}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2 py-0.5 rounded-full">
          {photoCount} {photoCount === 1 ? "photo" : "photos"}
        </div>
        {/* Expand indicator */}
        <div className={cn(
          "absolute bottom-2 right-2 rounded-full p-1 transition-all",
          isOpen ? "bg-primary text-white" : "bg-white/80 text-gray-600"
        )}>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </div>
      {/* Card footer */}
      <div className="px-3 py-2.5">
        <p className="font-semibold text-sm leading-tight truncate">{section.title}</p>
        {timeRange && (
          <p className="text-xs text-muted-foreground mt-0.5">{timeRange}</p>
        )}
      </div>
    </button>
  );
}

export default function PublicScheduledFieldNoteReport() {
  const [, params] = useRoute("/public/scheduled-field-notes/:publicId");
  const publicId = params?.publicId || "";
  const [lightbox, setLightbox] = useState<{ images: LightboxImg[]; index: number } | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const { data: report, isLoading, isError } = useQuery<PublicReport>({
    queryKey: ["/api/public/scheduled-field-notes", publicId],
    queryFn: () => fetch(`/api/public/scheduled-field-notes/${publicId}`).then(r => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    }),
    enabled: !!publicId,
    retry: false,
  });

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />)}
          </div>
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

  // Build per-section data
  const sortedSections = [...(report.sections || [])].sort((a, b) => a.sortOrder - b.sortOrder);

  type SectionData = {
    id: string;
    title: string;
    sortOrder: number;
    photos: { src: string; label: string; time: string }[];
    thumbnailSrc: string | null;
    timeRange: string | null;
  };

  const sectionData: SectionData[] = sortedSections.map(section => {
    const submitted = [...(section.steps || [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter(s => s.submission?.submittedImageUrl);
    const photos = submitted.map(s => ({
      src: s.submission!.submittedImageUrl,
      label: s.title,
      time: format(parseISO(s.submission!.submittedAt), "h:mm a"),
    }));
    const thumbnailSrc = photos[0]?.src || null;
    // Time range for the section
    let timeRange: string | null = null;
    if (photos.length > 0) {
      const first = photos[0].time;
      const last = photos[photos.length - 1].time;
      timeRange = first === last ? first : `${first} – ${last}`;
    }
    return { id: section.id, title: section.title, sortOrder: section.sortOrder, photos, thumbnailSrc, timeRange };
  }).filter(s => s.photos.length > 0); // only show sections that have photos

  const startedLabel = report.startedAt ? format(parseISO(report.startedAt), "h:mm a") : null;
  const completedLabel = report.completedAt ? format(parseISO(report.completedAt), "h:mm a") : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {lightbox && (
        <Lightbox images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
          <div className="flex items-start gap-4">
            {/* Logo / icon */}
            {report.companyLogo ? (
              <img src={report.companyLogo} alt={report.companyName}
                className="w-14 h-14 rounded-2xl object-cover border shrink-0 shadow-sm" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {report.companyName}
              </p>
              <h1 className="text-xl md:text-2xl font-bold mt-0.5 leading-tight">
                {report.templateName}
              </h1>

              {/* Meta row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                <span>{format(parseISO(report.submissionDate), "MMMM d, yyyy")}</span>
                {report.clientName && <span>📍 {report.clientName}</span>}
                {report.cleanerName && <span>Completed by: {report.cleanerName}</span>}
              </div>

              {/* Timing row */}
              {(startedLabel || completedLabel) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm">
                  {startedLabel && (
                    <span className="text-muted-foreground">
                      Started: <span className="font-medium text-foreground">{startedLabel}</span>
                    </span>
                  )}
                  {completedLabel && (
                    <span className="text-muted-foreground">
                      Completed: <span className="font-medium text-foreground">{completedLabel}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Status badge */}
            <div className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold",
              report.status === "completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
            )}>
              {report.status === "completed" ? "✓ Complete" : "In Progress"}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">

        {/* ── Intro ──────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
            Daily Proof of Work
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {report.introText && report.introText.trim()
              ? report.introText
              : `This report shows the completed scheduled field note photos for this location. Select an area below to view the photos taken for that section.`}
          </p>
        </div>

        {/* ── Area grid ──────────────────────────────────────────────────────── */}
        {sectionData.length === 0 ? (
          <div className="bg-white rounded-2xl border p-10 text-center text-muted-foreground shadow-sm">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No photos have been submitted for this report yet.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Grid of area cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {sectionData.map(section => (
                <AreaCard
                  key={section.id}
                  section={section}
                  photoCount={section.photos.length}
                  thumbnailSrc={section.thumbnailSrc}
                  timeRange={section.timeRange}
                  isOpen={openSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                />
              ))}
            </div>

            {/* Expandable photo galleries — shown below the grid in order */}
            {sectionData.map(section => {
              if (!openSections.has(section.id)) return null;
              const lightboxImgs: LightboxImg[] = section.photos.map(p => ({
                src: p.src,
                label: p.label,
                sublabel: `${section.title} · ${p.time}`,
              }));
              return (
                <div key={`gallery-${section.id}`}
                  className="bg-white rounded-2xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Gallery header */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
                    <div>
                      <h2 className="font-semibold text-sm">{section.title}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {section.photos.length} {section.photos.length === 1 ? "photo" : "photos"}
                        {section.timeRange ? ` · ${section.timeRange}` : ""}
                      </p>
                    </div>
                    <button onClick={() => toggleSection(section.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-gray-100">
                      <ChevronUp className="w-3.5 h-3.5" />
                      Close
                    </button>
                  </div>

                  {/* Photo grid */}
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {section.photos.map((photo, photoIdx) => (
                      <button
                        key={photoIdx}
                        onClick={() => setLightbox({ images: lightboxImgs, index: photoIdx })}
                        className="group text-left w-full"
                      >
                        <div className="relative aspect-square rounded-xl overflow-hidden border border-gray-100 shadow-sm group-hover:shadow-md group-hover:border-primary/30 transition-all duration-200">
                          <img src={photo.src} alt={photo.label}
                            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300" />
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors" />
                          {/* Expand hint */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-black/50 rounded-full p-2">
                              <ChevronRight className="w-4 h-4 text-white rotate-45" />
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] font-medium mt-1.5 truncate leading-tight text-foreground"
                          title={photo.label}>{photo.label}</p>
                        <p className="text-[10px] text-muted-foreground">{photo.time}</p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Outro ──────────────────────────────────────────────────────────── */}
        {report.outroText && (
          <div className="bg-white rounded-2xl border p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              {report.outroText}
            </p>
          </div>
        )}

        {/* ── Support message ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border p-5 shadow-sm text-center">
          <p className="text-sm font-medium mb-1">Questions or concerns?</p>
          <p className="text-sm text-muted-foreground">
            Please contact the service provider directly if you have any questions about this report.
          </p>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="text-center py-4 space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Report generated by <span className="font-medium">{report.companyName}</span>
          </p>
          <p className="text-xs text-muted-foreground">Powered by Clockfield · Proof of work documentation</p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">Generated using Clockfield</p>
        </div>
      </div>
    </div>
  );
}
