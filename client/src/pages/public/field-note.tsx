import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { NotebookPen, MapPin, Clock, User, AlertTriangle, X, Building2, DollarSign, FileCheck, LayoutList } from "lucide-react";
import { format, parseISO } from "date-fns";

const SESSION_TYPE_LABELS: Record<string, string> = {
  site_visit: "Site Visit", inspection: "Inspection", pre_clean: "Pre-Clean",
  post_clean: "Post-Clean", damage_report: "Damage Report", maintenance: "Maintenance",
};

function parseQuoteData(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export default function PublicFieldNote() {
  const [, params] = useRoute("/public/field-notes/:token");
  const token = params?.token;
  const [lightbox, setLightbox] = useState<string | null>(null);

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
        <div className="max-w-2xl mx-auto space-y-5">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
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

  const { session, company, entries, assets, publicDoc } = data;
  const docTitle = publicDoc?.title || session?.title || SESSION_TYPE_LABELS[session?.sessionType] || "Field Report";
  const showTimestamps = publicDoc?.showTimestamps ?? false;
  const sessionType = SESSION_TYPE_LABELS[session?.sessionType] || "Field Note";
  const documentMode = session?.documentMode || "standard";
  const quoteData = parseQuoteData(session?.quoteData);

  // Build a flat list of areas to focus on (non-empty recommended actions)
  const areasToFocusOn: string[] = (entries ?? [])
    .map((e: any) => e.recommendedAction)
    .filter((a: any): a is string => !!a && a.trim().length > 0);

  // Helper: get linked assets for an entry
  const getLinkedAssets = (entry: any) => {
    try {
      const ids: string[] = JSON.parse(entry.assetIds || "[]");
      return ids.map((id: string) => assets?.find((a: any) => a.id === id)).filter(Boolean);
    } catch { return []; }
  };

  // Assets not linked to any entry
  const linkedAssetIds = new Set(
    (entries ?? []).flatMap((e: any) => {
      try { return JSON.parse(e.assetIds || "[]"); } catch { return []; }
    })
  );
  const unlinkedAssets = (assets ?? []).filter((a: any) => !linkedAssetIds.has(a.id));

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">

      {/* ── Document Header ── */}
      <div className="bg-white border-b shadow-sm print:shadow-none print:border-b-2 print:border-gray-900">
        <div className="max-w-2xl mx-auto px-5 py-6">
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

          {/* Metadata row */}
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
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-0">

        {/* Opening paragraph */}
        {(session?.aiSummary || session?.clientSafeSummary) && (
          <section className="mb-8">
            <p className="text-sm text-gray-700 leading-relaxed">
              {session.clientSafeSummary || session.aiSummary}
            </p>
            <div className="h-px bg-gray-200 mt-7" />
          </section>
        )}

        {/* Unlinked photos — site photos */}
        {unlinkedAssets.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Site Photos</h2>
            <div className={`grid gap-1.5 rounded-xl overflow-hidden ${unlinkedAssets.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}>
              {unlinkedAssets.map((asset: any, i: number) => (
                <div
                  key={asset.id}
                  data-testid={`img-public-photo-${asset.id}`}
                  className="overflow-hidden rounded-lg bg-gray-100 cursor-pointer hover:opacity-95 transition-opacity relative"
                  onClick={() => setLightbox(asset.fileUrl)}
                >
                  <img src={asset.fileUrl} alt={`Photo ${i + 1}`} className="w-full aspect-square object-cover" />
                  {showTimestamps && asset.capturedAt && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                      <span className="text-[9px] text-white">{format(parseISO(asset.capturedAt), "h:mm:ss a")}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="h-px bg-gray-200 mt-7" />
          </section>
        )}

        {/* Empty state */}
        {(!entries || entries.length === 0) && unlinkedAssets.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <NotebookPen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No content available</p>
          </div>
        )}

        {/* ── Observation Sections ── */}
        {entries && entries.length > 0 && (
          <div className="space-y-10">
            {entries.map((entry: any, i: number) => {
              const entryAssets = getLinkedAssets(entry);
              return (
                <section key={entry.id} data-testid={`card-public-entry-${entry.id}`}>

                  {/* Section header */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{i + 1}.</span>
                    {entry.areaName && (
                      <span className="text-xs font-semibold text-gray-600">{entry.areaName}</span>
                    )}
                    <div className="flex-1 h-px bg-gray-200" />
                    {showTimestamps && entry.createdAt && (
                      <span className="text-[10px] text-gray-400 shrink-0">{format(parseISO(entry.createdAt), "h:mm a")}</span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-semibold text-gray-900 mb-3 leading-snug">{entry.title}</h3>

                  {/* Embedded photos */}
                  {entryAssets.length > 0 && (
                    <div className={`mb-4 rounded-xl overflow-hidden ${
                      entryAssets.length === 1 ? "grid grid-cols-1" : "grid grid-cols-2 gap-1.5"
                    }`}>
                      {entryAssets.map((asset: any, ai: number) => (
                        <div
                          key={asset.id}
                          className="overflow-hidden rounded-lg bg-gray-100 cursor-pointer hover:opacity-95 transition-opacity relative"
                          onClick={() => setLightbox(asset.fileUrl)}
                        >
                          <img
                            src={asset.fileUrl}
                            alt={`Photo ${ai + 1}`}
                            className={`w-full object-cover ${entryAssets.length === 1 ? "max-h-80" : "aspect-[4/3]"}`}
                          />
                          {showTimestamps && asset.capturedAt && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/55 px-2 py-1">
                              <span className="text-[9px] text-white">{format(parseISO(asset.capturedAt), "h:mm:ss a")}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Body text */}
                  <p className="text-sm text-gray-700 leading-relaxed mb-2">
                    {entry.clientSafeSummary || entry.body}
                  </p>

                  {/* Recommended action — plain note, no colored box */}
                  {entry.recommendedAction && (
                    <p className="text-xs text-gray-500 italic leading-relaxed">
                      Note: {entry.recommendedAction}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* ── Areas to Focus On ── */}
        {areasToFocusOn.length > 0 && (
          <section className="mt-10 pt-7 border-t border-gray-200">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Areas to Focus On</h2>
            <ul className="space-y-2.5">
              {areasToFocusOn.map((action, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <span className="text-gray-400 font-medium shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="leading-relaxed">{action}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Quote / Proposal Section ── */}
        {documentMode === "quote" && (quoteData.monthlyAmount || quoteData.scopeSummary || quoteData.serviceFrequency || quoteData.squareFootage) && (
          <section className="mt-10 pt-7 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-5">
              <DollarSign className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-bold text-gray-800">Proposed Service Scope</h2>
            </div>

            {/* Property details row */}
            {(quoteData.squareFootage || quoteData.numFloors || quoteData.numOffices || quoteData.numWashrooms || quoteData.specialSurfaces) && (
              <div className="mb-5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <LayoutList className="w-3 h-3" /> Property Details
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {quoteData.squareFootage && <div><span className="text-gray-400 text-xs">Square footage</span><p className="font-medium text-gray-800">{quoteData.squareFootage}</p></div>}
                  {quoteData.numFloors && <div><span className="text-gray-400 text-xs">Floors</span><p className="font-medium text-gray-800">{quoteData.numFloors}</p></div>}
                  {quoteData.numOffices && <div><span className="text-gray-400 text-xs">Offices</span><p className="font-medium text-gray-800">{quoteData.numOffices}</p></div>}
                  {quoteData.numWashrooms && <div><span className="text-gray-400 text-xs">Washrooms</span><p className="font-medium text-gray-800">{quoteData.numWashrooms}</p></div>}
                  {quoteData.numKitchens && <div><span className="text-gray-400 text-xs">Kitchens / break rooms</span><p className="font-medium text-gray-800">{quoteData.numKitchens}</p></div>}
                  {quoteData.numEntrances && <div><span className="text-gray-400 text-xs">Entrances</span><p className="font-medium text-gray-800">{quoteData.numEntrances}</p></div>}
                  {quoteData.specialSurfaces && <div className="col-span-2"><span className="text-gray-400 text-xs">Surfaces</span><p className="font-medium text-gray-800">{quoteData.specialSurfaces}</p></div>}
                  {quoteData.otherAreas && <div className="col-span-2"><span className="text-gray-400 text-xs">Other areas</span><p className="font-medium text-gray-800">{quoteData.otherAreas}</p></div>}
                </div>
              </div>
            )}

            {/* Service scope */}
            {(quoteData.serviceFrequency || quoteData.scopeSummary || quoteData.includedAreas || quoteData.addOns) && (
              <div className="mb-5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <FileCheck className="w-3 h-3" /> Service Scope
                </p>
                <div className="space-y-2 text-sm">
                  {quoteData.serviceFrequency && (
                    <div><span className="text-gray-400 text-xs">Frequency</span><p className="font-medium text-gray-800">{quoteData.serviceFrequency}</p></div>
                  )}
                  {quoteData.carpetFrequency && (
                    <div><span className="text-gray-400 text-xs">Carpet care</span><p className="font-medium text-gray-800">{quoteData.carpetFrequency}</p></div>
                  )}
                  {quoteData.includedAreas && (
                    <div><span className="text-gray-400 text-xs">Included areas</span><p className="font-medium text-gray-800">{quoteData.includedAreas}</p></div>
                  )}
                  {quoteData.scopeSummary && (
                    <div><span className="text-gray-400 text-xs">Scope</span><p className="text-gray-700 leading-relaxed mt-0.5">{quoteData.scopeSummary}</p></div>
                  )}
                  {quoteData.addOns && (
                    <div><span className="text-gray-400 text-xs">Add-ons</span><p className="font-medium text-gray-800">{quoteData.addOns}</p></div>
                  )}
                </div>
              </div>
            )}

            {/* Pricing */}
            {(quoteData.monthlyAmount || quoteData.weeklyAmount || quoteData.biweeklyAmount || quoteData.oneTimeAmount) && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Pricing</p>
                <div className="space-y-2">
                  {quoteData.monthlyAmount && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Monthly</span>
                      <span className="text-base font-bold text-gray-900">{quoteData.monthlyAmount}</span>
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
