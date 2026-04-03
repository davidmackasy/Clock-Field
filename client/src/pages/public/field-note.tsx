import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  NotebookPen, Camera, MapPin, Clock, User, AlertTriangle,
  X, Building2, FileText
} from "lucide-react";
import { format, parseISO } from "date-fns";

const ENTRY_ICON: Record<string, string> = {
  issue: "⚠️", damage: "🚨", risk: "⚡", observation: "👁️", cleaning_scope: "🧹",
  before_condition: "📸", after_condition: "✅", supply_note: "📦", general_note: "📝",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "border-l-red-500 bg-red-50",
  high: "border-l-orange-500 bg-orange-50",
  normal: "border-l-blue-400 bg-blue-50/40",
  low: "border-l-gray-300 bg-gray-50",
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  normal: "bg-blue-50 text-blue-700 border-blue-200",
  low: "bg-gray-100 text-gray-500 border-gray-200",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  site_visit: "Site Visit", inspection: "Inspection", pre_clean: "Pre-Clean",
  post_clean: "Post-Clean", damage_report: "Damage Report", maintenance: "Maintenance",
};

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
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-start gap-3">
            {company?.companyLogoUrl ? (
              <img src={company.companyLogoUrl} alt={company.name} className="h-10 w-10 rounded-lg object-contain border flex-shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {company?.name && <p className="text-xs font-medium text-muted-foreground">{company.name}</p>}
              <h1 className="text-lg font-bold text-gray-900 leading-tight">{docTitle}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                {session?.locationName && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{session.locationName}</span>
                )}
                {session?.startedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(parseISO(session.startedAt), "MMMM d, yyyy h:mm a")}
                  </span>
                )}
                {session?.createdByName && (
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{session.createdByName}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <NotebookPen className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-primary">Field Report</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Photo grid */}
        {assets?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> Site Photos ({assets.length})
            </p>
            <div className="grid grid-cols-3 gap-1.5 rounded-xl overflow-hidden">
              {assets.slice(0, 9).map((asset: any, i: number) => (
                <div key={asset.id} data-testid={`img-public-photo-${asset.id}`}
                  className="aspect-square bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity overflow-hidden relative"
                  onClick={() => setLightbox(asset.fileUrl)}>
                  <img src={asset.fileUrl} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  {showTimestamps && asset.capturedAt && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                      <span className="text-[9px] text-white">{format(parseISO(asset.capturedAt), "h:mm:ss a")}</span>
                    </div>
                  )}
                  {i === 8 && assets.length > 9 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">+{assets.length - 9}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entries */}
        {entries?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Findings & Notes ({entries.length})
            </p>
            <div className="space-y-3">
              {entries.map((entry: any) => {
                const linkedAssets: any[] = (() => {
                  try {
                    const ids: string[] = JSON.parse(entry.assetIds || "[]");
                    return ids.map((id: string) => assets?.find((a: any) => a.id === id)).filter(Boolean);
                  } catch {
                    return [];
                  }
                })();

                return (
                  <div key={entry.id} data-testid={`card-public-entry-${entry.id}`}
                    className={`rounded-xl border-l-4 border border-l-current overflow-hidden ${PRIORITY_COLORS[entry.priority] ?? PRIORITY_COLORS.normal}`}>
                    {linkedAssets.length > 0 && (
                      <div className="flex gap-1.5 p-2 pb-0 overflow-x-auto">
                        {linkedAssets.map((asset: any, i: number) => (
                          <div key={asset.id} className="flex-shrink-0 w-28 h-20 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setLightbox(asset.fileUrl)}>
                            <img src={asset.fileUrl} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="p-3 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="text-base shrink-0">{ENTRY_ICON[entry.entryType] ?? "📝"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900">{entry.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {entry.areaName && (
                              <span className="text-[10px] bg-white border rounded px-1.5 py-0.5 text-gray-600">{entry.areaName}</span>
                            )}
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_BADGE[entry.priority] ?? ""}`}>
                              {entry.priority}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed pl-6">
                        {entry.clientSafeSummary || entry.body}
                      </p>
                      {entry.recommendedAction && (
                        <div className="ml-6 flex items-start gap-1.5 bg-blue-50 rounded px-2.5 py-1.5 text-xs text-blue-700">
                          <span className="font-semibold shrink-0">Recommended Action:</span>
                          <span>{entry.recommendedAction}</span>
                        </div>
                      )}
                      {showTimestamps && entry.createdAt && (
                        <p className="text-[10px] text-gray-400 pl-6">{format(parseISO(entry.createdAt), "h:mm a")}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {entries?.length === 0 && assets?.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <NotebookPen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No content available</p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t text-center">
          <p className="text-[11px] text-gray-400">Generated by Clockfield · Field Notes</p>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-w-full max-h-full rounded-lg" alt="Full size" />
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
