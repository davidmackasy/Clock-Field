import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  NotebookPen, MapPin, Clock, User, AlertTriangle, X,
  Building2, DollarSign, FileCheck, LayoutList, CheckCircle2,
  XCircle, ChevronDown, Mic, MicOff,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const SESSION_TYPE_LABELS: Record<string, string> = {
  site_visit: "Site Visit", inspection: "Inspection", pre_clean: "Pre-Clean",
  post_clean: "Post-Clean", damage_report: "Damage Report", maintenance: "Maintenance",
};

const VISIT_TYPE_LABELS: Record<string, string> = {
  site_visit: "Site Visit",
  cleaning_walkthrough: "Cleaning Walkthrough",
  inspection: "Inspection",
  before_service: "Pre-Service",
  after_service: "Post-Service",
  progress_update: "Progress Update",
  maintenance_check: "Maintenance Check",
  client_update: "Client Update",
};

function parseBullets(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : null; } catch { return null; }
}

function parseQuoteData(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// ── Quote accept/decline panel ─────────────────────────────────────────────
const DECLINE_REASONS = [
  "Too expensive", "Not needed right now", "Need fewer services",
  "Need more services", "Went with another provider", "Other",
];

function QuoteResponsePanel({ token, status, onDone }: {
  token: string; status?: string; onDone: (s: string) => void;
}) {
  const [view, setView] = useState<"idle" | "decline" | "accepted" | "declined">(
    status === "accepted" ? "accepted" : status === "declined" ? "declined" : "idle"
  );
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: ({ action, reason }: { action: string; reason?: string }) =>
      fetch(`/api/public/field-notes/${token}/quote-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      }).then(async r => {
        if (!r.ok) { const b = await r.json(); throw new Error(b.message || "Failed"); }
        return r.json();
      }),
    onSuccess: (_, vars) => {
      const newStatus = vars.action === "accept" ? "accepted" : "declined";
      setView(newStatus);
      onDone(newStatus);
    },
    onError: (e: any) => setError(e.message),
  });

  const handleDecline = () => {
    const reason = selectedReason === "Other" ? customReason.trim() : selectedReason;
    if (!reason) { setError("Please select or enter a reason."); return; }
    setError("");
    mutation.mutate({ action: "decline", reason });
  };

  if (view === "accepted") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center" data-testid="quote-status-accepted">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
        <p className="text-xl font-bold text-gray-800">Quote Accepted</p>
        <p className="text-sm text-gray-500">Thank you! We'll be in touch shortly to confirm next steps.</p>
      </div>
    );
  }
  if (view === "declined") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center" data-testid="quote-status-declined">
        <XCircle className="w-12 h-12 text-gray-400" />
        <p className="text-xl font-bold text-gray-700">Quote Declined</p>
        <p className="text-sm text-gray-500">We've recorded your response. Feel free to reach out if anything changes.</p>
      </div>
    );
  }
  if (view === "decline") {
    return (
      <div className="space-y-4" data-testid="quote-decline-panel">
        <p className="text-sm font-semibold text-gray-700">Why are you declining this quote?</p>
        <div className="grid grid-cols-2 gap-2">
          {DECLINE_REASONS.map(r => (
            <button
              key={r}
              className={cn(
                "text-left text-sm px-3 py-2 rounded-lg border transition-colors",
                selectedReason === r
                  ? "border-gray-800 bg-gray-800 text-white"
                  : "border-gray-200 hover:border-gray-400 text-gray-700"
              )}
              onClick={() => { setSelectedReason(r); setError(""); }}
              data-testid={`button-decline-reason-${r.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {r}
            </button>
          ))}
        </div>
        {selectedReason === "Other" && (
          <textarea
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-400"
            rows={3}
            placeholder="Please describe your reason…"
            value={customReason}
            onChange={e => { setCustomReason(e.target.value); setError(""); }}
            data-testid="textarea-decline-custom-reason"
          />
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => setView("idle")} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1"
            onClick={handleDecline}
            disabled={mutation.isPending || !selectedReason}
            data-testid="button-confirm-decline"
          >
            {mutation.isPending ? "Submitting…" : "Confirm Decline"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3" data-testid="quote-action-panel">
      <Button
        className="flex-1 w-full sm:w-auto gap-2 bg-green-600 hover:bg-green-700"
        onClick={() => mutation.mutate({ action: "accept" })}
        disabled={mutation.isPending}
        data-testid="button-accept-quote"
      >
        <CheckCircle2 className="w-4 h-4" />
        {mutation.isPending ? "Processing…" : "Accept Quote"}
      </Button>
      <Button
        variant="outline"
        className="flex-1 w-full sm:w-auto gap-2 border-red-200 text-red-600 hover:bg-red-50"
        onClick={() => setView("decline")}
        data-testid="button-decline-quote"
      >
        <XCircle className="w-4 h-4" />
        Decline Quote
      </Button>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </div>
  );
}

// ── Area section with photos ───────────────────────────────────────────────
function AreaSection({ index, title, entries, assets, showTimestamps, onPhotoClick }: {
  index: number;
  title: string;
  entries: any[];
  assets: any[];
  showTimestamps: boolean;
  onPhotoClick: (url: string) => void;
}) {
  // Collect photos for this area — from linked entries OR from area label on assets
  const entryAssetIds = new Set<string>(
    entries.flatMap(e => {
      try { return JSON.parse(e.assetIds || "[]"); } catch { return []; }
    })
  );
  const areaPhotos = assets.filter(a => entryAssetIds.has(a.id));

  // All unique recommended actions from entries in this area
  const notes = entries.map(e => e.recommendedAction || "").filter(Boolean);

  return (
    <section data-testid={`section-area-${index}`} className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold text-gray-400">{index}.</span>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <div className="flex-1 h-px bg-gray-200" />
        {areaPhotos.length > 0 && (
          <span className="text-[10px] text-gray-400">{areaPhotos.length} photo{areaPhotos.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Entry text for the area */}
      {entries.map(e => (
        <div key={e.id}>
          {e.body && <p className="text-sm text-gray-700 leading-relaxed">{e.clientSafeSummary || e.body}</p>}
          {e.recommendedAction && (
            <p className="text-xs text-gray-500 italic mt-1">Note: {e.recommendedAction}</p>
          )}
        </div>
      ))}

      {/* Photos in a responsive grid */}
      {areaPhotos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-1.5">
          {areaPhotos.map((asset: any, i: number) => (
            <div
              key={asset.id}
              data-testid={`img-public-photo-${asset.id}`}
              className="overflow-hidden rounded-lg bg-gray-100 cursor-pointer hover:opacity-95 transition-opacity relative aspect-square"
              onClick={() => onPhotoClick(asset.fileUrl)}
            >
              <img src={asset.fileUrl} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              {showTimestamps && asset.capturedAt && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/55 px-1.5 py-0.5">
                  <span className="text-[9px] text-white">{format(parseISO(asset.capturedAt), "h:mm a")}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Transcript section ─────────────────────────────────────────────────────
function TranscriptSection({ chunks, hasTranscript }: { chunks: any[]; hasTranscript: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const fullText = chunks.map(c => c.rawText || "").join(" ").trim();

  if (!hasTranscript) {
    return (
      <section className="py-5 border-t border-gray-200" data-testid="section-no-transcript">
        <div className="flex items-center gap-2 text-gray-400">
          <MicOff className="w-4 h-4" />
          <span className="text-sm">No audio transcript was recorded for this field note.</span>
        </div>
      </section>
    );
  }

  if (chunks.length === 0) return null;

  return (
    <section className="border-t border-gray-200 pt-5" data-testid="section-transcript">
      <button
        className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 w-full text-left mb-3"
        onClick={() => setExpanded(v => !v)}
      >
        <Mic className="w-4 h-4 text-gray-500" />
        Voice Recording Transcript
        <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform ml-auto", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {chunks.map((chunk, i) => (
            <div key={i} className="flex gap-3">
              {chunk.startedAt && (
                <code className="text-[10px] text-gray-400 font-mono shrink-0 pt-0.5">
                  {format(parseISO(chunk.startedAt), "h:mm:ss a")}
                </code>
              )}
              <p className="text-sm text-gray-600 leading-relaxed">{chunk.rawText}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Main public page ───────────────────────────────────────────────────────
export default function PublicFieldNote() {
  const [, params] = useRoute("/public/field-notes/:token");
  const token = params?.token;
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<string | undefined>(undefined);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/public/field-notes", token],
    queryFn: () => fetch(`/api/public/field-notes/${token}`).then(r => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    }),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-6xl mx-auto space-y-5">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-4 gap-2">
            {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="aspect-square rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-800">Document not found</h1>
          <p className="text-sm text-gray-500 mt-1">This link may have expired or been disabled.</p>
        </div>
      </div>
    );
  }

  const { session, company, entries, assets, transcriptChunks, hasTranscript, publicDoc } = data;
  const docTitle = publicDoc?.title || session?.title || SESSION_TYPE_LABELS[session?.sessionType] || "Field Report";
  const showTimestamps = publicDoc?.showTimestamps ?? false;
  const visitTypeLabel = (session?.visitType && VISIT_TYPE_LABELS[session.visitType]) || SESSION_TYPE_LABELS[session?.sessionType] || "Field Note";
  const sessionType = visitTypeLabel;
  const documentMode = session?.documentMode || "standard";
  const quoteData = parseQuoteData(session?.quoteData);
  const currentQuoteStatus = quoteStatus ?? quoteData.quoteStatus;

  // ── Group entries by area ─────────────────────────────────────────────────
  const areaGroups: Map<string, any[]> = new Map();
  for (const entry of (entries ?? [])) {
    const areaKey = entry.areaName || "General Overview";
    if (!areaGroups.has(areaKey)) areaGroups.set(areaKey, []);
    areaGroups.get(areaKey)!.push(entry);
  }

  // Unlinked photos (not in any entry's assetIds) grouped by area_label from asset
  const linkedAssetIds = new Set<string>(
    (entries ?? []).flatMap((e: any) => {
      try { return JSON.parse(e.assetIds || "[]"); } catch { return []; }
    })
  );
  const unlinkedByArea: Map<string, any[]> = new Map();
  for (const asset of (assets ?? [])) {
    if (linkedAssetIds.has(asset.id)) continue;
    const areaKey = asset.areaLabel || "General Overview";
    if (!unlinkedByArea.has(areaKey)) unlinkedByArea.set(areaKey, []);
    unlinkedByArea.get(areaKey)!.push(asset);
  }

  // Merge unlinked photo groups into area groups (as synthetic entries or standalone)
  for (const [area, areaAssets] of unlinkedByArea) {
    if (!areaGroups.has(area)) areaGroups.set(area, []);
    // We'll handle unlinked photos per area in a special way in the renderer
  }

  const areaGroupList = Array.from(areaGroups.entries());

  // Areas to focus on (from all entries)
  const areasToFocusOn: string[] = (entries ?? [])
    .map((e: any) => e.recommendedAction)
    .filter((a: any): a is string => !!a && a.trim().length > 0);

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">

      {/* ── Document Header ── */}
      <div className="bg-white border-b shadow-sm print:shadow-none">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-6">
          <div className="flex items-start gap-4">
            {company?.companyLogoUrl ? (
              <img src={company.companyLogoUrl} alt={company.name} className="h-12 w-12 rounded-xl object-contain border flex-shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 border">
                <Building2 className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {company?.name && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{company.name}</p>
              )}
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{docTitle}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {documentMode === "quote" ? "Quote Proposal · " : ""}{sessionType}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-4 border-t text-xs text-gray-500">
            {session?.startedAt && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                {format(parseISO(session.startedAt), "MMMM d, yyyy")}
              </span>
            )}
            {session?.locationName && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {session.locationName}
              </span>
            )}
            {session?.createdByName && (
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                Prepared by {session.createdByName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Document Body ── */}
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-0">

        {/* Opening paragraph */}
        {(session?.aiSummary || session?.clientSafeSummary) && (
          <section className="mb-8">
            <p className="text-sm text-gray-700 leading-relaxed max-w-3xl">
              {session.clientSafeSummary || session.aiSummary}
            </p>
            <div className="h-px bg-gray-200 mt-7" />
          </section>
        )}

        {/* ── Area sections ── */}
        {areaGroupList.length > 0 && (
          <div className="space-y-10 mb-10">
            {areaGroupList.map(([area, areaEntries], i) => {
              // Get unlinked photos for this area too
              const unlinkedForArea = unlinkedByArea.get(area) ?? [];
              // Build a combined set of photos: linked (from entries) + unlinked
              const linkedForArea = areaEntries.flatMap((e: any) => {
                try {
                  const ids: string[] = JSON.parse(e.assetIds || "[]");
                  return ids.map((id: string) => assets?.find((a: any) => a.id === id)).filter(Boolean);
                } catch { return []; }
              });
              const allPhotos = [...linkedForArea, ...unlinkedForArea].filter((a, idx, arr) =>
                arr.findIndex(b => b.id === a.id) === idx
              );

              return (
                <section key={area} data-testid={`section-area-${i + 1}`} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold text-gray-900">{area}</h2>
                    <div className="flex-1 h-px bg-gray-200" />
                    {allPhotos.length > 0 && (
                      <span className="text-[10px] text-gray-400">{allPhotos.length} photo{allPhotos.length !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  {areaEntries.map((e: any) => {
                    const bullets = parseBullets(e.clientSafeSummary);
                    return (
                      <div key={e.id} className="space-y-2">
                        {/* Entry title (sub-heading when differs from area) */}
                        {e.title && e.title !== area && e.title !== e.areaName && (
                          <p className="text-sm font-semibold text-gray-800">{e.title}</p>
                        )}
                        {/* Body intro */}
                        {e.body && <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">{e.body}</p>}
                        {/* Bullet observations */}
                        {bullets && bullets.length > 0 && (
                          <ul className="space-y-1.5 mt-1">
                            {bullets.map((bullet: string, bi: number) => (
                              <li key={bi} className="flex items-start gap-2.5 text-sm text-gray-700">
                                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                                <span className="leading-snug">{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {e.recommendedAction && (
                          <p className="text-xs text-gray-500 italic mt-1">↳ {e.recommendedAction}</p>
                        )}
                      </div>
                    );
                  })}
                  {allPhotos.length > 0 && (() => {
                    const beforePhotos = allPhotos.filter((a: any) => !a.phase || a.phase === "before");
                    const afterPhotos = allPhotos.filter((a: any) => a.phase === "after");
                    const hasBothPhases = beforePhotos.length > 0 && afterPhotos.length > 0;
                    function PhotoRow({ photos, offset = 0 }: { photos: any[]; offset?: number }) {
                      return (
                        <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1.5">
                          {photos.map((asset: any, pi: number) => (
                            <div
                              key={asset.id}
                              data-testid={`img-public-photo-${asset.id}`}
                              className="overflow-hidden rounded-lg bg-gray-100"
                            >
                              <div
                                className="aspect-square cursor-pointer hover:opacity-95 transition-opacity relative"
                                onClick={() => setLightbox(asset.fileUrl)}
                              >
                                <img src={asset.fileUrl} alt={`Photo ${offset + pi + 1}`} className="w-full h-full object-cover" />
                                {showTimestamps && asset.capturedAt && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/55 px-1.5 py-0.5">
                                    <span className="text-[9px] text-white">{format(parseISO(asset.capturedAt), "h:mm a")}</span>
                                  </div>
                                )}
                              </div>
                              {asset.caption && (
                                <p className="px-2 py-1.5 text-xs text-gray-600 leading-snug">{asset.caption}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return hasBothPhases ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Before</p>
                          <PhotoRow photos={beforePhotos} offset={0} />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">After</p>
                          <PhotoRow photos={afterPhotos} offset={beforePhotos.length} />
                        </div>
                      </div>
                    ) : (
                      <PhotoRow photos={allPhotos} offset={0} />
                    );
                  })()}
                </section>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {areaGroupList.length === 0 && (
          <div className="text-center py-16 text-gray-400 mb-8">
            <NotebookPen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No content available</p>
          </div>
        )}

        {/* ── Areas to Focus On ── */}
        {areasToFocusOn.length > 0 && (
          <section className="mb-10 pt-7 border-t border-gray-200">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Areas to Focus On</h2>
            <ul className="space-y-2.5 max-w-2xl">
              {areasToFocusOn.map((action, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <span className="text-gray-400 font-medium shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="leading-relaxed">{action}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Transcript Section ── */}
        <TranscriptSection chunks={transcriptChunks ?? []} hasTranscript={hasTranscript} />

        {/* ── Quote / Proposal Section ── */}
        {documentMode === "quote" && (
          <section className="mt-10 pt-7 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-bold text-gray-800">Proposed Service Scope</h2>
            </div>

            {/* Quote status banner */}
            {currentQuoteStatus === "accepted" && (
              <div className="mb-5 flex items-center gap-2.5 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl" data-testid="banner-quote-accepted">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Quote Accepted</p>
                  {quoteData.quoteAcceptedAt && <p className="text-xs text-green-600">Accepted on {format(parseISO(quoteData.quoteAcceptedAt), "MMMM d, yyyy 'at' h:mm a")}</p>}
                </div>
              </div>
            )}
            {currentQuoteStatus === "declined" && (
              <div className="mb-5 flex items-start gap-2.5 bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-xl" data-testid="banner-quote-declined">
                <XCircle className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Quote Declined</p>
                  {quoteData.quoteDeclineReason && <p className="text-xs text-gray-500 mt-0.5">Reason: {quoteData.quoteDeclineReason}</p>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Property Details */}
              {(quoteData.squareFootage || quoteData.numFloors || quoteData.numOffices || quoteData.numWashrooms) && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <LayoutList className="w-3 h-3" /> Property Details
                  </p>
                  <div className="space-y-2 text-sm">
                    {quoteData.squareFootage && <div><span className="text-gray-400 text-xs block">Square footage</span><span className="font-medium">{quoteData.squareFootage}</span></div>}
                    {quoteData.numFloors && <div><span className="text-gray-400 text-xs block">Floors</span><span className="font-medium">{quoteData.numFloors}</span></div>}
                    {quoteData.numOffices && <div><span className="text-gray-400 text-xs block">Offices</span><span className="font-medium">{quoteData.numOffices}</span></div>}
                    {quoteData.numWashrooms && <div><span className="text-gray-400 text-xs block">Washrooms</span><span className="font-medium">{quoteData.numWashrooms}</span></div>}
                    {quoteData.numKitchens && <div><span className="text-gray-400 text-xs block">Kitchens</span><span className="font-medium">{quoteData.numKitchens}</span></div>}
                    {quoteData.specialSurfaces && <div><span className="text-gray-400 text-xs block">Surfaces</span><span className="font-medium">{quoteData.specialSurfaces}</span></div>}
                    {quoteData.otherAreas && <div><span className="text-gray-400 text-xs block">Other areas</span><span className="font-medium">{quoteData.otherAreas}</span></div>}
                  </div>
                </div>
              )}

              {/* Service Scope */}
              {(quoteData.serviceFrequency || quoteData.scopeSummary || quoteData.includedAreas) && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <FileCheck className="w-3 h-3" /> Service Scope
                  </p>
                  <div className="space-y-2 text-sm">
                    {quoteData.serviceFrequency && <div><span className="text-gray-400 text-xs block">Frequency</span><span className="font-medium">{quoteData.serviceFrequency}</span></div>}
                    {quoteData.carpetFrequency && <div><span className="text-gray-400 text-xs block">Carpet care</span><span className="font-medium">{quoteData.carpetFrequency}</span></div>}
                    {quoteData.includedAreas && <div><span className="text-gray-400 text-xs block">Included areas</span><span className="font-medium">{quoteData.includedAreas}</span></div>}
                    {quoteData.addOns && <div><span className="text-gray-400 text-xs block">Add-ons</span><span className="font-medium">{quoteData.addOns}</span></div>}
                    {quoteData.scopeSummary && <div><span className="text-gray-400 text-xs block">Scope</span><p className="text-gray-700 leading-relaxed">{quoteData.scopeSummary}</p></div>}
                  </div>
                </div>
              )}

              {/* Pricing */}
              {(quoteData.monthlyAmount || quoteData.weeklyAmount || quoteData.biweeklyAmount || quoteData.oneTimeAmount) && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3" /> Pricing
                  </p>
                  <div className="space-y-2">
                    {quoteData.monthlyAmount && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Monthly</span>
                        <span className="text-lg font-bold text-gray-900">{quoteData.monthlyAmount}</span>
                      </div>
                    )}
                    {quoteData.weeklyAmount && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Weekly</span>
                        <span className="text-sm font-semibold text-gray-700">{quoteData.weeklyAmount}</span>
                      </div>
                    )}
                    {quoteData.biweeklyAmount && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Bi-weekly</span>
                        <span className="text-sm font-semibold text-gray-700">{quoteData.biweeklyAmount}</span>
                      </div>
                    )}
                    {quoteData.oneTimeAmount && (
                      <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                        <span className="text-sm text-gray-600">One-time / deep clean</span>
                        <span className="text-sm font-semibold text-gray-700">{quoteData.oneTimeAmount}</span>
                      </div>
                    )}
                  </div>
                  {quoteData.pricingNotes && (
                    <p className="text-xs text-gray-500 mt-3 leading-relaxed">{quoteData.pricingNotes}</p>
                  )}
                </div>
              )}
            </div>

            {/* Accept / Decline (only if no response yet) */}
            {(!currentQuoteStatus || currentQuoteStatus === "pending") && (
              <div className="border rounded-xl p-5 bg-white">
                <p className="text-sm font-semibold text-gray-800 mb-4">Respond to this quote</p>
                <QuoteResponsePanel
                  token={token!}
                  status={currentQuoteStatus}
                  onDone={setQuoteStatus}
                />
              </div>
            )}
          </section>
        )}

        {/* ── Closing ── */}
        <section className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-3 text-[10px] text-gray-300">
            <NotebookPen className="w-3 h-3" />
            <span>
              {company?.name ? `${company.name} · ` : ""}Field Notes by Clockfield
              {session?.startedAt ? ` · ${format(parseISO(session.startedAt), "MMMM d, yyyy")}` : ""}
            </span>
          </div>
        </section>
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/92 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} className="max-w-full max-h-full rounded-lg object-contain" alt="Full size" />
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
