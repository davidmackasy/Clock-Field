import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle, Building2, ChevronLeft, ChevronRight,
  X, ChevronDown, ChevronUp, ImageIcon, MapPin, User, Clock,
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
  const [visible, setVisible] = useState(false);
  const img = images[idx];

  useEffect(() => {
    // Trigger fade-in after mount
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 180);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft" && idx > 0) setIdx(i => i - 1);
      if (e.key === "ArrowRight" && idx < images.length - 1) setIdx(i => i + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, images.length, close]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0"
      )}
      style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.88)" }}
      onClick={close}
    >
      {/* Close — top-right OUTSIDE the image */}
      <button
        onClick={close}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all hover:scale-110"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Previous — fixed to viewport left, vertically centered */}
      {idx > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setIdx(i => i - 1); }}
          className="fixed left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all hover:scale-110"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Next — fixed to viewport right, vertically centered */}
      {idx < images.length - 1 && (
        <button
          onClick={e => { e.stopPropagation(); setIdx(i => i + 1); }}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all hover:scale-110"
          aria-label="Next photo"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Image — no UI overlapping it */}
      <div
        className="relative max-w-3xl w-full flex flex-col items-center px-16"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={img.src}
          alt={img.label}
          className="max-h-[78vh] max-w-full w-auto object-contain rounded-2xl shadow-2xl"
          style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}
        />
        {/* Caption below image */}
        <div className="mt-5 text-center">
          <p className="text-white font-semibold text-sm tracking-wide">{img.label}</p>
          {img.sublabel && (
            <p className="text-white/50 text-xs mt-1">{img.sublabel}</p>
          )}
          {images.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setIdx(i); }}
                  className={cn(
                    "rounded-full transition-all",
                    i === idx ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30 hover:bg-white/60"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Area Card ───────────────────────────────────────────────────────────────
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
        "group w-full rounded-2xl overflow-hidden bg-white text-left transition-all duration-200",
        "shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
        "hover:-translate-y-0.5",
        isOpen && "ring-2 ring-blue-500/30 shadow-[0_8px_24px_rgba(0,0,0,0.12)] -translate-y-0.5"
      )}
    >
      {/* Thumbnail with overlays */}
      <div className="relative w-full aspect-[4/3] bg-gray-100 overflow-hidden">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={section.title}
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <ImageIcon className="w-8 h-8 text-gray-200" />
          </div>
        )}

        {/* Bottom gradient for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Photo count badge — top right */}
        <div className="absolute top-2.5 right-2.5 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full leading-none">
          {photoCount} {photoCount === 1 ? "photo" : "photos"}
        </div>

        {/* Area name — bottom left over gradient */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 pt-6">
          <p className="font-bold text-white text-sm leading-tight drop-shadow truncate">
            {section.title}
          </p>
          {timeRange && (
            <p className="text-white/70 text-[11px] mt-0.5 leading-tight">{timeRange}</p>
          )}
        </div>

        {/* Open/close chevron bottom right */}
        <div className={cn(
          "absolute bottom-2.5 right-2.5 rounded-full p-1 transition-all duration-200",
          isOpen ? "bg-white text-gray-800 rotate-0" : "bg-white/20 text-white"
        )}>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
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
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-40 rounded-3xl" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Report Not Found</h1>
          <p className="text-gray-400 text-sm">This report is unavailable or the link has been disabled.</p>
        </div>
      </div>
    );
  }

  // Build per-section data
  const sortedSections = [...(report.sections || [])].sort((a, b) => a.sortOrder - b.sortOrder);

  type SectionData = {
    id: string; title: string; sortOrder: number;
    photos: { src: string; label: string; time: string }[];
    thumbnailSrc: string | null; timeRange: string | null;
  };

  const sectionData: SectionData[] = sortedSections.map(section => {
    const submitted = [...(section.steps || [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter(s => s.submission?.submittedImageUrl);
    const photos = submitted.map((s, photoIdx) => ({
      src: s.submission!.submittedImageUrl,
      label: s.title.includes(" - ")
        ? s.title.split(" - ").slice(1).join(" - ")
        : `Photo ${photoIdx + 1}`,
      time: format(parseISO(s.submission!.submittedAt), "h:mm a"),
    }));
    const thumbnailSrc = photos[0]?.src || null;
    let timeRange: string | null = null;
    if (photos.length > 0) {
      const first = photos[0].time;
      const last = photos[photos.length - 1].time;
      timeRange = first === last ? first : `${first} – ${last}`;
    }
    return { id: section.id, title: section.title, sortOrder: section.sortOrder, photos, thumbnailSrc, timeRange };
  }).filter(s => s.photos.length > 0);

  const startedLabel = report.startedAt ? format(parseISO(report.startedAt), "h:mm a") : null;
  const completedLabel = report.completedAt ? format(parseISO(report.completedAt), "h:mm a") : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {lightbox && (
        <Lightbox images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="max-w-4xl mx-auto px-5 md:px-10 py-7">
          <div className="flex items-start gap-5">
            {/* Logo */}
            <div className="shrink-0">
              {report.companyLogo ? (
                <img src={report.companyLogo} alt={report.companyName}
                  className="w-14 h-14 rounded-2xl object-cover shadow-sm border border-gray-100" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shadow-sm">
                  <Building2 className="w-7 h-7 text-gray-400" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Company name label */}
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                {report.companyName}
              </p>
              {/* Job / template name — big bold title */}
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight tracking-tight">
                {report.templateName}
              </h1>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
                <span className="text-sm text-gray-500 font-medium">
                  {format(parseISO(report.submissionDate), "MMMM d, yyyy")}
                </span>
                {report.clientName && (
                  <span className="flex items-center gap-1 text-sm text-gray-500">
                    <MapPin className="w-3.5 h-3.5 text-red-400" />
                    {report.clientName}
                  </span>
                )}
                {report.cleanerName && (
                  <span className="flex items-center gap-1 text-sm text-gray-500">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    {report.cleanerName}
                  </span>
                )}
              </div>

              {/* Timing row */}
              {(startedLabel || completedLabel) && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-1.5">
                  {startedLabel && (
                    <span className="flex items-center gap-1.5 text-sm text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      Started: <span className="font-semibold text-gray-700">{startedLabel}</span>
                    </span>
                  )}
                  {completedLabel && (
                    <span className="flex items-center gap-1.5 text-sm text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      Completed: <span className="font-semibold text-gray-700">{completedLabel}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Status pill */}
            <div className={cn(
              "shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold leading-none",
              report.status === "completed"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                : "bg-blue-50 text-blue-600 border border-blue-100"
            )}>
              {report.status === "completed" ? "✓ Complete" : "In Progress"}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 md:px-10 py-10 space-y-10">

        {/* ── Intro — NO box, just clean text ─────────────────────────────── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-2">
            Daily Proof of Work
          </p>
          <p className="text-[15px] text-gray-500 leading-relaxed max-w-2xl">
            {report.introText && report.introText.trim()
              ? report.introText
              : "This report shows the completed scheduled field note photos for this location. Select an area below to view the photos taken for that section."}
          </p>
        </div>

        {/* ── Area grid ──────────────────────────────────────────────────────── */}
        {sectionData.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 text-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <ImageIcon className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">No photos have been submitted for this report yet.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Grid of area cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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

            {/* Expandable galleries — below grid, in order */}
            {sectionData.map(section => {
              if (!openSections.has(section.id)) return null;
              const lightboxImgs: LightboxImg[] = section.photos.map(p => ({
                src: p.src,
                label: p.label,
                sublabel: `${section.title} · ${p.time}`,
              }));
              return (
                <div
                  key={`gallery-${section.id}`}
                  className="rounded-3xl bg-white overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                  style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.07)" }}
                >
                  {/* Gallery header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                    <div>
                      <h2 className="font-bold text-gray-900 text-base">{section.title}</h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {section.photos.length} {section.photos.length === 1 ? "photo" : "photos"}
                        {section.timeRange ? ` · ${section.timeRange}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors px-3 py-1.5 rounded-xl hover:bg-gray-50 font-medium"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      Close
                    </button>
                  </div>

                  {/* Photo grid */}
                  <div className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {section.photos.map((photo, photoIdx) => (
                      <button
                        key={photoIdx}
                        onClick={() => setLightbox({ images: lightboxImgs, index: photoIdx })}
                        className="group text-left w-full"
                      >
                        <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 transition-all duration-200 group-hover:-translate-y-0.5"
                          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                        >
                          <img
                            src={photo.src}
                            alt={photo.label}
                            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
                          />
                          {/* Hover overlay with zoom hint */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-2">
                              <ChevronRight className="w-4 h-4 text-white rotate-45" />
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] font-semibold mt-1.5 truncate leading-tight text-gray-700" title={photo.label}>
                          {photo.label}
                        </p>
                        <p className="text-[10px] text-gray-400">{photo.time}</p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Outro (custom message) ────────────────────────────────────── */}
        {report.outroText && (
          <div className="text-center py-2">
            <p className="text-[15px] text-gray-500 leading-relaxed max-w-md mx-auto">
              {report.outroText}
            </p>
          </div>
        )}

        {/* ── Questions — NO box, just clean centered text ─────────────── */}
        <div className="text-center py-2">
          <p className="text-sm font-semibold text-gray-700 mb-1">Questions or concerns?</p>
          <p className="text-sm text-gray-400 max-w-sm mx-auto leading-relaxed">
            Please contact the service provider directly if you have any questions about this report.
          </p>
        </div>

        {/* ── Footer — single line only ─────────────────────────────────── */}
        <div className="text-center pb-6">
          <p className="text-xs text-gray-300">
            Powered by{" "}
            <a
              href="https://clockfield.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600 transition-colors font-medium"
            >
              Clockfield
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
