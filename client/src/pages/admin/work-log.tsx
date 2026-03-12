import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MapPin, User, Calendar, ChevronRight, CheckCircle, Search, Eye, X, ChevronLeft, ChevronRight as ChevronRightIcon, Link, Copy, ExternalLink } from "lucide-react";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface LightboxPhoto { id: string; caption?: string }
interface LightboxState { photos: LightboxPhoto[]; idx: number; groupLabel: string; section: string; subArea: string }

function Lightbox({ state, onClose }: { state: LightboxState; onClose: () => void }) {
  const [idx, setIdx] = useState(state.idx);
  const photo = state.photos[idx];
  const total = state.photos.length;

  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(total - 1, i + 1));

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center"
      onClick={onClose}
      onKeyDown={handleKey}
      tabIndex={0}
      data-testid="lightbox-overlay"
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
        onClick={onClose}
        data-testid="button-lightbox-close"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Label */}
      <div className="absolute top-4 left-4 text-left">
        <p className="text-white/60 text-xs font-medium uppercase tracking-wide">{state.groupLabel}</p>
        <p className="text-white/80 text-sm font-semibold">{state.section} · {state.subArea}</p>
      </div>

      {/* Image */}
      <div className="flex items-center gap-3 w-full max-w-4xl px-16" onClick={e => e.stopPropagation()}>
        <button
          className="p-2 text-white/60 hover:text-white disabled:opacity-20 transition-colors rounded-full hover:bg-white/10 shrink-0"
          onClick={prev}
          disabled={idx === 0}
          data-testid="button-lightbox-prev"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>

        <div className="flex-1 flex items-center justify-center">
          <img
            src={`/api/work-submission-photos/${photo.id}/image`}
            alt={photo.caption || ""}
            className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
          />
        </div>

        <button
          className="p-2 text-white/60 hover:text-white disabled:opacity-20 transition-colors rounded-full hover:bg-white/10 shrink-0"
          onClick={next}
          disabled={idx === total - 1}
          data-testid="button-lightbox-next"
        >
          <ChevronRightIcon className="w-7 h-7" />
        </button>
      </div>

      {/* Counter + caption */}
      <div className="absolute bottom-5 text-center space-y-1">
        {total > 1 && (
          <p className="text-white/50 text-xs">{idx + 1} / {total}</p>
        )}
        {photo.caption && <p className="text-white/70 text-sm">{photo.caption}</p>}
      </div>
    </div>
  );
}

function PhotoGrid({
  photos,
  label,
  section,
  subArea,
  onPreview,
}: {
  photos: any[];
  label: string;
  section: string;
  subArea: string;
  onPreview: (idx: number) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      {photos.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 italic">No {label.toLowerCase()}</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
          {photos.map((p: any, i: number) => (
            <button
              key={p.id}
              className="relative group focus:outline-none focus:ring-2 focus:ring-primary rounded-md"
              onClick={() => onPreview(i)}
              data-testid={`photo-thumb-${p.id}`}
            >
              <img
                src={`/api/work-submission-photos/${p.id}/image`}
                alt={p.caption || ""}
                className="w-full aspect-square object-cover rounded-md bg-muted border border-border"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-md transition-colors flex items-center justify-center">
                <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionDetail({ subId }: { subId: string }) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/work-submissions", subId],
    enabled: !!subId,
    staleTime: 30 * 1000,
  });

  const openLightbox = (photos: any[], idx: number, groupLabel: string, section: string, subArea: string) => {
    setLightbox({ photos, idx, groupLabel, section, subArea });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 pt-2 flex-1 overflow-y-auto">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }
  if (!data) return <p className="text-sm text-muted-foreground py-6 text-center">Could not load submission.</p>;

  return (
    <>
      {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}

      <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-0">
        {!data.items?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">No work items in this submission.</p>
        ) : (
          data.items.map((item: any, idx: number) => {
            const beforePhotos = (item.photos || []).filter((p: any) => p.photoType === "before");
            const afterPhotos = (item.photos || []).filter((p: any) => p.photoType === "after");

            return (
              <div key={item.id} className="border border-border rounded-xl p-3.5 space-y-3 bg-card">
                {/* Item header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {item.section}
                    </span>
                    <p className="text-sm font-semibold">{item.subArea}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 mt-0.5">Item {idx + 1}</span>
                </div>

                {item.notes && (
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground italic">{item.notes}</p>
                  </div>
                )}

                {/* Photo grids */}
                <div className="space-y-3">
                  <PhotoGrid
                    photos={beforePhotos}
                    label="Before Photos"
                    section={item.section}
                    subArea={item.subArea}
                    onPreview={i => openLightbox(beforePhotos, i, "Before Photos", item.section, item.subArea)}
                  />
                  <PhotoGrid
                    photos={afterPhotos}
                    label="After Photos"
                    section={item.section}
                    subArea={item.subArea}
                    onPreview={i => openLightbox(afterPhotos, i, "After Photos", item.section, item.subArea)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

export default function AdminWorkLog() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [detailSub, setDetailSub] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: submissions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/work-submissions"],
    refetchInterval: 30 * 1000,
  });
  const { data: employees } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const markReviewedMut = useMutation({
    mutationFn: async (subId: string) => {
      const res = await apiRequest("PATCH", `/api/work-submissions/${subId}`, { status: "reviewed" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions"] });
      if (detailSub) setDetailSub((prev: any) => ({ ...prev, status: "reviewed" }));
      toast({ title: "Marked as reviewed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateLinkMut = useMutation({
    mutationFn: async (subId: string) => {
      const res = await apiRequest("POST", `/api/work-submissions/${subId}/share`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      const fullUrl = `${window.location.origin}${data.url}`;
      setShareUrl(fullUrl);
      toast({ title: "Public link ready" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Please copy the link manually", variant: "destructive" });
    }
  };

  const empMap: Record<string, string> = {};
  (employees || []).forEach((e: any) => { empMap[e.id] = `${e.firstName} ${e.lastName}`; });

  const filtered = (submissions || []).filter(s => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (!search) return true;
    const emp = empMap[s.employeeId] || "";
    return emp.toLowerCase().includes(search.toLowerCase()) ||
      (s.locationName || "").toLowerCase().includes(search.toLowerCase()) ||
      s.workDate.includes(search);
  });

  const statusVariant: Record<string, string> = { draft: "secondary", submitted: "default", reviewed: "secondary" };
  const statusColor: Record<string, string> = { reviewed: "text-emerald-600 dark:text-emerald-400" };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Work Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review cleaner work submissions</p>
        </div>
        {isLoading ? null : (
          <Badge variant="outline" className="text-xs">
            {filtered.length} submission{filtered.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by employee, location, date..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="input-search"
          />
        </div>
        <div className="flex gap-1.5">
          {["all", "submitted", "reviewed", "draft"].map(s => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              className="h-9 capitalize text-xs"
              onClick={() => setStatusFilter(s)}
              data-testid={`button-filter-${s}`}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Submissions list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{submissions?.length === 0 ? "No work submissions yet." : "No results match your search."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((sub: any) => {
            const empName = empMap[sub.employeeId] || "Unknown Employee";
            return (
              <Card
                key={sub.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setDetailSub(sub)}
                data-testid={`card-submission-${sub.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{empName}</p>
                        <Badge
                          variant={(statusVariant[sub.status] as any) || "secondary"}
                          className={`text-[10px] capitalize ${statusColor[sub.status] || ""}`}
                        >
                          {sub.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{sub.workDate}</span>
                        {sub.locationName && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{sub.locationName}</span>}
                        {sub.submittedAt && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Submitted {fmt(sub.submittedAt)}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailSub} onOpenChange={(v) => { if (!v) { setDetailSub(null); setShareUrl(null); setCopied(false); } }}>
        <DialogContent className="max-w-2xl mx-auto max-h-[90vh] flex flex-col gap-4">
          {detailSub && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Work Submission
                  <Badge
                    variant={(statusVariant[detailSub.status] as any) || "secondary"}
                    className={`text-[10px] capitalize ${statusColor[detailSub.status] || ""}`}
                  >
                    {detailSub.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{empMap[detailSub.employeeId] || detailSub.employeeId}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{detailSub.workDate}</span>
                    {detailSub.locationName && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{detailSub.locationName}</span>}
                    {detailSub.submittedAt && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Submitted {fmt(detailSub.submittedAt)}</span>}
                  </div>
                </DialogDescription>
              </DialogHeader>

              <SubmissionDetail subId={detailSub.id} />

              <div className="pt-2 border-t shrink-0 space-y-2">
                {/* Share link area */}
                {shareUrl ? (
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-muted rounded-lg px-3 py-2 min-w-0">
                      <Link className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">{shareUrl}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-9"
                      onClick={copyLink}
                      data-testid="button-copy-link"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-9"
                      onClick={() => window.open(shareUrl, "_blank")}
                      data-testid="button-open-link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => generateLinkMut.mutate(detailSub.id)}
                    disabled={generateLinkMut.isPending}
                    data-testid="button-generate-link"
                  >
                    <Link className="w-4 h-4 mr-2" />
                    {generateLinkMut.isPending ? "Generating..." : "Generate Public Link"}
                  </Button>
                )}
                {detailSub.status === "submitted" && (
                  <Button
                    className="w-full"
                    onClick={() => markReviewedMut.mutate(detailSub.id)}
                    disabled={markReviewedMut.isPending}
                    data-testid="button-mark-reviewed"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {markReviewedMut.isPending ? "Marking..." : "Mark as Reviewed"}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
