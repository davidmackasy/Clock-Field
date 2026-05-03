import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Loader2, ChevronRight, ChevronLeft, Wand2, Plus, Trash2,
  CheckCircle2, AlertCircle, GripVertical, Wrench,
} from "lucide-react";

type Tone = "simple" | "professional" | "safety_focused" | "beginner_friendly";

type AIQuestion = {
  questionText: string;
  questionType: "multiple_choice" | "true_false" | "short_answer";
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
};

type AIDraftCourse = {
  title: string;
  description: string;
  category: string;
  estimatedDuration: string;
  objectives: string[];
  modules: {
    title: string;
    description?: string;
    lessonText?: string;
    keyPoints?: string[];
    checklist?: string[];
    safetyNotes?: string[];
  }[];
  suggestedQuiz?: {
    title?: string;
    description?: string;
    questions: AIQuestion[];
  };
  certificateText?: string;
  publicIntro?: string;
};

type EditableModule = {
  title: string;
  description: string;
  lessonText: string;
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

function packLessonText(m: AIDraftCourse["modules"][number]): string {
  const sections: string[] = [];
  if (m.lessonText && m.lessonText.trim()) sections.push(m.lessonText.trim());
  if (m.keyPoints?.length) sections.push("Key Points:\n" + m.keyPoints.map(p => `• ${p}`).join("\n"));
  if (m.checklist?.length) sections.push("Checklist:\n" + m.checklist.map(p => `☐ ${p}`).join("\n"));
  if (m.safetyNotes?.length) sections.push("⚠️ Safety Notes:\n" + m.safetyNotes.map(p => `• ${p}`).join("\n"));
  return sections.join("\n\n");
}

function packDescription(d: AIDraftCourse): string {
  const parts: string[] = [];
  if (d.description?.trim()) parts.push(d.description.trim());
  if (d.objectives?.length) {
    parts.push("What you'll learn:\n" + d.objectives.map(o => `• ${o}`).join("\n"));
  }
  return parts.join("\n\n");
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
  const [moduleCount, setModuleCount] = useState(4);
  const [includeQuiz, setIncludeQuiz] = useState(true);
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

  const reset = () => {
    setStep(1);
    setTopic(""); setIndustry(""); setAudience("");
    setModuleCount(4); setIncludeQuiz(true); setTone("simple");
    setCourse({ title: "", description: "", category: "", estimatedDuration: "" });
    setModules([]);
    setQuiz({ enabled: true, title: "", description: "", passingScore: 80, allowRetake: true, showCorrectAnswers: false, isRequired: true, questions: [] });
    setIsRequired(false); setCertificateEnabled(true); setPublicLinkEnabled(false);
  };

  useEffect(() => { if (!open) reset(); }, [open]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/training/ai/generate-course", {
        topic, industry: industry || undefined, audience: audience || undefined,
        moduleCount, includeQuiz, tone,
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
        isRequired: true,
      })));
      if (data.suggestedQuiz?.questions?.length) {
        setQuiz(q => ({
          ...q,
          enabled: includeQuiz,
          title: data.suggestedQuiz?.title || `${data.title} — Final Quiz`,
          description: data.suggestedQuiz?.description || "",
          questions: data.suggestedQuiz!.questions,
        }));
      } else {
        setQuiz(q => ({ ...q, enabled: false, questions: [] }));
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
      return (await res.json()) as { text: string };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
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
        isRequired: m.isRequired,
        sortOrder: i,
      })),
      quiz: quiz.enabled && quiz.questions.length > 0 ? {
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
      toast({ title: "Course created with AI", description: "You can now add YouTube videos, images, and assign employees." });
      onOpenChange(false);
      onCreated(data.id);
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const handleImprove = async (action: string, current: string, applyFn: (text: string) => void) => {
    if (!current.trim()) {
      toast({ title: "Nothing to improve", description: "Add some text first.", variant: "destructive" });
      return;
    }
    try {
      const result = await improveMutation.mutateAsync({ text: current, action });
      applyFn(result.text);
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
      setStep(2);
      generateMutation.mutate();
    } else if (step === 3) {
      if (!course.title.trim()) {
        toast({ title: "Title required", variant: "destructive" });
        return;
      }
      if (modules.length === 0 || modules.some(m => !m.title.trim())) {
        toast({ title: "Each module needs a title", variant: "destructive" });
        return;
      }
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Number of modules</Label>
                <Input
                  type="number"
                  min={1} max={10}
                  className="mt-1"
                  value={moduleCount}
                  onChange={e => setModuleCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  data-testid="input-ai-module-count"
                />
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
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <div className="text-sm font-medium text-foreground">Include final quiz</div>
                <div className="text-xs text-muted-foreground">AI will write questions based on the lessons</div>
              </div>
              <Switch checked={includeQuiz} onCheckedChange={setIncludeQuiz} data-testid="switch-ai-include-quiz" />
            </div>
            <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg p-3 flex gap-2">
              <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary" />
              <div>
                The AI will draft a complete course with title, description, learning objectives, lesson content for each module, and a quiz. You'll be able to edit everything before saving.
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
              <div className="text-sm text-muted-foreground mt-1">Writing modules{includeQuiz ? " and quiz" : ""}... this takes ~15-30 seconds.</div>
            </div>
          </div>
        )}

        {/* ── STEP 3: EDIT DRAFT ── */}
        {step === 3 && (
          <div className="space-y-5 py-2">
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
                  onClick={() => setModules(m => [...m, { title: "New Module", description: "", lessonText: "", isRequired: true }])}
                  data-testid="btn-add-ai-module">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Module
                </Button>
              </div>
              {modules.map((m, i) => (
                <div key={i} className="border border-border rounded-lg p-3 space-y-2.5 bg-card" data-testid={`block-ai-module-${i}`}>
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground font-mono">{String(i + 1).padStart(2, "0")}</span>
                    <Input
                      className="flex-1 h-8 text-sm font-medium"
                      placeholder="Module title"
                      value={m.title}
                      onChange={e => updateModule(i, { title: e.target.value })}
                      data-testid={`input-ai-module-title-${i}`}
                    />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setModules(ms => ms.filter((_, idx) => idx !== i))} data-testid={`btn-delete-ai-module-${i}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Input
                    className="h-8 text-sm"
                    placeholder="Short description (optional)"
                    value={m.description}
                    onChange={e => updateModule(i, { description: e.target.value })}
                    data-testid={`input-ai-module-description-${i}`}
                  />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs text-muted-foreground">Lesson content (key points, checklist, safety)</Label>
                      <Button
                        variant="ghost" size="sm" type="button" className="h-6 text-xs"
                        onClick={() => handleImprove("improve", m.lessonText, t => updateModule(i, { lessonText: t }))}
                        disabled={improveMutation.isPending}
                        data-testid={`btn-improve-lesson-${i}`}>
                        {improveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        <span className="ml-1">Improve</span>
                      </Button>
                    </div>
                    <Textarea
                      rows={6}
                      className="text-xs font-mono"
                      placeholder="Lesson text..."
                      value={m.lessonText}
                      onChange={e => updateModule(i, { lessonText: e.target.value })}
                      data-testid={`input-ai-module-lesson-${i}`}
                    />
                  </div>
                </div>
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
                      No quiz questions yet. Add manually or skip the quiz.
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
                  <div className="space-y-2">
                    {quiz.questions.map((q, qi) => (
                      <div key={qi} className="border border-border rounded p-2.5 bg-card space-y-2" data-testid={`block-ai-question-${qi}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-muted-foreground font-mono mt-1.5">Q{qi + 1}</span>
                          <Textarea
                            rows={2}
                            className="text-sm flex-1"
                            placeholder="Question text"
                            value={q.questionText}
                            onChange={e => updateQuestion(qi, { questionText: e.target.value })}
                            data-testid={`input-ai-question-text-${qi}`}
                          />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive flex-shrink-0" onClick={() => setQuiz(s => ({ ...s, questions: s.questions.filter((_, idx) => idx !== qi) }))} data-testid={`btn-delete-question-${qi}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <select
                            className="h-8 px-2 border border-border rounded-md text-xs bg-background text-foreground"
                            value={q.questionType}
                            onChange={e => {
                              const t = e.target.value as AIQuestion["questionType"];
                              updateQuestion(qi, {
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
                                  onChange={() => updateQuestion(qi, { correctAnswer: opt })}
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
                                    updateQuestion(qi, patch);
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
                                <input type="radio" name={`q${qi}-tf`} checked={q.correctAnswer === v} onChange={() => updateQuestion(qi, { correctAnswer: v })} data-testid={`radio-tf-${qi}-${v}`} />
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
                            onChange={e => updateQuestion(qi, { correctAnswer: e.target.value })}
                            data-testid={`input-short-answer-${qi}`}
                          />
                        )}
                        <Input
                          className="h-7 text-xs"
                          placeholder="Explanation (shown after answer, optional)"
                          value={q.explanation ?? ""}
                          onChange={e => updateQuestion(qi, { explanation: e.target.value })}
                          data-testid={`input-explanation-${qi}`}
                        />
                      </div>
                    ))}
                    <Button
                      variant="outline" size="sm" type="button" className="w-full"
                      onClick={() => setQuiz(s => ({ ...s, questions: [...s.questions, { questionText: "", questionType: "multiple_choice", options: ["", "", "", ""], correctAnswer: "" }] }))}
                      data-testid="btn-add-question">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Question
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
                Course will be saved as <strong>draft</strong>. After saving, you can add YouTube videos & images to each module, then publish & assign employees.
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
