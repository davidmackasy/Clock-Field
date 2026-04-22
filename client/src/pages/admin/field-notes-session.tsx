import { useState, useCallback, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, MapPin, Clock, Camera, Mic,
  Loader2, Edit3, X, Check, Images, FileText,
  Sparkles, NotebookPen, Share2, Copy, Link as LinkIcon,
  EyeOff, User, Printer, ChevronDown, ChevronUp,
  FileCheck, DollarSign, Building, LayoutList, Wand2,
  CheckCircle2, XCircle, Plus, SplitSquareHorizontal,
} from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";

const SESSION_TYPE_LABELS: Record<string, string> = {
  site_visit: "Site Visit", inspection: "Inspection", pre_clean: "Pre-Clean",
  post_clean: "Post-Clean", damage_report: "Damage Report", maintenance: "Maintenance",
};

// ── Parse quote data safely ────────────────────────────────────────────────────
function parseQuoteData(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// ── Share Panel ───────────────────────────────────────────────────────────────
function SharePanel({ session, publicDoc, sessionId }: { session: any; publicDoc: any; sessionId: string }) {
  const { toast } = useToast();
  const [shareTitle, setShareTitle] = useState(publicDoc?.title || session.title || "");
  const [showTimestamps, setShowTimestamps] = useState(publicDoc?.showTimestamps ?? false);
  const [showInternalNotes, setShowInternalNotes] = useState(publicDoc?.showInternalNotes ?? false);
  const [shareUrl, setShareUrl] = useState<string | null>(
    publicDoc?.isEnabled ? `${window.location.origin}/public/field-notes/${publicDoc.publicShortId || publicDoc.shareToken}` : null
  );

  const shareMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/field-notes/sessions/${sessionId}/share`, {
      title: shareTitle || null, showTimestamps, showInternalNotes,
    }).then(r => r.json()),
    onSuccess: (data) => {
      const url = `${window.location.origin}/public/field-notes/${data.publicShortId || data.rawToken || data.shareToken}`;
      setShareUrl(url);
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] });
      toast({ title: "Public link generated" });
    },
    onError: () => toast({ title: "Failed to generate link", variant: "destructive" }),
  });

  const disableMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/field-notes/sessions/${sessionId}/share`).then(r => r.json()),
    onSuccess: () => {
      setShareUrl(null);
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] });
      toast({ title: "Public link disabled" });
    },
    onError: () => toast({ title: "Failed to disable link", variant: "destructive" }),
  });

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copied to clipboard" });
  };

  return (
    <div className="bg-muted/40 border rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Share Link</p>
      <div className="space-y-2.5">
        <div>
          <Label className="text-xs mb-1 block">Document Title (optional)</Label>
          <Input value={shareTitle} onChange={e => setShareTitle(e.target.value)} placeholder="Site Visit Report…" className="h-7 text-xs" data-testid="input-share-title" />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Show timestamps</Label>
          <Switch data-testid="switch-share-timestamps" checked={showTimestamps} onCheckedChange={setShowTimestamps} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Include internal notes</Label>
          <Switch data-testid="switch-share-internal" checked={showInternalNotes} onCheckedChange={setShowInternalNotes} />
        </div>
      </div>
      {shareUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 bg-background rounded-lg border px-2.5 py-1.5">
            <LinkIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground truncate flex-1">{shareUrl}</span>
          </div>
          <div className="flex gap-2">
            <Button data-testid="button-copy-share-link" size="sm" variant="outline" className="flex-1 gap-1.5 h-7 text-xs" onClick={copyLink}>
              <Copy className="w-3 h-3" /> Copy Link
            </Button>
            <Button data-testid="button-disable-share" size="sm" variant="ghost" className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive" onClick={() => disableMutation.mutate()} disabled={disableMutation.isPending}>
              {disableMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <EyeOff className="w-3 h-3" />} Disable
            </Button>
            <Button data-testid="button-update-share" size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => shareMutation.mutate()} disabled={shareMutation.isPending}>
              {shareMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Update
            </Button>
          </div>
        </div>
      ) : (
        <Button data-testid="button-generate-share-link" size="sm" onClick={() => shareMutation.mutate()} disabled={shareMutation.isPending} className="w-full gap-1.5 h-7 text-xs">
          {shareMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />} Generate Public Link
        </Button>
      )}
    </div>
  );
}

// ── Document Observation Section ──────────────────────────────────────────────
function DocumentObservation({ entry, assets, sessionId, index, onPhotoClick }: {
  entry: any; assets: any[]; sessionId: string; index: number;
  onPhotoClick: (url: string, entry: any) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [form, setForm] = useState({ title: entry.title, body: entry.body, recommendedAction: entry.recommendedAction ?? "" });
  const { toast } = useToast();

  const linkedAssets: any[] = (() => {
    try {
      const ids: string[] = JSON.parse(entry.assetIds || "[]");
      return ids.map((id: string) => assets.find(a => a.id === id)).filter(Boolean);
    } catch {
      try {
        const idxs: number[] = JSON.parse(entry.photoIndexes || "[]");
        return idxs.map((i: number) => assets[i]).filter(Boolean);
      } catch { return []; }
    }
  })();

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/field-notes/entries/${entry.id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] });
      setEditing(false);
      toast({ title: "Updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  return (
    <div className="group relative">
      {/* Section divider with number */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest whitespace-nowrap">
          {index}.
        </span>
        {entry.areaName && (
          <span className="text-xs font-semibold text-foreground/70">{entry.areaName}</span>
        )}
        <div className="flex-1 h-px bg-border" />
        {/* Edit toggle */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {editing ? (
            <>
              <Button size="icon" variant="ghost" className="w-6 h-6" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate(form)}>
                {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              </Button>
              <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => { setEditing(false); setForm({ title: entry.title, body: entry.body, recommendedAction: entry.recommendedAction ?? "" }); }}>
                <X className="w-3 h-3" />
              </Button>
            </>
          ) : (
            <Button data-testid={`button-edit-entry-${entry.id}`} size="icon" variant="ghost" className="w-6 h-6" onClick={() => setEditing(true)}>
              <Edit3 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Title */}
      {editing ? (
        <Input data-testid="input-entry-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="text-base font-semibold mb-3 h-8" />
      ) : (
        <h3 className="text-base font-semibold text-foreground mb-3 leading-snug">{entry.title}</h3>
      )}

      {/* Photos — embedded in context, responsive multi-column grid */}
      {linkedAssets.length > 0 && (
        <div className={cn(
          "mb-4",
          linkedAssets.length === 1
            ? "grid grid-cols-1 rounded-xl overflow-hidden"
            : "grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1"
        )}>
          {linkedAssets.map((asset: any, i: number) => (
            <div
              key={asset.id}
              data-testid={`img-doc-photo-${asset.id}`}
              className="overflow-hidden rounded-lg cursor-pointer bg-muted hover:opacity-95 transition-opacity aspect-square"
              onClick={() => onPhotoClick(asset.fileUrl, entry)}
            >
              <img
                src={asset.fileUrl}
                alt={`Photo ${i + 1}`}
                className={cn("w-full h-full object-cover", linkedAssets.length === 1 ? "max-h-72" : "")}
              />
            </div>
          ))}
        </div>
      )}

      {/* Body / Bullets */}
      {editing ? (
        <Textarea data-testid="textarea-entry-body" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} className="text-sm mb-3" />
      ) : (() => {
        let bullets: string[] | null = null;
        try { const parsed = JSON.parse(entry.clientSafeSummary || ""); if (Array.isArray(parsed)) bullets = parsed; } catch {}
        return bullets && bullets.length > 0 ? (
          <div className="mb-2">
            {entry.body && <p className="text-sm text-foreground/70 leading-relaxed mb-1.5">{entry.body}</p>}
            <ul className="space-y-1">
              {bullets.map((bullet: string, bi: number) => (
                <li key={bi} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-foreground/30 shrink-0" />
                  <span className="leading-snug">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-foreground/80 leading-relaxed mb-2">{entry.body}</p>
        );
      })()}

      {/* Recommended action — plain text note, no colored box */}
      {editing ? (
        <Input data-testid="input-entry-action" value={form.recommendedAction} onChange={e => setForm(f => ({ ...f, recommendedAction: e.target.value }))} placeholder="Note or follow-up…" className="text-sm h-7 mb-2" />
      ) : entry.recommendedAction ? (
        <p className="text-xs text-muted-foreground italic leading-relaxed mb-2">
          Note: {entry.recommendedAction}
        </p>
      ) : null}

      {/* Spoken note — collapsible */}
      {entry.relatedTranscript && (
        <button
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-2.5 w-full text-left"
          onClick={() => setShowTranscript(v => !v)}
        >
          <Mic className="w-3 h-3 shrink-0" />
          <span className="font-medium">Spoken note</span>
          {showTranscript ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )}
      {showTranscript && entry.relatedTranscript && (
        <blockquote className="text-xs italic text-muted-foreground border-l-2 border-muted-foreground/30 pl-3 mb-3 leading-relaxed">
          "{entry.relatedTranscript}"
        </blockquote>
      )}
    </div>
  );
}

// ── AI Extracted Details Panel ─────────────────────────────────────────────────
function AiExtractedPanel({ extracted, onApply }: { extracted: Record<string, any>; onApply: (data: Record<string, any>) => void }) {
  const [open, setOpen] = useState(true);
  const labels: Record<string, string> = {
    square_footage: "Square footage", num_floors: "Floors", num_offices: "Offices",
    num_washrooms: "Washrooms", num_kitchens: "Kitchens", num_hallways: "Hallways",
    num_entrances: "Entrances", special_surfaces: "Surfaces", service_frequency: "Service frequency",
    carpet_frequency: "Carpet care", other_notes: "Notes",
  };
  const hasValues = Object.entries(extracted).some(([, v]) => v !== null && v !== "");

  if (!hasValues) return null;

  return (
    <div className="mb-6 border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
        data-testid="button-toggle-ai-extracted"
      >
        <div className="flex items-center gap-2">
          <Wand2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">AI extracted details from recording</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Review before using in quote</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-4 py-3 space-y-2">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {Object.entries(extracted).map(([k, v]) => {
              if (!v || !labels[k]) return null;
              return (
                <div key={k} className="flex gap-2">
                  <span className="text-[11px] text-muted-foreground shrink-0 w-28">{labels[k]}:</span>
                  <span className="text-[11px] font-medium">{String(v)}</span>
                </div>
              );
            })}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 mt-2 gap-1"
            onClick={() => {
              const mapped: Record<string, string> = {
                squareFootage: extracted.square_footage || "",
                numFloors: extracted.num_floors || "",
                numOffices: extracted.num_offices || "",
                numWashrooms: extracted.num_washrooms || "",
                numKitchens: extracted.num_kitchens || "",
                numHallways: extracted.num_hallways || "",
                numEntrances: extracted.num_entrances || "",
                specialSurfaces: extracted.special_surfaces || "",
                serviceFrequency: extracted.service_frequency || "",
                carpetFrequency: extracted.carpet_frequency || "",
              };
              onApply(mapped);
            }}
            data-testid="button-apply-extracted"
          >
            <Check className="w-3 h-3" /> Apply to quote fields
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Quote Section ──────────────────────────────────────────────────────────────
function QuoteSection({ sessionId, quoteData, onSave }: {
  sessionId: string;
  quoteData: Record<string, any>;
  onSave: (data: Record<string, any>) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({
    clientName: quoteData.clientName || "",
    siteAddress: quoteData.siteAddress || "",
    squareFootage: quoteData.squareFootage || "",
    numFloors: quoteData.numFloors || "",
    numOffices: quoteData.numOffices || "",
    numWashrooms: quoteData.numWashrooms || "",
    numKitchens: quoteData.numKitchens || "",
    numHallways: quoteData.numHallways || "",
    numEntrances: quoteData.numEntrances || "",
    specialSurfaces: quoteData.specialSurfaces || "",
    otherAreas: quoteData.otherAreas || "",
    serviceFrequency: quoteData.serviceFrequency || "",
    carpetFrequency: quoteData.carpetFrequency || "",
    includedAreas: quoteData.includedAreas || "",
    scopeSummary: quoteData.scopeSummary || "",
    addOns: quoteData.addOns || "",
    monthlyAmount: quoteData.monthlyAmount || "",
    weeklyAmount: quoteData.weeklyAmount || "",
    biweeklyAmount: quoteData.biweeklyAmount || "",
    oneTimeAmount: quoteData.oneTimeAmount || "",
    pricingNotes: quoteData.pricingNotes || "",
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    const merged = { ...quoteData, ...form };
    onSave(merged);
  };

  const scopeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/field-notes/sessions/${sessionId}/generate-scope`).then(r => r.json()),
    onSuccess: (data) => {
      setForm(f => ({ ...f, scopeSummary: data.scopeSummary || "" }));
      toast({ title: "Scope summary generated" });
    },
    onError: () => toast({ title: "Failed to generate scope", variant: "destructive" }),
  });

  const field = (label: string, key: string, placeholder?: string, wide?: boolean) => (
    <div className={wide ? "col-span-2" : ""}>
      <Label className="text-[11px] text-muted-foreground mb-1 block">{label}</Label>
      <Input
        value={form[key] || ""}
        onChange={set(key)}
        placeholder={placeholder || ""}
        className="h-7 text-xs"
        data-testid={`input-quote-${key}`}
      />
    </div>
  );

  const quoteStatus = quoteData.quoteStatus;

  return (
    <div className="mt-10 pt-6 border-t space-y-6">

      {/* Response status banner */}
      {quoteStatus === "accepted" && (
        <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl dark:bg-green-950/20 dark:border-green-800 dark:text-green-400" data-testid="banner-admin-quote-accepted">
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          <div>
            <p className="text-xs font-semibold">Client accepted this quote</p>
            {quoteData.quoteAcceptedAt && (
              <p className="text-[11px] text-green-600 dark:text-green-500">Accepted {format(parseISO(quoteData.quoteAcceptedAt), "MMM d, yyyy 'at' h:mm a")}</p>
            )}
          </div>
        </div>
      )}
      {quoteStatus === "declined" && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl dark:bg-red-950/20 dark:border-red-800 dark:text-red-400" data-testid="banner-admin-quote-declined">
          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold">Client declined this quote</p>
            {quoteData.quoteDeclineReason && <p className="text-[11px] text-red-600 dark:text-red-500 mt-0.5">Reason: {quoteData.quoteDeclineReason}</p>}
            {quoteData.quoteDeclinedAt && <p className="text-[11px] text-red-500 mt-0.5">{format(parseISO(quoteData.quoteDeclinedAt), "MMM d, yyyy 'at' h:mm a")}</p>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Quote / Proposal Details</p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleSave} data-testid="button-save-quote">
          <Check className="w-3 h-3" /> Save
        </Button>
      </div>

      {/* Client info */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Building className="w-3 h-3" /> Client & Site
        </p>
        <div className="grid grid-cols-2 gap-3">
          {field("Client name", "clientName", "e.g. Acme Corp")}
          {field("Site address", "siteAddress", "123 Main Street")}
        </div>
      </div>

      {/* Property details */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <LayoutList className="w-3 h-3" /> Property Details
        </p>
        <div className="grid grid-cols-2 gap-3">
          {field("Square footage", "squareFootage", "e.g. 1,200 sq ft")}
          {field("Number of floors", "numFloors", "e.g. 2")}
          {field("Offices", "numOffices", "e.g. 6")}
          {field("Washrooms", "numWashrooms", "e.g. 3")}
          {field("Kitchens / break rooms", "numKitchens", "e.g. 1")}
          {field("Hallways", "numHallways", "e.g. 2")}
          {field("Entrances", "numEntrances", "e.g. 1")}
          {field("Special surfaces", "specialSurfaces", "e.g. carpet, VCT tile, glass")}
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground mb-1 block">Other areas</Label>
            <Input value={form.otherAreas} onChange={set("otherAreas")} placeholder="e.g. lobby, garage, warehouse" className="h-7 text-xs" data-testid="input-quote-otherAreas" />
          </div>
        </div>
      </div>

      {/* Service scope */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <FileCheck className="w-3 h-3" /> Service Scope
        </p>
        <div className="grid grid-cols-2 gap-3">
          {field("Service frequency", "serviceFrequency", "e.g. 3x per week")}
          {field("Carpet care frequency", "carpetFrequency", "e.g. weekly")}
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground mb-1 block">Included areas</Label>
            <Input value={form.includedAreas} onChange={set("includedAreas")} placeholder="e.g. all offices, washrooms, kitchen" className="h-7 text-xs" data-testid="input-quote-includedAreas" />
          </div>
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[11px] text-muted-foreground">Scope summary</Label>
              <button
                type="button"
                className="flex items-center gap-1 text-[10px] text-primary hover:underline disabled:opacity-50"
                onClick={() => scopeMutation.mutate()}
                disabled={scopeMutation.isPending}
                data-testid="button-ai-scope-summary"
              >
                {scopeMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Wand2 className="w-2.5 h-2.5" />}
                {scopeMutation.isPending ? "Generating…" : "AI Generate"}
              </button>
            </div>
            <Textarea value={form.scopeSummary} onChange={set("scopeSummary")} rows={3} placeholder="Describe what the service includes…" className="text-xs resize-none" data-testid="textarea-quote-scopeSummary" />
          </div>
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground mb-1 block">Add-ons</Label>
            <Input value={form.addOns} onChange={set("addOns")} placeholder="e.g. window cleaning, floor waxing" className="h-7 text-xs" data-testid="input-quote-addOns" />
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <DollarSign className="w-3 h-3" /> Pricing
        </p>
        <div className="grid grid-cols-2 gap-3">
          {field("Monthly amount", "monthlyAmount", "e.g. $1,200/month")}
          {field("Weekly amount", "weeklyAmount", "e.g. $300/week")}
          {field("Bi-weekly amount", "biweeklyAmount", "e.g. $600/bi-weekly")}
          {field("One-time / deep clean", "oneTimeAmount", "e.g. $800")}
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground mb-1 block">Pricing notes</Label>
            <Textarea value={form.pricingNotes} onChange={set("pricingNotes")} rows={2} placeholder="e.g. Based on 3 visits per week, includes all supplies." className="text-xs resize-none" data-testid="textarea-quote-pricingNotes" />
          </div>
        </div>
      </div>

      <Button size="sm" className="w-full gap-1" onClick={handleSave} data-testid="button-save-quote-bottom">
        <Check className="w-3.5 h-3.5" /> Save Quote Details
      </Button>
    </div>
  );
}

// ── Photos tab content with Before/After support ──────────────────────────────
function PhotosTabContent({
  assets, entries, sessionId, onPhotoClick, onAssetsAdded
}: {
  assets: any[];
  entries: any[];
  sessionId: string;
  onPhotoClick: (url: string, entry: any) => void;
  onAssetsAdded: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const beforeAssets = assets.filter(a => !a.phase || a.phase === "before");
  const afterAssets = assets.filter(a => a.phase === "after");

  const handleAddAfterPhotos = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const now = new Date().toISOString();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = e => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await apiRequest("POST", `/api/field-notes/sessions/${sessionId}/photo`, {
          fileUrl: dataUrl,
          phase: "after",
          capturedAt: now,
        });
        if (!res.ok) throw new Error("Upload failed");
      }
      toast({ title: `${files.length} after photo${files.length > 1 ? "s" : ""} added` });
      onAssetsAdded();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  function PhotoGrid({ items, startIndex }: { items: any[]; startIndex: number }) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {items.map((asset: any, i: number) => {
          const linkedEntry = entries.find(e => {
            try { const ids = JSON.parse(e.assetIds || "[]"); return ids.includes(asset.id); } catch { return false; }
          });
          return (
            <div
              key={asset.id}
              data-testid={`img-photo-${asset.id}`}
              className="rounded-xl overflow-hidden bg-muted border cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onPhotoClick(asset.fileUrl, linkedEntry)}
            >
              <img src={asset.fileUrl} alt={`Photo ${startIndex + i + 1}`} className="w-full aspect-square object-cover" />
              <div className="p-2 space-y-0.5">
                {linkedEntry && (
                  <p className="text-[11px] font-medium truncate">{linkedEntry.areaName || linkedEntry.title}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {asset.areaLabel ? `${asset.areaLabel} · ` : ""}Photo {startIndex + i + 1}
                  {asset.capturedAt ? ` · ${format(parseISO(asset.capturedAt), "h:mm a")}` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-14 text-muted-foreground">
        <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium text-sm">No photos captured</p>
      </div>
    );
  }

  const hasBothPhases = beforeAssets.length > 0 && afterAssets.length > 0;
  const isAllBefore = afterAssets.length === 0;

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => e.target.files && handleAddAfterPhotos(e.target.files)}
      />

      {/* Before Photos */}
      {beforeAssets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {hasBothPhases ? "Before Photos" : "Site Photos"} ({beforeAssets.length})
            </p>
          </div>
          <PhotoGrid items={beforeAssets} startIndex={0} />
        </div>
      )}

      {/* After Photos */}
      {afterAssets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              After Photos ({afterAssets.length})
            </p>
          </div>
          <PhotoGrid items={afterAssets} startIndex={beforeAssets.length} />
        </div>
      )}

      {/* Add After Photos */}
      {isAllBefore && (
        <div className="border border-dashed rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              <SplitSquareHorizontal className="w-4 h-4 text-muted-foreground" />
              Add After Photos
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Upload after-service photos to compare before &amp; after</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="button-add-after-photos"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
            {uploading ? "Uploading..." : "Add After Photos"}
          </Button>
        </div>
      )}
      {afterAssets.length > 0 && (
        <div className="border border-dashed rounded-xl p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Add more after photos</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="button-add-more-after-photos"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
            {uploading ? "Uploading..." : "Add More"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Transcript view ────────────────────────────────────────────────────────────
function TranscriptView({ chunks, assets }: { chunks: any[]; assets: any[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  type Event = { ms: number; type: "chunk" | "photo"; data: any };
  const events: Event[] = [
    ...chunks.map(c => ({ ms: c.startedAt ? new Date(c.startedAt).getTime() : 0, type: "chunk" as const, data: c })),
    ...assets.map(a => ({ ms: a.capturedAt ? new Date(a.capturedAt).getTime() : 0, type: "photo" as const, data: a })),
  ].sort((a, b) => a.ms - b.ms);
  const sessionStart = events[0]?.ms ?? 0;
  const fmtElapsed = (ms: number) => {
    const diff = Math.max(0, ms - sessionStart);
    const s = Math.floor(diff / 1000);
    return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  };

  if (events.length === 0) return (
    <div className="text-center py-16 text-muted-foreground">
      <Mic className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">No voice recording</p>
      <p className="text-xs mt-1">Voice notes appear here when recorded during a session.</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5 pb-4 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Source Transcript</p>
        <p className="text-xs text-muted-foreground">
          Raw voice-to-text in capture sequence. Times are relative to session start. This is the source record — the Document tab shows the cleaned version.
        </p>
      </div>
      <div className="space-y-2">
        {events.map((ev, i) => ev.type === "photo" ? (
          <div key={i} className="flex items-center gap-3 py-1">
            <code className="text-[10px] text-muted-foreground font-mono w-10 shrink-0">{fmtElapsed(ev.ms)}</code>
            <div
              className="flex items-center gap-2.5 bg-muted/60 border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted transition-colors flex-1"
              onClick={() => setLightbox(ev.data.fileUrl)}
            >
              <Camera className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <img src={ev.data.fileUrl} alt="" className="w-9 h-9 rounded object-cover border" />
              <div>
                <p className="text-xs font-medium">Photo {assets.indexOf(ev.data) + 1}</p>
                {ev.data.capturedAt && (
                  <p className="text-[10px] text-muted-foreground">{format(parseISO(ev.data.capturedAt), "h:mm:ss a")}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div key={i} className="flex gap-3">
            <code className="text-[10px] text-muted-foreground font-mono w-10 pt-2.5 shrink-0">{fmtElapsed(ev.ms)}</code>
            <div className="flex-1 bg-background border rounded-lg px-3.5 py-2.5">
              <p className="text-sm text-foreground/80 leading-relaxed">{ev.data.rawText}</p>
            </div>
          </div>
        ))}
      </div>
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-w-full max-h-full rounded-lg" alt="" />
          <button className="absolute top-4 right-4 text-white/80 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center" onClick={() => setLightbox(null)}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminFieldNotesSession() {
  const [location, navigate] = useLocation();
  const [, adminParams] = useRoute("/admin/field-notes/session/:id");
  const [, employeeParams] = useRoute("/employee/field-notes/session/:id");
  const sessionId = adminParams?.id ?? employeeParams?.id;
  const backPath = location.startsWith("/employee") ? "/employee/field-notes" : "/admin/field-notes";
  const { toast } = useToast();
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; entry?: any } | null>(null);
  const [showShare, setShowShare] = useState(false);

  const { data: session, isLoading } = useQuery<any>({
    queryKey: ["/api/field-notes/sessions", sessionId],
    queryFn: () => apiRequest("GET", `/api/field-notes/sessions/${sessionId}`).then(r => r.json()),
    enabled: !!sessionId,
    refetchInterval: (data: any) => (data?.status === "processing" || data?.status === "uploading") ? 3000 : false,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/field-notes/sessions/${sessionId}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] }); setEditingTitle(false); },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const processMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/field-notes/sessions/${sessionId}/process`).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] }); toast({ title: "AI processing started…" }); },
    onError: () => toast({ title: "Failed to start AI", variant: "destructive" }),
  });

  const saveQuoteMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/field-notes/sessions/${sessionId}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] });
      toast({ title: "Quote details saved" });
    },
    onError: () => toast({ title: "Failed to save quote", variant: "destructive" }),
  });

  if (isLoading || !session) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  const duration = session.endedAt ? differenceInMinutes(parseISO(session.endedAt), parseISO(session.startedAt)) : null;
  const entries: any[] = session.entries ?? [];
  const assets: any[] = session.assets ?? [];
  const chunks: any[] = session.transcriptChunks ?? [];
  const isProcessing = session.status === "processing" || session.status === "uploading";
  const isReady = session.status === "ready";
  const canShare = isReady && (entries.length > 0 || assets.length > 0);
  const documentMode: string = session.documentMode || "standard";
  const quoteData = parseQuoteData(session.quoteData);
  const aiExtracted = quoteData._aiExtracted as Record<string, any> | undefined;

  const areasToFocusOn = entries
    .map(e => e.recommendedAction)
    .filter((a): a is string => !!a && a.trim().length > 0);

  const toggleDocumentMode = () => {
    const newMode = documentMode === "quote" ? "standard" : "quote";
    // Auto-prefill from AI-extracted data when activating quote mode for the first time
    if (newMode === "quote" && aiExtracted && !quoteData.clientName) {
      const prefilled = {
        ...quoteData,
        squareFootage: quoteData.squareFootage || aiExtracted.squareFootage || "",
        numFloors: quoteData.numFloors || aiExtracted.numFloors || "",
        numOffices: quoteData.numOffices || aiExtracted.numOffices || "",
        numWashrooms: quoteData.numWashrooms || aiExtracted.numWashrooms || "",
        numKitchens: quoteData.numKitchens || aiExtracted.numKitchens || "",
        numHallways: quoteData.numHallways || aiExtracted.numHallways || "",
        numEntrances: quoteData.numEntrances || aiExtracted.numEntrances || "",
        specialSurfaces: quoteData.specialSurfaces || aiExtracted.specialSurfaces || "",
        siteAddress: quoteData.siteAddress || session.locationName || "",
      };
      updateMutation.mutate({ documentMode: newMode, quoteData: JSON.stringify(prefilled) });
    } else {
      updateMutation.mutate({ documentMode: newMode });
    }
  };

  const handleSaveQuote = (data: Record<string, any>) => {
    saveQuoteMutation.mutate({ quoteData: JSON.stringify(data) });
  };

  const handleApplyExtracted = (extracted: Record<string, any>) => {
    const merged = { ...quoteData, ...extracted };
    saveQuoteMutation.mutate({ quoteData: JSON.stringify(merged) });
    toast({ title: "AI details applied to quote fields" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="border-b bg-background px-4 md:px-6 pt-3 pb-2 print:hidden">
        {/* Back link */}
        <button data-testid="button-back-session"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs mb-2"
          onClick={() => navigate(backPath)}>
          <ChevronLeft className="w-3.5 h-3.5" /> Field Notes
        </button>

        {/* Desktop: side-by-side | Mobile: stacked */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between md:gap-2">

          {/* Left / top: title + compact metadata */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            {editingTitle ? (
              <div className="flex items-center gap-1.5 mb-1">
                <Input data-testid="input-session-title-edit" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-7 text-sm font-semibold" autoFocus />
                <Button size="icon" variant="ghost" className="w-7 h-7 shrink-0" onClick={() => updateMutation.mutate({ title: editTitle })}><Check className="w-3.5 h-3.5" /></Button>
                <Button size="icon" variant="ghost" className="w-7 h-7 shrink-0" onClick={() => setEditingTitle(false)}><X className="w-3.5 h-3.5" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mb-1">
                <h1 className="text-sm font-semibold leading-tight truncate">{session.title || SESSION_TYPE_LABELS[session.sessionType] || session.sessionType}</h1>
                <button data-testid="button-edit-title" className="text-muted-foreground hover:text-foreground shrink-0" onClick={() => { setEditTitle(session.title ?? ""); setEditingTitle(true); }}>
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Metadata: row 1 — date · duration + badge */}
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3 shrink-0" />
                {format(parseISO(session.startedAt), "MMM d, h:mm a")}
                {duration !== null ? ` · ${duration}m` : ""}
              </span>
              <span className={cn(
                "text-[10px] px-1.5 py-px rounded-full border font-medium leading-tight",
                documentMode === "quote"
                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800"
                  : "bg-muted text-muted-foreground border-border"
              )}>
                {documentMode === "quote" ? "Quote Proposal" : "Site Visit Note"}
              </span>
            </div>

            {/* Metadata: row 2 — location · name */}
            {(session.locationName || session.createdByName) && (
              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                {session.locationName && (
                  <span className="flex items-center gap-0.5 min-w-0">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{session.locationName}</span>
                  </span>
                )}
                {session.createdByName && (
                  <span className="flex items-center gap-0.5 min-w-0">
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate">{session.createdByName}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right / below on mobile: action buttons */}
          <div className="flex gap-1.5 flex-wrap mt-2 md:mt-0 md:flex-shrink-0 md:flex-nowrap md:justify-end">
            {canShare && isReady && (
              <Button
                data-testid="button-toggle-mode"
                size="sm"
                variant="outline"
                className={cn("gap-1 text-xs h-7", documentMode === "quote" && "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400")}
                onClick={toggleDocumentMode}
                disabled={updateMutation.isPending}
              >
                <DollarSign className="w-3 h-3" />
                {documentMode === "quote" ? "Switch to Note" : "Turn into Quote"}
              </Button>
            )}
            {canShare && (
              <Button data-testid="button-print-doc" size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => window.print()}>
                <Printer className="w-3 h-3" /> Print
              </Button>
            )}
            {canShare && (
              <Button data-testid="button-share-doc" size="sm" variant={showShare ? "default" : "outline"} className="gap-1 text-xs h-7" onClick={() => setShowShare(s => !s)}>
                <Share2 className="w-3 h-3" /> Share
              </Button>
            )}
            {(session.aiStatus === "failed" || (isReady && entries.length === 0)) && (
              <Button data-testid="button-retry-ai" size="sm" variant="outline" onClick={() => processMutation.mutate()} disabled={processMutation.isPending} className="gap-1 text-xs h-7">
                {processMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Process AI
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Share panel */}
      {showShare && canShare && (
        <div className="border-b px-4 md:px-6 py-3 print:hidden">
          <SharePanel session={session} publicDoc={session.publicDoc} sessionId={sessionId!} />
        </div>
      )}

      {isProcessing && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 px-4 py-2 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 print:hidden">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          AI is analyzing your recording… usually 15–30 seconds.
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue="document" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 md:mx-6 mt-2 self-start h-8 print:hidden">
            <TabsTrigger data-testid="tab-document" value="document" className="text-xs px-3">
              <NotebookPen className="w-3 h-3 mr-1" />Document {entries.length > 0 ? `(${entries.length})` : ""}
            </TabsTrigger>
            <TabsTrigger data-testid="tab-photos" value="photos" className="text-xs px-3">
              <Images className="w-3 h-3 mr-1" />Photos {assets.length > 0 ? `(${assets.length})` : ""}
            </TabsTrigger>
            <TabsTrigger data-testid="tab-transcript" value="transcript" className="text-xs px-3">
              <FileText className="w-3 h-3 mr-1" />Transcript
            </TabsTrigger>
          </TabsList>

          {/* ── DOCUMENT TAB ── */}
          <TabsContent value="document" className="flex-1 overflow-y-auto mt-0">
            {entries.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground px-4">
                <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">{isProcessing ? "Generating document…" : "No notes yet"}</p>
                {!isProcessing && (
                  <p className="text-xs mt-1 max-w-xs mx-auto">
                    {assets.length > 0 || chunks.length > 0
                      ? "Click 'Process AI' to generate structured documentation"
                      : "Start a recording session with photos or voice to generate notes"}
                  </p>
                )}
              </div>
            ) : (
              <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-0">

                {/* AI extracted details panel (admin only) */}
                {aiExtracted && (
                  <AiExtractedPanel extracted={aiExtracted} onApply={handleApplyExtracted} />
                )}

                {/* Document intro paragraph */}
                {session.aiSummary && (
                  <div className="mb-8">
                    <p className="text-sm text-foreground/80 leading-relaxed">{session.aiSummary}</p>
                    <div className="h-px bg-border mt-6" />
                  </div>
                )}

                {/* Observations — grouped by area */}
                {(() => {
                  // Group entries by areaName
                  const areaGroups = new Map<string, any[]>();
                  for (const entry of entries) {
                    const key = entry.areaName || "General Overview";
                    if (!areaGroups.has(key)) areaGroups.set(key, []);
                    areaGroups.get(key)!.push(entry);
                  }
                  const grouped = Array.from(areaGroups.entries());
                  const multiArea = grouped.length > 1;
                  let globalIndex = 0;
                  return (
                    <div className="space-y-10">
                      {grouped.map(([area, areaEntries]) => (
                        <div key={area}>
                          {multiArea && (
                            <div className="flex items-center gap-3 mb-4">
                              <h2 className="text-sm font-bold text-foreground">{area}</h2>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}
                          <div className="space-y-10">
                            {areaEntries.map((entry: any) => {
                              globalIndex++;
                              return (
                                <DocumentObservation
                                  key={entry.id}
                                  entry={entry}
                                  assets={assets}
                                  sessionId={sessionId!}
                                  index={globalIndex}
                                  onPhotoClick={(url, e) => setLightboxPhoto({ url, entry: e })}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Areas to focus on */}
                {areasToFocusOn.length > 0 && (
                  <div className="mt-10 pt-6 border-t">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Areas to Focus On</p>
                    <ul className="space-y-2">
                      {areasToFocusOn.map((action, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
                          <span className="text-muted-foreground font-medium shrink-0 mt-0.5">{i + 1}.</span>
                          <span className="leading-relaxed">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Quote section (when in quote mode) */}
                {documentMode === "quote" && (
                  <QuoteSection
                    sessionId={sessionId!}
                    quoteData={quoteData}
                    onSave={handleSaveQuote}
                  />
                )}

                {/* Closing */}
                <div className="mt-8 pt-5 border-t">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                    <NotebookPen className="w-3 h-3" />
                    <span>Field Note · {format(parseISO(session.startedAt), "MMMM d, yyyy")}</span>
                    {session.createdByName && <span>· Prepared by {session.createdByName}</span>}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── PHOTOS TAB ── */}
          <TabsContent value="photos" className="flex-1 overflow-y-auto px-4 md:px-6 py-4 mt-0">
            <PhotosTabContent
              assets={assets}
              entries={entries}
              sessionId={session.id}
              onPhotoClick={(url, entry) => setLightboxPhoto({ url, entry })}
              onAssetsAdded={() => queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", session.id] })}
            />
          </TabsContent>

          {/* ── TRANSCRIPT TAB ── */}
          <TabsContent value="transcript" className="flex-1 overflow-y-auto px-4 md:px-6 py-4 mt-0">
            <TranscriptView chunks={chunks} assets={assets} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col" onClick={() => setLightboxPhoto(null)}>
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={lightboxPhoto.url} className="max-w-full max-h-full rounded-lg" alt="Full size" />
          </div>
          {lightboxPhoto.entry && (
            <div className="bg-black/80 px-4 py-3 flex-none" onClick={e => e.stopPropagation()}>
              <p className="text-white font-semibold text-sm">{lightboxPhoto.entry.title}</p>
              {lightboxPhoto.entry.relatedTranscript && (
                <p className="text-white/60 text-xs mt-0.5 italic">"{lightboxPhoto.entry.relatedTranscript}"</p>
              )}
              {lightboxPhoto.entry.body && <p className="text-white/80 text-xs mt-1">{lightboxPhoto.entry.body}</p>}
            </div>
          )}
          <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:text-white" onClick={() => setLightboxPhoto(null)}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
