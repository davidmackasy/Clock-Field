import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Save, Globe, EyeOff, Plus, Trash2, ImagePlus, Mic, MicOff,
  Sparkles, ChevronDown, ChevronUp, GripVertical, Copy, ExternalLink,
  DollarSign, ChevronRight, Loader2, X, FileText
} from "lucide-react";

const SECTION_TYPES = [
  { value: "text", label: "Text + Images" },
  { value: "gallery", label: "Image Gallery" },
  { value: "callout", label: "Callout / Highlight" },
  { value: "faq", label: "FAQ / Q&A" },
  { value: "cta", label: "Call to Action" },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:       { label: "Draft",       color: "bg-gray-100 text-gray-600" },
  published:   { label: "Published",   color: "bg-green-100 text-green-700" },
  unpublished: { label: "Unpublished", color: "bg-yellow-100 text-yellow-700" },
  archived:    { label: "Archived",    color: "bg-slate-100 text-slate-500" },
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function VoiceButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [active, setActive] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (active) {
      recognitionRef.current?.stop();
      setActive(false);
      return;
    }
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .filter((res: any) => res.isFinal)
        .map((res: any) => res[0].transcript)
        .join(" ");
      if (transcript) onTranscript(transcript);
    };
    r.onend = () => setActive(false);
    r.onerror = () => setActive(false);
    recognitionRef.current = r;
    r.start();
    setActive(true);
  };

  return (
    <Button
      type="button"
      variant={active ? "destructive" : "outline"}
      size="sm"
      onClick={toggle}
      className="gap-1.5 text-xs"
      title={active ? "Stop recording" : "Start voice recording"}
      data-testid="button-voice"
    >
      {active ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
      {active ? "Stop" : "Voice"}
    </Button>
  );
}

function AIAssistButton({ text, action, onResult, context }: {
  text: string;
  action: string;
  onResult: (r: string) => void;
  context?: string;
}) {
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const resp = await apiRequest("POST", "/api/publications/ai-assist", { text, action, context });
      const data = await resp.json();
      if (data.result) onResult(data.result);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={run}
      disabled={loading || !text.trim()}
      className="gap-1.5 text-xs"
      data-testid={`button-ai-${action}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      {action === "improve" ? "Improve" : action === "professional" ? "Make Professional" : "AI Assist"}
    </Button>
  );
}

function SectionCard({
  section,
  pubId,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onDelete,
  onSaved,
}: {
  section: any;
  pubId: string;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onSaved: (updated: any) => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [title, setTitle] = useState(section.title || "");
  const [body, setBody] = useState(section.body || "");
  const [sectionType, setSectionType] = useState(section.sectionType || "text");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const media: any[] = section.media || [];

  const save = async () => {
    setSaving(true);
    try {
      const resp = await apiRequest("PATCH", `/api/publications/${pubId}/sections/${section.id}`, {
        title: title || null,
        body: body || null,
        sectionType,
      });
      const updated = await resp.json();
      onSaved({ ...updated, media });
      setDirty(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uploadImages = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const imageData = await fileToBase64(file);
      try {
        const resp = await apiRequest("POST", `/api/publications/${pubId}/sections/${section.id}/media`, { imageData });
        const newMedia = await resp.json();
        onSaved({ ...section, title, body, sectionType, media: [...media, newMedia] });
      } catch (e: any) {
        toast({ title: "Upload failed", description: e.message, variant: "destructive" });
      }
    }
  };

  const deleteMedia = async (mediaId: string) => {
    try {
      await apiRequest("DELETE", `/api/publications/${pubId}/media/${mediaId}`);
      onSaved({ ...section, title, body, sectionType, media: media.filter((m: any) => m.id !== mediaId) });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const updateCaption = async (mediaId: string, caption: string) => {
    try {
      const resp = await apiRequest("PATCH", `/api/publications/${pubId}/media/${mediaId}`, { caption });
      const updated = await resp.json();
      onSaved({ ...section, title, body, sectionType, media: media.map((m: any) => m.id === mediaId ? updated : m) });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card className="border-gray-200" data-testid={`card-section-${section.id}`}>
      <CardHeader className="px-4 py-3 flex flex-row items-center gap-2 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}>
        <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-700">
            {title || `Section ${index + 1}`}
          </span>
          <span className="text-xs text-gray-400 ml-2">
            {SECTION_TYPES.find(t => t.value === sectionType)?.label || sectionType}
          </span>
        </div>
        {dirty && <Badge className="text-[10px] bg-amber-100 text-amber-700">Unsaved</Badge>}
        <div className="flex items-center gap-0.5 ml-auto" onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onMoveUp} disabled={index === 0}
            title="Move up" data-testid={`button-section-up-${section.id}`}>
            <ChevronUp className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onMoveDown} disabled={index === total - 1}
            title="Move down" data-testid={`button-section-down-${section.id}`}>
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7 text-gray-400 hover:text-destructive"
            onClick={onDelete} title="Delete section" data-testid={`button-section-delete-${section.id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0 space-y-3 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Section Type</Label>
              <Select value={sectionType} onValueChange={v => { setSectionType(v); setDirty(true); }}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-section-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Section Heading</Label>
              <Input
                value={title}
                onChange={e => { setTitle(e.target.value); setDirty(true); }}
                placeholder="Optional heading"
                className="h-8 text-xs"
                data-testid="input-section-title"
              />
            </div>
          </div>

          {sectionType !== "gallery" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Content</Label>
                <div className="flex gap-1">
                  <VoiceButton onTranscript={t => { setBody(b => b ? b + " " + t : t); setDirty(true); }} />
                  <AIAssistButton
                    text={body}
                    action="improve"
                    onResult={r => { setBody(r); setDirty(true); }}
                  />
                  <AIAssistButton
                    text={body}
                    action="professional"
                    onResult={r => { setBody(r); setDirty(true); }}
                  />
                </div>
              </div>
              <Textarea
                value={body}
                onChange={e => { setBody(e.target.value); setDirty(true); }}
                placeholder="Write section content here, or use Voice or AI Assist above…"
                rows={4}
                className="text-sm resize-y"
                data-testid="textarea-section-body"
              />
            </div>
          )}

          {/* Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Images</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => fileRef.current?.click()}
                data-testid="button-add-images"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                Add Images
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => e.target.files && uploadImages(e.target.files)}
            />
            {media.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {media.map((m: any) => (
                  <div key={m.id} className="relative group rounded-lg overflow-hidden border border-gray-200"
                    data-testid={`img-media-${m.id}`}>
                    <img
                      src={m.imageData}
                      alt={m.caption || ""}
                      className="w-full aspect-video object-cover"
                    />
                    <button
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteMedia(m.id)}
                      type="button"
                      title="Remove image"
                      data-testid={`button-remove-media-${m.id}`}
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                    <div className="p-1.5">
                      <input
                        className="w-full text-[10px] text-gray-500 bg-transparent border-0 outline-none placeholder:text-gray-300 truncate"
                        placeholder="Add caption…"
                        defaultValue={m.caption || ""}
                        onBlur={e => e.target.value !== (m.caption || "") && updateCaption(m.id, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {dirty && (
            <Button size="sm" onClick={save} disabled={saving} className="text-xs" data-testid="button-save-section">
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save Section
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function PricingCard({ item, pubId, onDelete, onSaved }: {
  item: any; pubId: string; onDelete: () => void; onSaved: (updated: any) => void;
}) {
  const { toast } = useToast();
  const [itemName, setItemName] = useState(item.itemName || "");
  const [description, setDescription] = useState(item.description || "");
  const [price, setPrice] = useState(item.price || "");
  const [unit, setUnit] = useState(item.unit || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const resp = await apiRequest("PATCH", `/api/publications/${pubId}/pricing/${item.id}`, {
        itemName, description: description || null, price: price || null, unit: unit || null,
      });
      onSaved(await resp.json());
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2" data-testid={`card-pricing-${item.id}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 grid grid-cols-2 gap-2">
          <Input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Item name *"
            className="h-7 text-xs" data-testid="input-pricing-name" />
          <div className="flex gap-1">
            <Input value={price} onChange={e => setPrice(e.target.value)} placeholder="Price"
              className="h-7 text-xs" data-testid="input-pricing-price" />
            <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit"
              className="h-7 text-xs w-20" data-testid="input-pricing-unit" />
          </div>
        </div>
        <Button variant="ghost" size="icon" className="w-7 h-7 text-gray-400 hover:text-destructive shrink-0"
          onClick={onDelete} data-testid={`button-delete-pricing-${item.id}`}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)"
        className="h-7 text-xs" data-testid="input-pricing-desc" />
      <Button size="sm" onClick={save} disabled={saving || !itemName} className="text-xs h-7"
        data-testid="button-save-pricing">
        {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
        Save
      </Button>
    </div>
  );
}

export default function AdminPublicationEditor() {
  const [, params] = useRoute("/admin/publications/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isNew = params?.id === "new";

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [introText, setIntroText] = useState("");
  const [category, setCategory] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [helpfulVotingEnabled, setHelpfulVotingEnabled] = useState(true);
  const [contactCtaEnabled, setContactCtaEnabled] = useState(true);
  const [coverImageData, setCoverImageData] = useState<string | null>(null);
  const [seoOpen, setSeoOpen] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [deleteSection, setDeleteSection] = useState<string | null>(null);
  const [deletePricingItem, setDeletePricingItem] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [pubId, setPubId] = useState<string | null>(isNew ? null : params?.id || null);
  const [status, setStatus] = useState("draft");
  const [loadedPub, setLoadedPub] = useState<any>(null);

  const { data: pubData, isLoading } = useQuery<any>({
    queryKey: ["/api/publications", pubId],
    enabled: !!pubId && !isNew,
  });

  useEffect(() => {
    if (pubData && !loadedPub) {
      setLoadedPub(pubData);
      setTitle(pubData.title || "");
      setSubtitle(pubData.subtitle || "");
      setSlug(pubData.slug || "");
      setIntroText(pubData.introText || "");
      setCategory(pubData.category || "");
      setSeoTitle(pubData.seoTitle || "");
      setSeoDescription(pubData.seoDescription || "");
      setHelpfulVotingEnabled(pubData.helpfulVotingEnabled !== false);
      setContactCtaEnabled(pubData.contactCtaEnabled !== false);
      setCoverImageData(pubData.coverImageData || null);
      setSections(pubData.sections || []);
      setPricing(pubData.pricing || []);
      setStatus(pubData.status || "draft");
    }
  }, [pubData, loadedPub]);

  const autoSlug = (t: string) =>
    t.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim().slice(0, 80);

  const saveMeta = async (overrides: Record<string, any> = {}) => {
    setSaving(true);
    try {
      if (isNew || !pubId) {
        const resp = await apiRequest("POST", "/api/publications", {
          title, subtitle: subtitle || null, slug: slug || autoSlug(title),
          introText: introText || null, category: category || null,
          seoTitle: seoTitle || null, seoDescription: seoDescription || null,
          coverImageData: coverImageData || null,
          helpfulVotingEnabled, contactCtaEnabled,
          ...overrides,
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.message);
        }
        const newPub = await resp.json();
        setPubId(newPub.id);
        setSlug(newPub.slug);
        setStatus(newPub.status);
        setLoadedPub(null);
        queryClient.invalidateQueries({ queryKey: ["/api/publications"] });
        navigate(`/admin/publications/${newPub.id}`, { replace: true });
        toast({ title: "Publication created" });
      } else {
        const resp = await apiRequest("PATCH", `/api/publications/${pubId}`, {
          title, subtitle: subtitle || null, slug: slug || autoSlug(title),
          introText: introText || null, category: category || null,
          seoTitle: seoTitle || null, seoDescription: seoDescription || null,
          coverImageData: coverImageData || null,
          helpfulVotingEnabled, contactCtaEnabled,
          ...overrides,
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.message);
        }
        const updated = await resp.json();
        setSlug(updated.slug);
        setStatus(updated.status);
        queryClient.invalidateQueries({ queryKey: ["/api/publications"] });
        toast({ title: "Saved" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = () => {
    const newStatus = status === "published" ? "unpublished" : "published";
    saveMeta({ status: newStatus }).then(() => setStatus(newStatus));
  };

  const addSection = async () => {
    if (!pubId) {
      toast({ title: "Save the publication first before adding sections." });
      return;
    }
    try {
      const resp = await apiRequest("POST", `/api/publications/${pubId}/sections`, { sectionType: "text" });
      const section = await resp.json();
      setSections(prev => [...prev, section]);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const confirmDeleteSection = async () => {
    if (!deleteSection || !pubId) return;
    try {
      await apiRequest("DELETE", `/api/publications/${pubId}/sections/${deleteSection}`);
      setSections(prev => prev.filter(s => s.id !== deleteSection));
      setDeleteSection(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const moveSection = async (idx: number, dir: -1 | 1) => {
    const newSections = [...sections];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= newSections.length) return;
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];
    setSections(newSections);
    if (pubId) {
      try {
        await apiRequest("PATCH", `/api/publications/${pubId}/sections/reorder`, {
          order: newSections.map(s => s.id),
        });
      } catch {}
    }
  };

  const addPricing = async () => {
    if (!pubId) {
      toast({ title: "Save the publication first." });
      return;
    }
    try {
      const resp = await apiRequest("POST", `/api/publications/${pubId}/pricing`, { itemName: "Service Item" });
      const item = await resp.json();
      setPricing(prev => [...prev, item]);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const confirmDeletePricing = async () => {
    if (!deletePricingItem || !pubId) return;
    try {
      await apiRequest("DELETE", `/api/publications/${pubId}/pricing/${deletePricingItem}`);
      setPricing(prev => prev.filter(p => p.id !== deletePricingItem));
      setDeletePricingItem(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleCoverImage = async (file: File) => {
    const data = await fileToBase64(file);
    setCoverImageData(data);
  };

  const meta = STATUS_META[status] || STATUS_META.draft;

  if (!isNew && isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-5">

        {/* Top Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate("/admin/publications")}
            className="text-gray-400 hover:text-gray-700 transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1 min-w-0 truncate">
            {isNew ? "New Publication" : title || "Edit Publication"}
          </h1>
          <Badge className={`text-[11px] px-2 py-0.5 ${meta.color}`}>{meta.label}</Badge>
          {pubId && status === "published" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-600 gap-1 text-xs"
              onClick={() => window.open(`/p/${slug}`, "_blank")}
              data-testid="button-preview-live"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Live
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => saveMeta()}
            disabled={saving}
            className="gap-1.5"
            data-testid="button-save"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </Button>
          <Button
            size="sm"
            variant={status === "published" ? "outline" : "default"}
            onClick={togglePublish}
            disabled={saving || !title}
            className="gap-1.5"
            data-testid="button-publish"
          >
            {status === "published"
              ? <><EyeOff className="w-3.5 h-3.5" />Unpublish</>
              : <><Globe className="w-3.5 h-3.5" />Publish</>
            }
          </Button>
        </div>

        {/* Public URL preview */}
        {slug && (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono truncate">{window.location.origin}/p/{slug}</span>
            <button
              className="ml-auto shrink-0 hover:text-gray-600"
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`).then(() => toast({ title: "Link copied!" }))}
              data-testid="button-copy-link"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Basic Info ───────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Publication Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Title *</Label>
              <Input
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  if (!slug || slug === autoSlug(loadedPub?.title || "")) {
                    setSlug(autoSlug(e.target.value));
                  }
                }}
                placeholder="e.g. GLOBE Feminine Dispensers"
                className="font-medium"
                data-testid="input-title"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Subtitle <span className="text-gray-400">(optional)</span></Label>
              <Input
                value={subtitle}
                onChange={e => setSubtitle(e.target.value)}
                placeholder="e.g. Inspection · Product Overview"
                data-testid="input-subtitle"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category <span className="text-gray-400">(optional)</span></Label>
                <Input
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="e.g. Products, Services"
                  data-testid="input-category"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL Slug</Label>
                <Input
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^\w-]/g, "").slice(0, 80))}
                  placeholder="auto-generated from title"
                  className="font-mono text-xs"
                  data-testid="input-slug"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Introduction Paragraph</Label>
                <div className="flex gap-1">
                  <VoiceButton onTranscript={t => setIntroText(p => p ? p + " " + t : t)} />
                  <AIAssistButton text={introText} action="improve" onResult={setIntroText} />
                </div>
              </div>
              <Textarea
                value={introText}
                onChange={e => setIntroText(e.target.value)}
                placeholder="Describe what this publication is about…"
                rows={3}
                data-testid="textarea-intro"
              />
            </div>

            {/* Cover Image */}
            <div className="space-y-2">
              <Label className="text-xs">Cover Image <span className="text-gray-400">(optional)</span></Label>
              {coverImageData ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 group">
                  <img src={coverImageData} alt="Cover" className="w-full max-h-48 object-cover" />
                  <button
                    type="button"
                    onClick={() => setCoverImageData(null)}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 rounded-full w-7 h-7 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid="button-remove-cover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coverRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors"
                  data-testid="button-upload-cover"
                >
                  <ImagePlus className="w-6 h-6" />
                  <span className="text-xs">Click to upload cover image</span>
                </button>
              )}
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleCoverImage(e.target.files[0])}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── SEO Settings ─────────────────────────────────────────────────── */}
        <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              data-testid="button-seo-toggle">
              SEO Settings
              {seoOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-gray-200">
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">SEO Title</Label>
                    <AIAssistButton text={title} action="professional" onResult={setSeoTitle} />
                  </div>
                  <Input
                    value={seoTitle}
                    onChange={e => setSeoTitle(e.target.value)}
                    placeholder={title || "Page title for search engines"}
                    data-testid="input-seo-title"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">SEO Description <span className="text-gray-400">· max 155 chars</span></Label>
                    <AIAssistButton text={introText || title} action="seo_description" onResult={setSeoDescription} />
                  </div>
                  <Textarea
                    value={seoDescription}
                    onChange={e => setSeoDescription(e.target.value.slice(0, 155))}
                    placeholder="Short description for search engine results…"
                    rows={2}
                    data-testid="textarea-seo-desc"
                  />
                  <p className="text-[10px] text-gray-400 text-right">{seoDescription.length}/155</p>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Settings ─────────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Show "Was this helpful?" vote</p>
                <p className="text-xs text-gray-400">Visitors can vote yes/no at the bottom of the page</p>
              </div>
              <Switch
                checked={helpfulVotingEnabled}
                onCheckedChange={setHelpfulVotingEnabled}
                data-testid="switch-voting"
              />
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <div>
                <p className="text-sm font-medium">Show Contact Business CTA</p>
                <p className="text-xs text-gray-400">Displays a contact button using your business details</p>
              </div>
              <Switch
                checked={contactCtaEnabled}
                onCheckedChange={setContactCtaEnabled}
                data-testid="switch-contact-cta"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Content Sections ──────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Content Sections</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSection}
              className="gap-1.5 text-xs"
              data-testid="button-add-section"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Section
            </Button>
          </div>

          {sections.length === 0 && (
            <div className="border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400">
              <FileText className="w-6 h-6" />
              <p className="text-xs">No sections yet. Add your first content section above.</p>
            </div>
          )}

          {sections.map((section, idx) => (
            <SectionCard
              key={section.id}
              section={section}
              pubId={pubId || ""}
              index={idx}
              total={sections.length}
              onMoveUp={() => moveSection(idx, -1)}
              onMoveDown={() => moveSection(idx, 1)}
              onDelete={() => setDeleteSection(section.id)}
              onSaved={updated => setSections(prev => prev.map(s => s.id === updated.id ? updated : s))}
            />
          ))}
        </div>

        {/* ── Pricing ──────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-800">Pricing <span className="text-gray-400 font-normal">(optional)</span></h2>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPricing}
              className="gap-1.5 text-xs"
              data-testid="button-add-pricing"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </Button>
          </div>

          {pricing.length > 0 && (
            <Card>
              <CardContent className="pt-4 space-y-2">
                {pricing.map(item => (
                  <PricingCard
                    key={item.id}
                    item={item}
                    pubId={pubId || ""}
                    onDelete={() => setDeletePricingItem(item.id)}
                    onSaved={updated => setPricing(prev => prev.map(p => p.id === updated.id ? updated : p))}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Bottom save/publish bar */}
        <div className="flex gap-3 justify-end pb-8">
          <Button variant="outline" onClick={() => saveMeta()} disabled={saving} data-testid="button-save-bottom">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
          <Button
            onClick={togglePublish}
            disabled={saving || !title}
            variant={status === "published" ? "outline" : "default"}
            data-testid="button-publish-bottom"
          >
            {status === "published"
              ? <><EyeOff className="w-4 h-4 mr-2" />Unpublish</>
              : <><Globe className="w-4 h-4 mr-2" />Publish</>
            }
          </Button>
        </div>
      </div>

      {/* Delete Section Confirm */}
      <AlertDialog open={!!deleteSection} onOpenChange={o => !o && setDeleteSection(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this section and all its images.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSection} className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-section">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Pricing Confirm */}
      <AlertDialog open={!!deletePricingItem} onOpenChange={o => !o && setDeletePricingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Pricing Item?</AlertDialogTitle>
            <AlertDialogDescription>This pricing item will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePricing} className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-pricing">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
