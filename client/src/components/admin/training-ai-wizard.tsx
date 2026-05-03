import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Loader2, ChevronRight, ChevronLeft, Wand2, Plus, Trash2,
  CheckCircle2, AlertCircle, GripVertical, Wrench, Youtube, Image as ImageIcon, RefreshCw, X,
} from "lucide-react";

type Tone = "simple" | "professional" | "safety_focused" | "beginner_friendly";

type AIQuestion = {
  questionText: string;
  questionType: "multiple_choice" | "true_false" | "short_answer";
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
};

type AIModule = {
  title: string;
  description?: string;
  overview?: string;
  lessonText?: string;
  stepByStep?: string[];
  keyPoints?: string[];
  checklist?: string[];
  commonMistakes?: string[];
  safetyNotes?: string[];
  keyTakeaways?: string[];
  imagePrompt?: string;
};

type AIDraftCourse = {
  title: string;
  description: string;
  category: string;
  estimatedDuration: string;
  learningObjectives?: string[];
  objectives?: string[];
  modules: AIModule[];
  suggestedQuiz?: AIQuestion[] | { questions: AIQuestion[]; title?: string; description?: string };
  certificateText?: string;
  publicIntro?: string;
};

type EditableModule = {
  title: string;
  description: string;
  lessonText: string;
  youtubeUrl: string;
  assets: { assetData: string; assetType: string }[];
  imagePrompt?: string;
  isRequired: boolean;
};

type EditableQuiz = {
  enabled: boolean;
  title: string;
  description: string;
  passingScore: number;
  allowRetake: boolean;
  showCorrectAnswers: boolean;
  isRequired: boolean;
  questions: AIQuestion[];
};

const CATEGORIES = ["Onboarding", "Safety", "Cleaning", "Customer Service", "Compliance", "Equipment", "General"];

const TONES: { value: Tone; label: string }[] = [
  { value: "simple", label: "Simple & clear" },
  { value: "professional", label: "Professional" },
  { value: "safety_focused", label: "Safety-focused" },
  { value: "beginner_friendly", label: "Beginner-friendly" },
];

function packLessonText(m: AIModule): string {
  const sections: string[] = [];
  if (m.overview && m.overview.trim()) sections.push("Overview:\n" + m.overview.trim());
  if (m.lessonText && m.lessonText.trim()) sections.push(m.lessonText.trim());
  if (m.stepByStep?.length) sections.push("Step-by-step:\n" + m.stepByStep.map((p, i) => `${i + 1}. ${p}`).join("\n"));
  if (m.keyPoints?.length) sections.push("Key Points:\n" + m.keyPoints.map(p => `• ${p}`).join("\n"));
  if (m.commonMistakes?.length) sections.push("Common Mistakes to Avoid:\n" + m.commonMistakes.map(p => `• ${p}`).join("\n"));
  if (m.safetyNotes?.length) sections.push("⚠️ Safety Notes:\n" + m.safetyNotes.map(p => `• ${p}`).join("\n"));
  if (m.checklist?.length) sections.push("Checklist:\n" + m.checklist.map(p => `☐ ${p}`).join("\n"));
  if (m.keyTakeaways?.length) sections.push("Key Takeaways:\n" + m.keyTakeaways.map(p => `• ${p}`).join("\n"));
  return sections.join("\n\n");
}

function packDescription(d: AIDraftCourse): string {
  const parts: string[] = [];
  if (d.description?.trim()) parts.push(d.description.trim());
  const objs = d.learningObjectives ?? d.objectives ?? [];
  if (objs.length) {
    parts.push("What you'll learn:\n" + objs.map(o => `• ${o}`).join("\n"));
  }
  return parts.join("\n\n");
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB per image
const MAX_MODULE_ASSETS_BYTES = 10 * 1024 * 1024; // 10 MB total per module

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function approxBase64Bytes(dataUrl: string): number {
  // base64 string length * 3/4 ≈ bytes; we don't need to be exact.
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

function parseApiError(message: string): { message: string; field?: string } {
  // apiRequest throws `${res.status}: ${text}` where text may be JSON or plain text.
  const m = message.match(/^\d+:\s*(.*)$/s);
  const body = m ? m[1] : message;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      return { message: typeof parsed.message === "string" ? parsed.message : body, field: typeof parsed.field === "string" ? parsed.field : undefined };
    }
  } catch { /* not json */ }
  return { message: body };
}

export default function TrainingAIWizard({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (courseId: string) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: brief
  const [topic, setTopic] = useState("");
  const [industry, setIndustry] = useState("");
  const [audience, setAudience] = useState("");
  const [moduleCount, setModuleCount] = useState(5);
  const [includeQuiz, setIncludeQuiz] = useState(true);
  const [quizQuestionCount, setQuizQuestionCount] = useState(15);
  const [passingScore, setPassingScore] = useState(80);
  const [allowMC, setAllowMC] = useState(true);
  const [allowTF, setAllowTF] = useState(true);
  const [allowSA, setAllowSA] = useState(true);
  const [wantVideos, setWantVideos] = useState(false);
  const [wantImages, setWantImages] = useState(false);
  const [tone, setTone] = useState<Tone>("simple");

  // Step 3: editable draft
  const [course, setCourse] = useState({ title: "", description: "", category: "", estimatedDuration: "" });
  const [modules, setModules] = useState<EditableModule[]>([]);
  const [quiz, setQuiz] = useState<EditableQuiz>({
    enabled: true, title: "", description: "", passingScore: 80,
    allowRetake: true, showCorrectAnswers: false, isRequired: true, questions: [],
  });

  // Step 4: settings
  const [isRequired, setIsRequired] = useState(false);
  const [certificateEnabled, setCertificateEnabled] = useState(true);
  const [publicLinkEnabled, setPublicLinkEnabled] = useState(false);

  // Save error surfaced inline so admin doesn't lose draft
  const [saveError, setSaveError] = useState<string | null>(null);

  const reset = () => {
    setStep(1);
    setTopic(""); setIndustry(""); setAudience("");
    setModuleCount(5); setIncludeQuiz(true);
    setQuizQuestionCount(15); setPassingScore(80);
    setAllowMC(true); setAllowTF(true); setAllowSA(true);
    setWantVideos(false); setWantImages(false);
    setTone("simple");
    setCourse({ title: "", description: "", category: "", estimatedDuration: "" });
    setModules([]);
    setQuiz({ enabled: true, title: "", description: "", passingScore: 80, allowRetake: true, showCorrectAnswers: false, isRequired: true, questions: [] });
    setIsRequired(false); setCertificateEnabled(true); setPublicLinkEnabled(false);
    setSaveError(null);
  };

  useEffect(() => { if (!open) reset(); }, [open]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/training/ai/generate-course", {
        topic, industry: industry || undefined, audience: audience || undefined,
        moduleCount, includeQuiz, tone,
        quizQuestionCount: includeQuiz ? quizQuestionCount : undefined,
        passingScore,
        questionTypeMix: { multiple_choice: allowMC, true_false: allowTF, short_answer: allowSA },
        wantVideos, wantImages,
      });
      return (await res.json()) as AIDraftCourse;
    },
    onSuccess: (data) => {
      setCourse({
        title: data.title || topic,
        description: packDescription(data),
        category: data.category || "",
        estimatedDuration: data.estimatedDuration || "",
      });
      setModules((data.modules || []).map(m => ({
        title: m.title,
        description: m.description || "",
        lessonText: packLessonText(m),
        youtubeUrl: "",
        assets: [],
        imagePrompt: m.imagePrompt || "",
        isRequired: true,
      })));
      // suggestedQuiz can be array (new schema) or object (old wizard schema) — handle both.
      const rawQuiz = data.suggestedQuiz;
      const questions: AIQuestion[] = Array.isArray(rawQuiz)
        ? rawQuiz
        : (rawQuiz && Array.isArray((rawQuiz as any).questions) ? (rawQuiz as any).questions : []);
      if (questions.length > 0) {
        setQuiz(q => ({
          ...q,
          enabled: includeQuiz,
          title: (rawQuiz && !Array.isArray(rawQuiz) && (rawQuiz as any).title) || `${data.title} — Final Quiz`,
          description: (rawQuiz && !Array.isArray(rawQuiz) && (rawQuiz as any).description) || "",
          passingScore,
          questions,
        }));
      } else {
        setQuiz(q => ({ ...q, enabled: false, passingScore, questions: [] }));
      }
      setStep(3);
    },
    onError: (e: any) => {
      toast({ title: "AI generation failed", description: e.message || "Try again or check OpenAI key", variant: "destructive" });
      setStep(1);
    },
  });

  const improveMutation = useMutation({
    mutationFn: async ({ text, action }: { text: string; action: string }) => {
      const res = await apiRequest("POST", "/api/training/ai/improve", { text, action, tone });
      return (await res.json()) as { result: string };
    },
  });

  const regenQuizMutation = useMutation({
    mutationFn: async ({ count, mode }: { count: number; mode: "replace" | "append" }) => {
      const res = await apiRequest("POST", "/api/training/ai/generate-quiz", {
        modules: modules.map(m => ({ title: m.title, description: m.description, lessonText: m.lessonText })),
        courseTitle: course.title,
        courseDescription: course.description,
        count,
        questionTypeMix: { multiple_choice: allowMC, true_false: allowTF, short_answer: allowSA },
        tone,
      });
      const data = (await res.json()) as { questions: AIQuestion[] };
      return { questions: data.questions || [], mode };
    },
    onSuccess: ({ questions, mode }) => {
      if (questions.length === 0) {
        toast({ title: "AI returned no questions", description: "Try adding more module content first.", variant: "destructive" });
        return;
      }
      setQuiz(q => ({
        ...q,
        enabled: true,
        questions: mode === "replace" ? questions : [...q.questions, ...questions],
      }));
      toast({ title: mode === "replace" ? "Quiz regenerated" : `${questions.length} more questions added` });
    },
    onError: (e: any) => {
      toast({ title: "Quiz generation failed", description: e.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaveError(null);
      const res = await apiRequest("POST", "/api/training/ai/save-draft", {
        course: {
          title: course.title.trim(),
          description: course.description.trim() || null,
          category: course.category || null,
          estimatedDuration: course.estimatedDuration || null,
          isRequired, certificateEnabled, publicLinkEnabled,
        },
        modules: modules.map((m, i) => ({
          title: m.title.trim(),
          description: m.description.trim() || null,
          lessonText: m.lessonText.trim() || null,
          youtubeUrl: m.youtubeUrl.trim() || null,
          assets: m.assets.length > 0 ? m.assets : undefined,
          isRequired: m.isRequired,
          sortOrder: i,
        })),
        quiz: quiz.enabled && quiz.questions.length > 0 ? {
          enabled: true,
          title: quiz.title || `${course.title} — Final Quiz`,
          description: quiz.description || null,
          passingScore: quiz.passingScore,
          allowRetake: quiz.allowRetake,
          showCorrectAnswers: quiz.showCorrectAnswers,
          isRequired: quiz.isRequired,
          questions: quiz.questions,
        } : undefined,
      });
      return (await res.json()) as { id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training/stats"] });
      toast({ title: "Course created with AI", description: "You can now publish, assign employees, or add more module assets." });
      onOpenChange(false);
      onCreated(data.id);
    },
    onError: (e: any) => {
      const parsed = parseApiError(e?.message || "");
      const msg = parsed.message || "Save failed — please review the form and try again";
      const display = parsed.field ? `${msg} (field: ${parsed.field})` : msg;
      setSaveError(display);
      toast({ title: "Save failed", description: msg, variant: "destructive" });
      // Send admin back to step 3 so they can fix the offending field, draft state preserved.
      setStep(3);
    },
  });

  const handleImprove = async (action: string, current: string, applyFn: (text: string) => void) => {
    if (!current.trim()) {
      toast({ title: "Nothing to improve", description: "Add some text first.", variant: "destructive" });
      return;
    }
    try {
      const result = await improveMutation.mutateAsync({ text: current, action });
      applyFn(result.result);
      toast({ title: "AI updated the text" });
    } catch (e: any) {
      toast({ title: "AI improve failed", description: e.message, variant: "destructive" });
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!topic.trim()) {
        toast({ title: "Topic required", description: "Tell the AI what to build a course about.", variant: "destructive" });
        return;
      }
      if (includeQuiz && !allowMC && !allowTF && !allowSA) {
        toast({ title: "Pick at least one question type", variant: "destructive" });
        return;
      }
      setStep(2);
      generateMutation.mutate();
    } else if (step === 3) {
      if (!course.title.trim()) {
        toast({ title: "Title required", variant: "destructive" });
        return;
      }
      if (modules.length === 0) {
        toast({ title: "At least one module is required", variant: "destructive" });
        return;
      }
      const missingTitle = modules.findIndex(m => !m.title.trim());
      if (missingTitle >= 0) {
        toast({ title: `Module #${missingTitle + 1} needs a title`, variant: "destructive" });
        return;
      }
      const missingLesson = modules.findIndex(m => !m.lessonText.trim());
      if (missingLesson >= 0) {
        toast({ title: `Module #${missingLesson + 1} needs lesson content`, description: "Add lesson text or use AI to fill it.", variant: "destructive" });
        return;
      }
      if (quiz.enabled && quiz.questions.length === 0) {
        toast({ title: "Quiz is enabled but has no questions", description: "Add a question, regenerate with AI, or disable the quiz.", variant: "destructive" });
        return;
      }
      setSaveError(null);
      setStep(4);
    } else if (step === 4) {
      saveMutation.mutate();
    }
  };

  const updateModule = (i: number, patch: Partial<EditableModule>) => {
    setModules(ms => ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  };

  const updateQuestion = (i: number, patch: Partial<AIQuestion>) => {
    setQuiz(q => ({ ...q, questions: q.questions.map((qq, idx) => (idx === i ? { ...qq, ...patch } : qq)) }));
  };

  const addModuleAssets = async (i: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const filesArr = Array.from(files).slice(0, 8);
      const oversized = filesArr.filter(f => f.size > MAX_IMAGE_BYTES);
      if (oversized.length > 0) {
        toast({
          title: "Image too large",
          description: `Each image must be under 2MB. Skipped: ${oversized.map(f => f.name).join(", ")}`,
          variant: "destructive",
        });
      }
      const accepted = filesArr.filter(f => f.size <= MAX_IMAGE_BYTES);
      if (accepted.length === 0) return;
      const datas = await Promise.all(accepted.map(readFileAsDataUrl));
      setModules(ms => ms.map((m, idx) => {
        if (idx !== i) return m;
        const existingBytes = m.assets.reduce((sum, a) => sum + approxBase64Bytes(a.assetData), 0);
        const newAssets: { assetData: string; assetType: string }[] = [];
        let runningBytes = existingBytes;
        let dropped = 0;
        for (const d of datas) {
          const b = approxBase64Bytes(d);
          if (runningBytes + b > MAX_MODULE_ASSETS_BYTES) { dropped++; continue; }
          newAssets.push({ assetData: d, assetType: "image" });
          runningBytes += b;
        }
        if (dropped > 0) {
          toast({
            title: "Module image quota reached",
            description: `Each module can hold up to 10MB of images. ${dropped} image${dropped === 1 ? "" : "s"} skipped.`,
            variant: "destructive",
          });
        }
        return { ...m, assets: [...m.assets, ...newAssets] };
      }));
    } catch (e: any) {
      toast({ title: "Couldn't read image", description: e.message || "Try a different file", variant: "destructive" });
    }
  };

  const removeModuleAsset = (mi: number, ai: number) => {
    setModules(ms => ms.map((m, idx) => idx === mi ? { ...m, assets: m.assets.filter((_, x) => x !== ai) } : m));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ai-wizard">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {step === 1 ? "Generate Course with AI"
              : step === 2 ? "AI is building your course..."
              : step === 3 ? "Review & Edit Draft"
              : "Final Settings"}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-2 mb-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {/* ── STEP 1: BRIEF ── */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div>
              <Label>What's the course about? <span className="text-destructive">*</span></Label>
              <Input
                className="mt-1"
                placeholder="e.g. How to safely use a floor buffer"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                data-testid="input-ai-topic"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Industry (optional)</Label>
                <Input className="mt-1" placeholder="e.g. Janitorial / Cleaning" value={industry} onChange={e => setIndustry(e.target.value)} data-testid="input-ai-industry" />
              </div>
              <div>
                <Label>Audience (optional)</Label>
                <Input className="mt-1" placeholder="e.g. New hires" value={audience} onChange={e => setAudience(e.target.value)} data-testid="input-ai-audience" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Modules</Label>
                <Input
                  type="number"
                  min={1} max={12}
                  className="mt-1"
                  value={moduleCount}
                  onChange={e => setModuleCount(Math.min(12, Math.max(1, parseInt(e.target.value) || 1)))}
                  data-testid="input-ai-module-count"
                />
              </div>
              <div>
                <Label>Quiz Questions</Label>
                <Input
                  type="number"
                  min={3} max={30}
                  className="mt-1"
                  disabled={!includeQuiz}
                  value={quizQuestionCount}
                  onChange={e => setQuizQuestionCount(Math.min(30, Math.max(3, parseInt(e.target.value) || 3)))}
                  data-testid="input-ai-quiz-question-count"
                />
              </div>
              <div>
                <Label>Passing Score (%)</Label>
                <Input
                  type="number"
                  min={0} max={100}
                  className="mt-1"
                  value={passingScore}
                  onChange={e => setPassingScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  data-testid="input-ai-passing-score"
                />
              </div>
            </div>
            <div>
              <Label>Tone</Label>
              <select
                className="mt-1 w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground"
                value={tone}
                onChange={e => setTone(e.target.value as Tone)}
                data-testid="select-ai-tone">
                {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <div className="text-sm font-medium text-foreground">Include final quiz</div>
                <div className="text-xs text-muted-foreground">AI writes questions based on the lessons it generates</div>
              </div>
              <Switch checked={includeQuiz} onCheckedChange={setIncludeQuiz} data-testid="switch-ai-include-quiz" />
            </div>
            {includeQuiz && (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <div className="text-sm font-medium text-foreground">Quiz question types</div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={allowMC} onCheckedChange={v => setAllowMC(!!v)} data-testid="check-qtype-mc" />
                    Multiple choice
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={allowTF} onCheckedChange={v => setAllowTF(!!v)} data-testid="check-qtype-tf" />
                    True / False
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={allowSA} onCheckedChange={v => setAllowSA(!!v)} data-testid="check-qtype-sa" />
                    Short answer
                  </label>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div>
                  <div className="text-sm font-medium text-foreground flex items-center gap-1.5"><Youtube className="w-3.5 h-3.5" /> Add videos?</div>
                  <div className="text-xs text-muted-foreground">YouTube link per module (optional, on the next step)</div>
                </div>
                <Switch checked={wantVideos} onCheckedChange={setWantVideos} data-testid="switch-ai-want-videos" />
              </div>
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div>
                  <div className="text-sm font-medium text-foreground flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Add images/slides?</div>
                  <div className="text-xs text-muted-foreground">Upload per module on the next step</div>
                </div>
                <Switch checked={wantImages} onCheckedChange={setWantImages} data-testid="switch-ai-want-images" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg p-3 flex gap-2">
              <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary" />
              <div>
                The AI will draft a complete course in one shot — title, description, learning objectives, detailed lesson content (with steps, common mistakes, safety, checklist, key takeaways) for each module, and the final quiz. You'll be able to edit everything before saving.
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: LOADING ── */}
        {step === 2 && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-primary animate-pulse" />
              </div>
              <Loader2 className="w-20 h-20 absolute -top-2 -left-2 animate-spin text-primary/30" />
            </div>
            <div>
              <div className="text-base font-semibold text-foreground">Drafting your course</div>
              <div className="text-sm text-muted-foreground mt-1">Writing modules{includeQuiz ? " and quiz" : ""}... this takes ~20-40 seconds.</div>
            </div>
          </div>
        )}

        {/* ── STEP 3: EDIT DRAFT ── */}
        {step === 3 && (
          <div className="space-y-5 py-2">
            {saveError && (
              <div className="border border-destructive/40 bg-destructive/10 text-destructive rounded-lg p-3 flex gap-2 text-sm" data-testid="banner-save-error">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Save failed</div>
                  <div className="text-xs mt-0.5 opacity-90">{saveError}</div>
                </div>
              </div>
            )}

            {/* Course meta */}
            <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Course Overview
                </div>
                <Badge variant="secondary" className="text-xs">AI Draft</Badge>
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input className="mt-1" value={course.title} onChange={e => setCourse(c => ({ ...c, title: e.target.value }))} data-testid="input-ai-course-title" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Description & objectives</Label>
                  <Button
                    variant="ghost" size="sm" type="button" className="h-6 text-xs"
                    onClick={() => handleImprove("improve", course.description, t => setCourse(c => ({ ...c, description: t })))}
                    disabled={improveMutation.isPending}
                    data-testid="btn-improve-description">
                    {improveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    <span className="ml-1">Improve</span>
                  </Button>
                </div>
                <Textarea rows={6} className="mt-1 text-sm" value={course.description} onChange={e => setCourse(c => ({ ...c, description: e.target.value }))} data-testid="input-ai-course-description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Category</Label>
                  <select className="mt-1 w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground" value={course.category} onChange={e => setCourse(c => ({ ...c, category: e.target.value }))}>
                    <option value="">Select...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Duration</Label>
                  <Input className="mt-1" placeholder="e.g. 30 min" value={course.estimatedDuration} onChange={e => setCourse(c => ({ ...c, estimatedDuration: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Modules */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Modules ({modules.length})</div>
                <Button
                  variant="outline" size="sm" type="button"
                  onClick={() => setModules(m => [...m, { title: "New Module", description: "", lessonText: "", youtubeUrl: "", assets: [], isRequired: true }])}
                  data-testid="btn-add-ai-module">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Module
                </Button>
              </div>
              {modules.map((m, i) => (
                <ModuleEditor
                  key={i}
                  index={i}
                  module={m}
                  improvePending={improveMutation.isPending}
                  onChange={patch => updateModule(i, patch)}
                  onDelete={() => setModules(ms => ms.filter((_, idx) => idx !== i))}
                  onImproveLesson={() => handleImprove("improve", m.lessonText, t => updateModule(i, { lessonText: t }))}
                  onAddAssets={files => addModuleAssets(i, files)}
                  onRemoveAsset={ai => removeModuleAsset(i, ai)}
                />
              ))}
              {modules.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                  No modules yet. AI didn't return any — add one manually.
                </div>
              )}
            </div>

            {/* Quiz */}
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/10">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" /> Final Quiz
                </div>
                <Switch checked={quiz.enabled} onCheckedChange={v => setQuiz(q => ({ ...q, enabled: v }))} data-testid="switch-ai-quiz-enabled" />
              </div>
              {quiz.enabled && (
                <>
                  {quiz.questions.length === 0 && (
                    <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded p-2 flex gap-2">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
                      No quiz questions yet. Use the AI buttons below or add manually.
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Quiz Title</Label>
                      <Input className="mt-1 h-8 text-sm" value={quiz.title} onChange={e => setQuiz(q => ({ ...q, title: e.target.value }))} data-testid="input-ai-quiz-title" />
                    </div>
                    <div>
                      <Label className="text-xs">Passing Score (%)</Label>
                      <Input
                        type="number" min={0} max={100}
                        className="mt-1 h-8 text-sm"
                        value={quiz.passingScore}
                        onChange={e => setQuiz(q => ({ ...q, passingScore: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
                        data-testid="input-ai-quiz-passing"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline" size="sm" type="button"
                      onClick={() => regenQuizMutation.mutate({ count: quizQuestionCount, mode: "replace" })}
                      disabled={regenQuizMutation.isPending}
                      data-testid="btn-regenerate-quiz">
                      {regenQuizMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                      Regenerate Quiz with AI
                    </Button>
                    <Button
                      variant="outline" size="sm" type="button"
                      onClick={() => regenQuizMutation.mutate({ count: 5, mode: "append" })}
                      disabled={regenQuizMutation.isPending}
                      data-testid="btn-generate-more-questions">
                      {regenQuizMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                      Generate 5 More Questions
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {quiz.questions.map((q, qi) => (
                      <QuestionEditor
                        key={qi}
                        index={qi}
                        question={q}
                        onChange={patch => updateQuestion(qi, patch)}
                        onDelete={() => setQuiz(s => ({ ...s, questions: s.questions.filter((_, idx) => idx !== qi) }))}
                      />
                    ))}
                    <Button
                      variant="outline" size="sm" type="button" className="w-full"
                      onClick={() => setQuiz(s => ({ ...s, questions: [...s.questions, { questionText: "", questionType: "multiple_choice", options: ["", "", "", ""], correctAnswer: "" }] }))}
                      data-testid="btn-add-question">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Question Manually
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 4: SETTINGS ── */}
        {step === 4 && (
          <div className="space-y-3 py-2">
            <div className="border border-border rounded-lg p-3 bg-muted/20 space-y-1">
              <div className="text-sm font-semibold text-foreground">{course.title}</div>
              <div className="text-xs text-muted-foreground">
                {modules.length} module{modules.length === 1 ? "" : "s"}
                {quiz.enabled && quiz.questions.length > 0 ? ` • ${quiz.questions.length} quiz questions` : ""}
                {course.category ? ` • ${course.category}` : ""}
                {course.estimatedDuration ? ` • ${course.estimatedDuration}` : ""}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <div className="text-sm font-medium text-foreground">Required Course</div>
                <div className="text-xs text-muted-foreground">Employees must complete this course</div>
              </div>
              <Switch checked={isRequired} onCheckedChange={setIsRequired} data-testid="switch-ai-required" />
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <div className="text-sm font-medium text-foreground">Issue Certificate</div>
                <div className="text-xs text-muted-foreground">Generate completion certificate (after passing quiz if enabled)</div>
              </div>
              <Switch checked={certificateEnabled} onCheckedChange={setCertificateEnabled} data-testid="switch-ai-certificate" />
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <div className="text-sm font-medium text-foreground">Enable Public Link</div>
                <div className="text-xs text-muted-foreground">Allow non-employees to access via shareable link</div>
              </div>
              <Switch checked={publicLinkEnabled} onCheckedChange={setPublicLinkEnabled} data-testid="switch-ai-public" />
            </div>
            <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg p-3 flex gap-2">
              <Wrench className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary" />
              <div>
                Course will be saved as <strong>draft</strong>. After saving, you can publish & assign employees, or add more module assets.
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                if (step === 1) onOpenChange(false);
                else if (step === 3) setStep(1);
                else if (step === 4) setStep(3);
              }}
              disabled={step === 2 || saveMutation.isPending}
              data-testid="btn-ai-back">
              {step === 1 ? "Cancel" : <><ChevronLeft className="w-3.5 h-3.5 mr-1" /> Back</>}
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={handleNext}
              disabled={step === 2 || generateMutation.isPending || saveMutation.isPending}
              data-testid="btn-ai-next">
              {(generateMutation.isPending || saveMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {step === 1 ? <>Generate <Sparkles className="w-3.5 h-3.5 ml-1" /></>
                : step === 3 ? <>Continue <ChevronRight className="w-3.5 h-3.5 ml-1" /></>
                : step === 4 ? "Save Course"
                : "..."}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function ModuleEditor({
  index, module: m, improvePending,
  onChange, onDelete, onImproveLesson, onAddAssets, onRemoveAsset,
}: {
  index: number;
  module: EditableModule;
  improvePending: boolean;
  onChange: (patch: Partial<EditableModule>) => void;
  onDelete: () => void;
  onImproveLesson: () => void;
  onAddAssets: (files: FileList | null) => void;
  onRemoveAsset: (assetIdx: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="border border-border rounded-lg p-3 space-y-2.5 bg-card" data-testid={`block-ai-module-${index}`}>
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground font-mono">{String(index + 1).padStart(2, "0")}</span>
        <Input
          className="flex-1 h-8 text-sm font-medium"
          placeholder="Module title"
          value={m.title}
          onChange={e => onChange({ title: e.target.value })}
          data-testid={`input-ai-module-title-${index}`}
        />
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={onDelete} data-testid={`btn-delete-ai-module-${index}`}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <Input
        className="h-8 text-sm"
        placeholder="Short description (optional)"
        value={m.description}
        onChange={e => onChange({ description: e.target.value })}
        data-testid={`input-ai-module-description-${index}`}
      />
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs text-muted-foreground">Lesson content (overview, steps, key points, safety, checklist, takeaways)</Label>
          <Button
            variant="ghost" size="sm" type="button" className="h-6 text-xs"
            onClick={onImproveLesson}
            disabled={improvePending}
            data-testid={`btn-improve-lesson-${index}`}>
            {improvePending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            <span className="ml-1">Improve</span>
          </Button>
        </div>
        <Textarea
          rows={8}
          className="text-xs font-mono"
          placeholder="Lesson text..."
          value={m.lessonText}
          onChange={e => onChange({ lessonText: e.target.value })}
          data-testid={`input-ai-module-lesson-${index}`}
        />
      </div>

      {/* Video + Image fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <div>
          <Label className="text-xs flex items-center gap-1"><Youtube className="w-3 h-3" /> YouTube URL (optional)</Label>
          <Input
            className="mt-1 h-8 text-xs"
            placeholder="https://youtube.com/watch?v=... or unlisted link"
            value={m.youtubeUrl}
            onChange={e => onChange({ youtubeUrl: e.target.value })}
            data-testid={`input-ai-module-youtube-${index}`}
          />
        </div>
        <div>
          <Label className="text-xs flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Images / Slides (optional)</Label>
          <div className="mt-1 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { onAddAssets(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              data-testid={`input-ai-module-assets-${index}`}
            />
            <Button
              variant="outline" size="sm" type="button" className="h-8 text-xs"
              onClick={() => fileInputRef.current?.click()}
              data-testid={`btn-add-assets-${index}`}>
              <Plus className="w-3 h-3 mr-1" /> Upload
            </Button>
            {m.assets.length > 0 && <span className="text-xs text-muted-foreground">{m.assets.length} attached</span>}
          </div>
        </div>
      </div>
      {m.assets.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {m.assets.map((a, ai) => (
            <div key={ai} className="relative w-16 h-16 rounded border border-border overflow-hidden bg-muted" data-testid={`thumb-asset-${index}-${ai}`}>
              <img src={a.assetData} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                onClick={() => onRemoveAsset(ai)}
                data-testid={`btn-remove-asset-${index}-${ai}`}>
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {m.imagePrompt && m.assets.length === 0 && (
        <div className="text-[11px] text-muted-foreground italic pt-1">
          AI image hint: {m.imagePrompt}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function QuestionEditor({
  index: qi, question: q, onChange, onDelete,
}: {
  index: number;
  question: AIQuestion;
  onChange: (patch: Partial<AIQuestion>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-border rounded p-2.5 bg-card space-y-2" data-testid={`block-ai-question-${qi}`}>
      <div className="flex items-start gap-2">
        <span className="text-xs text-muted-foreground font-mono mt-1.5">Q{qi + 1}</span>
        <Textarea
          rows={2}
          className="text-sm flex-1"
          placeholder="Question text"
          value={q.questionText}
          onChange={e => onChange({ questionText: e.target.value })}
          data-testid={`input-ai-question-text-${qi}`}
        />
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive flex-shrink-0" onClick={onDelete} data-testid={`btn-delete-question-${qi}`}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select
          className="h-8 px-2 border border-border rounded-md text-xs bg-background text-foreground"
          value={q.questionType}
          onChange={e => {
            const t = e.target.value as AIQuestion["questionType"];
            onChange({
              questionType: t,
              options: t === "multiple_choice" ? (q.options ?? ["", "", "", ""]) : undefined,
              correctAnswer: t === "true_false" ? "True" : "",
            });
          }}
          data-testid={`select-question-type-${qi}`}>
          <option value="multiple_choice">Multiple Choice</option>
          <option value="true_false">True / False</option>
          <option value="short_answer">Short Answer</option>
        </select>
      </div>
      {q.questionType === "multiple_choice" && (
        <div className="space-y-1">
          {(q.options ?? ["", "", "", ""]).map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input
                type="radio"
                name={`q${qi}-correct`}
                checked={q.correctAnswer === opt && !!opt}
                onChange={() => onChange({ correctAnswer: opt })}
                data-testid={`radio-correct-${qi}-${oi}`}
              />
              <Input
                className="h-7 text-xs flex-1"
                placeholder={`Option ${oi + 1}`}
                value={opt}
                onChange={e => {
                  const opts = [...(q.options ?? ["", "", "", ""])];
                  const oldVal = opts[oi];
                  opts[oi] = e.target.value;
                  const patch: Partial<AIQuestion> = { options: opts };
                  if (q.correctAnswer === oldVal) patch.correctAnswer = e.target.value;
                  onChange(patch);
                }}
                data-testid={`input-option-${qi}-${oi}`}
              />
            </div>
          ))}
        </div>
      )}
      {q.questionType === "true_false" && (
        <div className="flex gap-3">
          {["True", "False"].map(v => (
            <label key={v} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="radio" name={`q${qi}-tf`} checked={q.correctAnswer === v} onChange={() => onChange({ correctAnswer: v })} data-testid={`radio-tf-${qi}-${v}`} />
              {v}
            </label>
          ))}
        </div>
      )}
      {q.questionType === "short_answer" && (
        <Input
          className="h-7 text-xs"
          placeholder="Expected answer (case-insensitive match)"
          value={typeof q.correctAnswer === "string" ? q.correctAnswer : ""}
          onChange={e => onChange({ correctAnswer: e.target.value })}
          data-testid={`input-short-answer-${qi}`}
        />
      )}
      <Input
        className="h-7 text-xs"
        placeholder="Explanation (shown after answer, optional)"
        value={q.explanation ?? ""}
        onChange={e => onChange({ explanation: e.target.value })}
        data-testid={`input-explanation-${qi}`}
      />
    </div>
  );
}
