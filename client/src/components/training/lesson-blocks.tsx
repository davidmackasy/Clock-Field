import { ShieldAlert, ListChecks, ListOrdered, ImageIcon, Sparkles, FileText } from "lucide-react";

export type LessonBlock = {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  assetData: string | null;
  caption: string | null;
  imagePrompt: string | null;
  imageSize: string | null;
  galleryJson: string | null;
  checklistJson: string | null;
  stepsJson: string | null;
  sortOrder: number;
};

function safeParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function TextBlock({ title, content }: { title?: string | null; content?: string | null }) {
  if (!content || !content.trim()) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-4" data-testid="block-text">
      {title && <div className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4 text-muted-foreground" />{title}</div>}
      <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{content}</div>
    </div>
  );
}

function SafetyBlock({ title, content }: { title?: string | null; content?: string | null }) {
  if (!content || !content.trim()) return null;
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 rounded-r-xl p-4" data-testid="block-safety">
      <div className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1 flex items-center gap-1.5">
        <ShieldAlert className="w-4 h-4" />
        {title || "Safety Note"}
      </div>
      <div className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed whitespace-pre-wrap">{content}</div>
    </div>
  );
}

function AIBlock({ title, content }: { title?: string | null; content?: string | null }) {
  if (!content || !content.trim()) return null;
  return (
    <div className="bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4" data-testid="block-ai">
      <div className="text-sm font-semibold text-violet-800 dark:text-violet-300 mb-2 flex items-center gap-1.5">
        <Sparkles className="w-4 h-4" />
        {title || "Explanation"}
      </div>
      <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{content}</div>
    </div>
  );
}

// Image size variants control width + height. Hero is a wide banner; small is
// inline (max ~24rem). Anything unrecognised falls back to medium.
function imageSizeClasses(size?: string | null) {
  switch (size) {
    case "small":  return { wrap: "max-w-sm",  img: "max-h-56 object-cover" };
    case "large":  return { wrap: "w-full",    img: "max-h-[32rem] object-cover" };
    case "hero":   return { wrap: "w-full",    img: "h-72 sm:h-96 object-cover" };
    case "medium":
    default:       return { wrap: "w-full",    img: "max-h-96 object-cover" };
  }
}

function ImageBlock({ title, caption, imageData, imageSize }: { title?: string | null; caption?: string | null; imageData?: string | null; imageSize?: string | null }) {
  if (!imageData) return null;
  const sz = imageSizeClasses(imageSize);
  return (
    <figure className={`bg-card border border-border rounded-xl overflow-hidden ${sz.wrap}`} data-testid="block-image">
      {title && <figcaption className="px-4 pt-3 text-sm font-semibold text-foreground">{title}</figcaption>}
      <img src={imageData} alt={caption ?? title ?? ""} className={`w-full ${sz.img}`} />
      {caption && <figcaption className="px-4 py-2 text-xs text-muted-foreground italic">{caption}</figcaption>}
    </figure>
  );
}

// Backwards-compat: legacy `image_prompt` blocks are no longer shown to
// learners as raw "Suggested image" descriptions. They render as nothing
// (they only matter inside the admin editor, where the admin can convert
// them into real images via the Generate Image button).
function ImagePromptBlock(_: { title?: string | null; imagePrompt?: string | null }) {
  return null;
}

function GalleryBlock({ title, galleryJson }: { title?: string | null; galleryJson?: string | null }) {
  const items = safeParse<{ imageData: string; caption?: string }[]>(galleryJson ?? null, []);
  if (items.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-4" data-testid="block-gallery">
      {title && <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-muted-foreground" />{title}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((it, i) => (
          <figure key={i} className="rounded-lg overflow-hidden border border-border" data-testid={`gallery-image-${i}`}>
            <img src={it.imageData} alt={it.caption ?? ""} className="w-full h-40 object-cover" />
            {it.caption && <figcaption className="px-2 py-1.5 text-[11px] text-muted-foreground bg-muted/30 italic">{it.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  );
}

function ChecklistBlock({ title, checklistJson }: { title?: string | null; checklistJson?: string | null }) {
  const items = safeParse<string[]>(checklistJson ?? null, []);
  if (items.length === 0) return null;
  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4" data-testid="block-checklist">
      <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mb-2 flex items-center gap-1.5">
        <ListChecks className="w-4 h-4" />
        {title || "Checklist"}
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground" data-testid={`checklist-item-${i}`}>
            <span className="mt-0.5 w-4 h-4 rounded border-2 border-emerald-500 flex-shrink-0" />
            <span className="flex-1">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepByStepBlock({ title, stepsJson }: { title?: string | null; stepsJson?: string | null }) {
  const steps = safeParse<{ title?: string; description?: string }[]>(stepsJson ?? null, []);
  if (steps.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-4" data-testid="block-steps">
      <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
        <ListOrdered className="w-4 h-4 text-muted-foreground" />
        {title || "Step-by-step"}
      </div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3" data-testid={`step-${i}`}>
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{i + 1}</span>
            <div className="flex-1 min-w-0">
              {s.title && <div className="text-sm font-medium text-foreground">{s.title}</div>}
              {s.description && <div className="text-sm text-muted-foreground leading-relaxed mt-0.5 whitespace-pre-wrap">{s.description}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function LessonBlocks({ blocks, fallbackText, fallbackAssets }: {
  blocks?: LessonBlock[] | null;
  fallbackText?: string | null;
  fallbackAssets?: { id: string; assetData: string }[] | null;
}) {
  // Backwards-compat: if no blocks, render legacy lessonText + assets as a single text block + gallery.
  const hasBlocks = Array.isArray(blocks) && blocks.length > 0;
  if (!hasBlocks) {
    const items: { id: string; node: JSX.Element }[] = [];
    if (fallbackText && fallbackText.trim()) {
      items.push({ id: "legacy-text", node: <TextBlock content={fallbackText} /> });
    }
    if (fallbackAssets && fallbackAssets.length > 0) {
      items.push({
        id: "legacy-assets",
        node: (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fallbackAssets.map(a => (
              <img key={a.id} src={a.assetData} alt="" className="rounded-xl border border-border w-full object-cover aspect-video" />
            ))}
          </div>
        ),
      });
    }
    if (items.length === 0) return null;
    return <div className="space-y-4" data-testid="lesson-blocks-legacy">{items.map(i => <div key={i.id}>{i.node}</div>)}</div>;
  }

  const sorted = [...(blocks as LessonBlock[])].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="space-y-4" data-testid="lesson-blocks">
      {sorted.map(b => {
        let node: JSX.Element | null = null;
        switch (b.type) {
          case "text":           node = <TextBlock title={b.title} content={b.content} />; break;
          case "safety_tip":     node = <SafetyBlock title={b.title} content={b.content} />; break;
          case "ai_explanation": node = <AIBlock title={b.title} content={b.content} />; break;
          case "image":          node = <ImageBlock title={b.title} caption={b.caption} imageData={b.assetData} imageSize={b.imageSize} />; break;
          case "image_prompt":   node = <ImagePromptBlock title={b.title} imagePrompt={b.imagePrompt} />; break;
          case "gallery":        node = <GalleryBlock title={b.title} galleryJson={b.galleryJson} />; break;
          case "checklist":      node = <ChecklistBlock title={b.title} checklistJson={b.checklistJson} />; break;
          case "step_by_step":   node = <StepByStepBlock title={b.title} stepsJson={b.stepsJson} />; break;
          default: node = null;
        }
        if (!node) return null;
        return <div key={b.id} data-testid={`lesson-block-${b.type}-${b.id}`}>{node}</div>;
      })}
    </div>
  );
}

// Concatenate the spoken text of every block so the audio player can read the
// whole module aloud (used as the fallback browser-TTS script).
export function buildLessonScript(opts: { title?: string | null; description?: string | null; lessonText?: string | null; blocks?: LessonBlock[] | null }): string {
  const parts: string[] = [];
  if (opts.title) parts.push(opts.title + ".");
  if (opts.description) parts.push(opts.description);
  const blocks = opts.blocks ?? [];
  if (blocks.length === 0 && opts.lessonText) {
    parts.push(opts.lessonText);
  } else {
    const sorted = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const b of sorted) {
      // image_prompt blocks are admin-only scaffolding — never read aloud.
      if (b.type === "image_prompt") continue;
      if (b.title) parts.push(b.title + ".");
      if (b.type === "text" || b.type === "safety_tip" || b.type === "ai_explanation") {
        if (b.content) parts.push(b.content);
      } else if (b.type === "image" && b.caption) {
        parts.push(b.caption);
      } else if (b.type === "gallery") {
        const items = safeParse<{ caption?: string }[]>(b.galleryJson ?? null, []);
        for (const it of items) if (it.caption) parts.push(it.caption);
      } else if (b.type === "checklist") {
        const items = safeParse<string[]>(b.checklistJson ?? null, []);
        if (items.length > 0) parts.push("Checklist: " + items.join(". "));
      } else if (b.type === "step_by_step") {
        const steps = safeParse<{ title?: string; description?: string }[]>(b.stepsJson ?? null, []);
        steps.forEach((s, i) => parts.push(`Step ${i + 1}. ${s.title ?? ""}. ${s.description ?? ""}`));
      }
    }
  }
  return parts.filter(Boolean).join(" ");
}
