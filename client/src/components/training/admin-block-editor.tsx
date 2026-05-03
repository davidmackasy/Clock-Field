import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, ChevronUp, ChevronDown, Trash2, Loader2, Sparkles, Wand2,
  FileText, ShieldAlert, ListChecks, ListOrdered, ImageIcon, Image as ImageLucide, X,
} from "lucide-react";
import type { LessonBlock } from "./lesson-blocks";

const BLOCK_TYPES: { value: string; label: string; icon: any; desc: string }[] = [
  { value: "text",           label: "Text",            icon: FileText,    desc: "Free-form lesson text" },
  { value: "safety_tip",     label: "Safety Tip",      icon: ShieldAlert, desc: "Highlighted warning / note" },
  { value: "ai_explanation", label: "AI Explanation",  icon: Sparkles,    desc: "Detailed explanation block" },
  { value: "image",          label: "Image",           icon: ImageLucide, desc: "Single image with caption" },
  { value: "image_prompt",   label: "Image Suggested",  icon: ImageIcon,   desc: "Describe an image to add" },
  { value: "gallery",        label: "Gallery",         icon: ImageIcon,   desc: "Multiple images" },
  { value: "checklist",      label: "Checklist",       icon: ListChecks,  desc: "Bulleted list" },
  { value: "step_by_step",   label: "Step-by-step",    icon: ListOrdered, desc: "Numbered steps" },
];

export function AdminBlockEditor({ moduleId, moduleTitle, courseTitle, courseDescription }: {
  moduleId: string;
  moduleTitle: string;
  courseTitle?: string;
  courseDescription?: string | null;
}) {
  const { toast } = useToast();
  const queryKey = ["/api/training/modules", moduleId, "blocks"] as const;
  const { data: blocks = [], isLoading } = useQuery<LessonBlock[]>({
    queryKey: queryKey as any,
    queryFn: () => fetch(`/api/training/modules/${moduleId}/blocks`, { credentials: "include" }).then(r => r.json()),
    enabled: !!moduleId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKey as any });

  const create = useMutation({
    mutationFn: (data: Partial<LessonBlock> & { type: string }) =>
      apiRequest("POST", `/api/training/modules/${moduleId}/blocks`, data),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ variant: "destructive", title: "Failed to add", description: e?.message }),
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LessonBlock> }) =>
      apiRequest("PATCH", `/api/training/blocks/${id}`, data),
    onSuccess: () => invalidate(),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/training/blocks/${id}`),
    onSuccess: () => invalidate(),
  });
  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiRequest("POST", `/api/training/modules/${moduleId}/blocks/reorder`, { orderedIds }),
    onSuccess: () => invalidate(),
  });

  const aiGenerate = useMutation({
    mutationFn: () => apiRequest("POST", "/api/training/ai/generate-blocks", { moduleTitle, courseTitle, courseDescription }).then(r => r.json()),
    onSuccess: async (resp: any) => {
      const list = Array.isArray(resp?.blocks) ? resp.blocks : [];
      // Create blocks sequentially so sort_order is preserved
      for (const b of list) await apiRequest("POST", `/api/training/modules/${moduleId}/blocks`, b);
      invalidate();
      toast({ title: "AI blocks added", description: `${list.length} block${list.length === 1 ? "" : "s"} created` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "AI generation failed", description: e?.message }),
  });

  const sorted = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);

  const move = (index: number, dir: -1 | 1) => {
    const swap = index + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const ids = sorted.map(b => b.id);
    [ids[index], ids[swap]] = [ids[swap], ids[index]];
    reorder.mutate(ids);
  };

  const addBlock = (type: string) => {
    const defaults: any = { type };
    if (type === "text" || type === "safety_tip" || type === "ai_explanation") { defaults.title = ""; defaults.content = ""; }
    if (type === "image_prompt") { defaults.title = "Image suggested"; defaults.imagePrompt = ""; }
    if (type === "image") { defaults.title = ""; defaults.assetData = ""; defaults.caption = ""; }
    if (type === "gallery") { defaults.title = "Gallery"; defaults.galleryJson = "[]"; }
    if (type === "checklist") { defaults.title = "Checklist"; defaults.checklistJson = "[]"; }
    if (type === "step_by_step") { defaults.title = "Steps"; defaults.stepsJson = "[]"; }
    create.mutate(defaults);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Lesson Blocks</Label>
        <div className="flex items-center gap-2">
          {moduleTitle && (
            <Button variant="outline" size="sm" type="button" onClick={() => aiGenerate.mutate()} disabled={aiGenerate.isPending} data-testid="btn-ai-generate-blocks">
              {aiGenerate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
              Generate with AI
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" type="button" data-testid="btn-add-block">
                <Plus className="w-3.5 h-3.5 mr-1" />Add Block
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {BLOCK_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <DropdownMenuItem key={t.value} onClick={() => addBlock(t.value)} data-testid={`btn-add-block-${t.value}`}>
                    <Icon className="w-4 h-4 mr-2 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{t.label}</span>
                      <span className="text-[11px] text-muted-foreground">{t.desc}</span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading blocks…</div>}
      {!isLoading && sorted.length === 0 && (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">
          No lesson blocks yet. Add one or generate with AI.
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((b, idx) => (
          <BlockRow
            key={b.id}
            block={b}
            index={idx}
            count={sorted.length}
            moduleTitle={moduleTitle}
            onMoveUp={() => move(idx, -1)}
            onMoveDown={() => move(idx, +1)}
            onDelete={() => remove.mutate(b.id)}
            onSave={(data) => update.mutate({ id: b.id, data })}
          />
        ))}
      </div>
    </div>
  );
}

function BlockRow({ block, index, count, moduleTitle, onMoveUp, onMoveDown, onDelete, onSave }: {
  block: LessonBlock;
  index: number;
  count: number;
  moduleTitle: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onSave: (data: Partial<LessonBlock>) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(block.title ?? "");
  const [content, setContent] = useState(block.content ?? "");
  const [caption, setCaption] = useState(block.caption ?? "");
  const [imagePrompt, setImagePrompt] = useState(block.imagePrompt ?? "");
  const [assetData, setAssetData] = useState(block.assetData ?? "");
  const [gallery, setGallery] = useState<{ imageData: string; caption?: string }[]>(() => {
    try { return JSON.parse(block.galleryJson || "[]"); } catch { return []; }
  });
  const [checklist, setChecklist] = useState<string[]>(() => {
    try { return JSON.parse(block.checklistJson || "[]"); } catch { return []; }
  });
  const [steps, setSteps] = useState<{ title: string; description: string }[]>(() => {
    try { return JSON.parse(block.stepsJson || "[]"); } catch { return []; }
  });
  const [improving, setImproving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const typeMeta = BLOCK_TYPES.find(t => t.value === block.type);
  const Icon = typeMeta?.icon ?? FileText;

  const persist = () => {
    const data: any = { title };
    if (block.type === "text" || block.type === "safety_tip" || block.type === "ai_explanation") data.content = content;
    if (block.type === "image") { data.assetData = assetData; data.caption = caption; }
    if (block.type === "image_prompt") data.imagePrompt = imagePrompt;
    if (block.type === "gallery") data.galleryJson = JSON.stringify(gallery);
    if (block.type === "checklist") data.checklistJson = JSON.stringify(checklist);
    if (block.type === "step_by_step") data.stepsJson = JSON.stringify(steps);
    onSave(data);
  };

  const handleImproveAI = async () => {
    if (!content.trim()) return;
    setImproving(true);
    try {
      const res = await apiRequest("POST", "/api/training/ai/improve-block", { content, action: "improve", moduleTitle });
      const data = await res.json();
      if (data?.content) {
        setContent(data.content);
        onSave({ title, content: data.content } as any);
        toast({ title: "Block improved" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "AI improve failed", description: e?.message });
    } finally {
      setImproving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "single" | "gallery") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ variant: "destructive", title: "Image too large", description: "Max 5MB." }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (target === "single") {
        setAssetData(dataUrl);
        onSave({ title, assetData: dataUrl, caption } as any);
      } else {
        const next = [...gallery, { imageData: dataUrl, caption: "" }];
        setGallery(next);
        onSave({ title, galleryJson: JSON.stringify(next) } as any);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="border border-border rounded-lg p-3 bg-card" data-testid={`block-row-${block.id}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{typeMeta?.label ?? block.type}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" type="button" className="w-7 h-7 p-0" disabled={index === 0} onClick={onMoveUp} data-testid={`btn-block-up-${block.id}`}><ChevronUp className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" type="button" className="w-7 h-7 p-0" disabled={index === count - 1} onClick={onMoveDown} data-testid={`btn-block-down-${block.id}`}><ChevronDown className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" type="button" className="w-7 h-7 p-0 text-destructive hover:text-destructive" onClick={onDelete} data-testid={`btn-block-delete-${block.id}`}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>

      <Input
        className="mb-2"
        placeholder="Block title (optional)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={persist}
        data-testid={`input-block-title-${block.id}`}
      />

      {(block.type === "text" || block.type === "safety_tip" || block.type === "ai_explanation") && (
        <div className="space-y-2">
          <Textarea rows={4} placeholder="Block content…" value={content} onChange={e => setContent(e.target.value)} onBlur={persist} data-testid={`input-block-content-${block.id}`} />
          <Button variant="outline" size="sm" type="button" onClick={handleImproveAI} disabled={improving || !content.trim()} data-testid={`btn-block-improve-${block.id}`}>
            {improving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
            Improve with AI
          </Button>
        </div>
      )}

      {block.type === "image_prompt" && (
        <Textarea rows={3} placeholder="Describe the image you want to add…" value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} onBlur={persist} data-testid={`input-block-image-prompt-${block.id}`} />
      )}

      {block.type === "image" && (
        <div className="space-y-2">
          {assetData ? (
            <div className="relative rounded-md overflow-hidden border border-border">
              <img src={assetData} alt="" className="w-full max-h-60 object-cover" />
              <Button variant="ghost" size="sm" type="button" className="absolute top-1 right-1 w-6 h-6 p-0 bg-black/50 hover:bg-black/70 text-white" onClick={() => { setAssetData(""); onSave({ title, assetData: null, caption } as any); }}><X className="w-3 h-3" /></Button>
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-md p-4 text-center text-sm text-muted-foreground">No image yet.</div>
          )}
          <div className="flex items-center gap-2">
            <input type="file" accept="image/*" className="sr-only" ref={fileRef} onChange={(e) => handleImageUpload(e, "single")} />
            <Button variant="outline" size="sm" type="button" onClick={() => fileRef.current?.click()} data-testid={`btn-block-upload-${block.id}`}><ImageLucide className="w-3.5 h-3.5 mr-1" />{assetData ? "Replace image" : "Upload image"}</Button>
          </div>
          <Input placeholder="Caption (optional)" value={caption} onChange={e => setCaption(e.target.value)} onBlur={persist} data-testid={`input-block-caption-${block.id}`} />
        </div>
      )}

      {block.type === "gallery" && (
        <div className="space-y-2">
          {gallery.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((g, i) => (
                <div key={i} className="relative aspect-video rounded-md overflow-hidden border border-border">
                  <img src={g.imageData} alt="" className="w-full h-full object-cover" />
                  <Button variant="ghost" size="sm" type="button" className="absolute top-0.5 right-0.5 w-5 h-5 p-0 bg-black/50 hover:bg-black/70 text-white" onClick={() => { const next = gallery.filter((_, j) => j !== i); setGallery(next); onSave({ title, galleryJson: JSON.stringify(next) } as any); }}><X className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
          )}
          <input type="file" accept="image/*" className="sr-only" ref={galleryRef} onChange={(e) => handleImageUpload(e, "gallery")} />
          <Button variant="outline" size="sm" type="button" onClick={() => galleryRef.current?.click()} data-testid={`btn-gallery-add-${block.id}`}><Plus className="w-3.5 h-3.5 mr-1" />Add image</Button>
        </div>
      )}

      {block.type === "checklist" && (
        <div className="space-y-2">
          {checklist.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={it} onChange={e => { const next = [...checklist]; next[i] = e.target.value; setChecklist(next); }} onBlur={() => onSave({ title, checklistJson: JSON.stringify(checklist) } as any)} data-testid={`input-checklist-${block.id}-${i}`} />
              <Button variant="ghost" size="sm" type="button" className="w-7 h-7 p-0" onClick={() => { const next = checklist.filter((_, j) => j !== i); setChecklist(next); onSave({ title, checklistJson: JSON.stringify(next) } as any); }}><X className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" type="button" onClick={() => { const next = [...checklist, ""]; setChecklist(next); }} data-testid={`btn-checklist-add-${block.id}`}><Plus className="w-3.5 h-3.5 mr-1" />Add item</Button>
        </div>
      )}

      {block.type === "step_by_step" && (
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="border border-border rounded-md p-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <Input placeholder="Step title" value={s.title} onChange={e => { const next = [...steps]; next[i] = { ...next[i], title: e.target.value }; setSteps(next); }} onBlur={() => onSave({ title, stepsJson: JSON.stringify(steps) } as any)} data-testid={`input-step-title-${block.id}-${i}`} />
                <Button variant="ghost" size="sm" type="button" className="w-7 h-7 p-0" onClick={() => { const next = steps.filter((_, j) => j !== i); setSteps(next); onSave({ title, stepsJson: JSON.stringify(next) } as any); }}><X className="w-3.5 h-3.5" /></Button>
              </div>
              <Textarea rows={2} placeholder="Step description" value={s.description} onChange={e => { const next = [...steps]; next[i] = { ...next[i], description: e.target.value }; setSteps(next); }} onBlur={() => onSave({ title, stepsJson: JSON.stringify(steps) } as any)} data-testid={`input-step-desc-${block.id}-${i}`} />
            </div>
          ))}
          <Button variant="outline" size="sm" type="button" onClick={() => { const next = [...steps, { title: "", description: "" }]; setSteps(next); }} data-testid={`btn-steps-add-${block.id}`}><Plus className="w-3.5 h-3.5 mr-1" />Add step</Button>
        </div>
      )}
    </div>
  );
}
