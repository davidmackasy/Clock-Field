import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Clock, Trophy, CheckCircle2, Play, ChevronRight,
  Loader2, Award, FileText, Image, ArrowLeft, Lock, ClipboardList,
} from "lucide-react";
import { QuizRunner, type QuizPayload, type QuizSubmitResult } from "@/components/training/quiz-runner";
import { AudioPlayer } from "@/components/training/audio-player";
import { apiRequest } from "@/lib/queryClient";
import { downloadCertificate } from "@/lib/certificate";

type MyCourse = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  thumbnailData: string | null;
  isRequired: boolean;
  estimatedDuration: string | null;
  certificateEnabled: boolean;
  totalModules: number;
  completedModules: number;
  progressPct: number;
  isCompleted: boolean;
  status: "not_started" | "in_progress" | "completed";
  certificate: { certificateCode: string; issuedAt: string } | null;
};

type CourseView = {
  course: MyCourse;
  modules: {
    id: string;
    title: string;
    description: string | null;
    youtubeEmbedId: string | null;
    lessonText: string | null;
    sortOrder: number;
    isRequired: boolean;
    assets: { id: string; assetData: string; sortOrder: number }[];
    completed: boolean;
  }[];
};

function ProgressRing({ pct, size = 36 }: { pct: number; size?: number }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={3} className="text-muted" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={3} className="text-primary" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} strokeLinecap="round" />
    </svg>
  );
}

function CourseCard({ course, onClick }: { course: MyCourse; onClick: () => void }) {
  const statusColor = course.isCompleted ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : course.status === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  const statusLabel = course.isCompleted ? "Completed" : course.status === "in_progress" ? "In Progress" : "Not Started";
  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden active:scale-[0.99] transition-all cursor-pointer hover:shadow-sm"
      onClick={onClick}
      data-testid={`card-my-course-${course.id}`}>
      <div className="h-28 bg-gradient-to-br from-primary/10 to-primary/5 relative">
        {course.thumbnailData ? (
          <img src={course.thumbnailData} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-primary/30" />
          </div>
        )}
        {course.isRequired && <Badge className="absolute top-2 left-2 bg-red-500 text-white text-xs">Required</Badge>}
        {course.isCompleted && <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center"><CheckCircle2 className="w-10 h-10 text-green-500" /></div>}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground text-sm leading-tight flex-1">{course.title}</h3>
          <ProgressRing pct={course.progressPct} size={32} />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
          {course.estimatedDuration && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{course.estimatedDuration}</span>}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {course.completedModules}/{course.totalModules} modules
        </div>
      </div>
    </div>
  );
}

// Certificate export is handled by `downloadCertificate` in `@/lib/certificate`.

export default function EmployeeTraining() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedModuleIdx, setSelectedModuleIdx] = useState(0);
  const [moduleListOpen, setModuleListOpen] = useState(false);
  // Time-gate: 15-second minimum engagement per module before "Mark Complete" is enabled.
  const MIN_GATE_SECONDS = 15;
  const [moduleStartTimes, setModuleStartTimes] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const { data: myCourses = [], isLoading } = useQuery<MyCourse[]>({
    queryKey: ["/api/training/my-courses"],
  });

  const { data: courseView, isLoading: courseLoading } = useQuery<CourseView>({
    queryKey: ["/api/training/my-courses", selectedCourseId],
    enabled: !!selectedCourseId,
  });

  const completeMutation = useMutation({
    mutationFn: async (args: { moduleId: string; elapsedSeconds: number }) => {
      const r = await apiRequest(
        "POST",
        `/api/training/my-courses/${selectedCourseId}/progress/${args.moduleId}`,
        { elapsedSeconds: args.elapsedSeconds },
      );
      return r.json() as Promise<{ ok: true; moduleId: string; modulesComplete: boolean; completedModules: number; totalModules: number; certificate: any }>;
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/training/my-courses"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/training/my-courses", selectedCourseId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/training/my-courses", selectedCourseId, "quiz"] }),
      ]);
      toast({ title: "Module completed!" });
      // Auto-advance: if there are more modules, move to the next; if all done & quiz exists, jump to quiz step.
      if (courseView) {
        const total = courseView.modules.length;
        if (selectedModuleIdx < total - 1) {
          setSelectedModuleIdx(selectedModuleIdx + 1);
        } else if (data.modulesComplete && quizPayload) {
          setSelectedModuleIdx(total);
        }
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Quiz: load if course has one (404 = no quiz, treat as null)
  const { data: quizPayload } = useQuery<QuizPayload | null>({
    queryKey: ["/api/training/my-courses", selectedCourseId, "quiz"],
    enabled: !!selectedCourseId,
    queryFn: async () => {
      const r = await fetch(`/api/training/my-courses/${selectedCourseId}/quiz`);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Failed to load quiz");
      return r.json();
    },
    retry: false,
  });

  const refreshAfterQuiz = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/training/my-courses"] });
    queryClient.invalidateQueries({ queryKey: ["/api/training/my-courses", selectedCourseId] });
    queryClient.invalidateQueries({ queryKey: ["/api/training/my-courses", selectedCourseId, "quiz"] });
  };

  const startQuiz = async () => {
    const r = await fetch(`/api/training/my-courses/${selectedCourseId}/quiz/start`, { method: "POST" });
    if (!r.ok) throw new Error((await r.json()).message || "Failed to start quiz");
    return r.json();
  };

  const submitQuiz = async (attemptId: string, answers: Record<string, any>): Promise<QuizSubmitResult> => {
    const r = await fetch(`/api/training/quiz-attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "Failed to submit quiz");
    refreshAfterQuiz();
    return data;
  };

  // Initialize the per-module timer the first time the user lands on a not-yet-completed module.
  useEffect(() => {
    if (!courseView) return;
    const cur = courseView.modules[selectedModuleIdx];
    if (!cur || cur.completed) return;
    setModuleStartTimes(prev => prev[cur.id] ? prev : { ...prev, [cur.id]: Date.now() });
  }, [courseView, selectedModuleIdx]);

  if (selectedCourseId && courseView) {
    const { course, modules } = courseView;
    const hasQuiz = !!quizPayload;
    const totalSteps = modules.length + (hasQuiz ? 1 : 0);
    const isQuizStep = hasQuiz && selectedModuleIdx === modules.length;
    const mod = isQuizStep ? null : modules[selectedModuleIdx];
    const completedSet = new Set(modules.filter(m => m.completed).map(m => m.id));
    // Gate calculation for the current module
    const modStart = mod ? moduleStartTimes[mod.id] : undefined;
    const elapsedSec = mod && modStart ? Math.floor((now - modStart) / 1000) : 0;
    const gatePassed = !mod || mod.completed || elapsedSec >= MIN_GATE_SECONDS;
    const remainingSec = Math.max(0, MIN_GATE_SECONDS - elapsedSec);

    return (
      <div className="min-h-screen bg-background pb-40">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedCourseId(null)} data-testid="btn-back-to-list">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-foreground truncate">{course.title}</div>
            <div className="text-xs text-muted-foreground">{course.completedModules}/{course.totalModules} modules · {course.progressPct}% complete{hasQuiz ? " · quiz" : ""}</div>
          </div>
          <div className="w-8">
            <ProgressRing pct={course.progressPct} size={30} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-muted">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${course.progressPct}%` }} />
        </div>

        {courseLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : isQuizStep && quizPayload ? (
          <div className="max-w-3xl mx-auto px-4 py-5">
            <div className="mb-4">
              <span className="text-xs text-muted-foreground">Final Step · {selectedModuleIdx + 1} of {totalSteps}</span>
              <h2 className="text-xl font-bold text-foreground mt-0.5 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />Final Quiz
              </h2>
            </div>
            <QuizRunner
              payload={quizPayload}
              onStart={startQuiz}
              onSubmit={submitQuiz}
              onPassed={() => refreshAfterQuiz()}
            />
            {/* Module nav back */}
            <div className="mt-6">
              <button
                className="w-full flex items-center justify-between p-3 border border-border rounded-lg text-sm"
                onClick={() => setModuleListOpen(v => !v)}
                data-testid="btn-toggle-module-list">
                <span className="font-medium text-foreground">All Modules</span>
                <ChevronRight className={`w-4 h-4 transition-transform ${moduleListOpen ? "rotate-90" : ""}`} />
              </button>
              {moduleListOpen && (
                <div className="border border-border rounded-lg overflow-hidden mt-3">
                  {modules.map((m, i) => (
                    <button
                      key={m.id}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm border-b border-border last:border-0 transition-colors hover:bg-muted/30`}
                      onClick={() => { setSelectedModuleIdx(i); setModuleListOpen(false); }}
                      data-testid={`btn-module-${m.id}`}>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${m.completed ? "border-green-500 bg-green-500" : "border-muted-foreground"}`}>
                        {m.completed ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <span className="text-xs font-bold text-foreground">{i + 1}</span>}
                      </div>
                      <span className={`flex-1 ${m.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{m.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : !mod ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">No modules</div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {/* Video */}
            {mod.youtubeEmbedId && (
              <div className="aspect-video bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${mod.youtubeEmbedId}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  data-testid="video-embed"
                />
              </div>
            )}

            <div className="px-4 py-5 space-y-5">
              {/* Module title */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">Module {selectedModuleIdx + 1} of {modules.length}</span>
                  {mod.completed && <Badge className="bg-green-500 text-white text-xs h-5">Done</Badge>}
                </div>
                <h2 className="text-xl font-bold text-foreground">{mod.title}</h2>
                {mod.description && <p className="text-sm text-muted-foreground mt-1">{mod.description}</p>}
              </div>

              {/* Audio player (TTS) — show when there's lesson text but no video */}
              {!mod.youtubeEmbedId && mod.lessonText && (
                <AudioPlayer text={mod.lessonText} title={mod.title} />
              )}

              {/* Lesson text */}
              {mod.lessonText && (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="bg-muted/30 rounded-lg p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">{mod.lessonText}</div>
                </div>
              )}

              {/* Images */}
              {(mod.assets?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground flex items-center gap-1"><Image className="w-4 h-4 text-muted-foreground" />Reference Images</div>
                  <div className="grid grid-cols-2 gap-2">
                    {mod.assets?.map(a => (
                      <img key={a.id} src={a.assetData} alt="" className="rounded-lg border border-border w-full object-cover aspect-video" />
                    ))}
                  </div>
                </div>
              )}

              {/* No content placeholder */}
              {!mod.youtubeEmbedId && !mod.lessonText && (mod.assets?.length ?? 0) === 0 && (
                <div className="flex flex-col items-center py-10 text-muted-foreground text-sm">
                  <FileText className="w-8 h-8 mb-2" />
                  Read through this module and mark it complete when ready.
                </div>
              )}
            </div>

            {/* Module nav / list toggle */}
            <div className="px-4">
              <button
                className="w-full flex items-center justify-between p-3 border border-border rounded-lg mb-3 text-sm"
                onClick={() => setModuleListOpen(v => !v)}
                data-testid="btn-toggle-module-list">
                <span className="font-medium text-foreground">All Modules</span>
                {moduleListOpen ? <ChevronRight className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {moduleListOpen && (
                <div className="border border-border rounded-lg overflow-hidden mb-4">
                  {modules.map((m, i) => (
                    <button
                      key={m.id}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm border-b border-border last:border-0 transition-colors ${i === selectedModuleIdx ? "bg-primary/5" : "hover:bg-muted/30"}`}
                      onClick={() => { setSelectedModuleIdx(i); setModuleListOpen(false); }}
                      data-testid={`btn-module-${m.id}`}>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${m.completed ? "border-green-500 bg-green-500" : i === selectedModuleIdx ? "border-primary" : "border-muted-foreground"}`}>
                        {m.completed ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <span className="text-xs font-bold text-foreground">{i + 1}</span>}
                      </div>
                      <span className={`flex-1 ${m.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{m.title}</span>
                      {m.youtubeEmbedId && <Play className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                    </button>
                  ))}
                  {hasQuiz && (
                    <button
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${isQuizStep ? "bg-primary/5" : "hover:bg-muted/30"}`}
                      onClick={() => { setSelectedModuleIdx(modules.length); setModuleListOpen(false); }}
                      data-testid="btn-module-quiz">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${quizPayload?.hasPassed ? "border-green-500 bg-green-500" : isQuizStep ? "border-primary" : "border-muted-foreground"}`}>
                        {quizPayload?.hasPassed ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <ClipboardList className="w-3.5 h-3.5 text-foreground" />}
                      </div>
                      <span className={`flex-1 ${quizPayload?.hasPassed ? "line-through text-muted-foreground" : "text-foreground"}`}>Final Quiz</span>
                      {!quizPayload?.modulesComplete && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Completed course certificate */}
            {course.isCompleted && course.certificate && course.certificateEnabled && (
              <div className="mx-4 mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl flex items-center gap-3">
                <Award className="w-8 h-8 text-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-foreground text-sm">Course Completed!</div>
                  <div className="text-xs text-muted-foreground">Certificate earned · {new Date(course.certificate.issuedAt).toLocaleDateString()}</div>
                </div>
                <Button size="sm" variant="outline" className="border-amber-400 text-amber-700" onClick={() => downloadCertificate({ name: "Employee", courseTitle: course.title, certificateCode: course.certificate!.certificateCode, issuedAt: course.certificate!.issuedAt })} data-testid="btn-download-cert">
                  Download
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Sticky bottom action (modules only) — sits above the mobile bottom nav */}
        {mod && !isQuizStep && (
          <div className="fixed bottom-16 left-0 right-0 z-40 p-3 bg-background border-t border-border safe-area-bottom">
            <div className="max-w-3xl mx-auto flex gap-3">
              {selectedModuleIdx > 0 && (
                <Button variant="outline" className="flex-1" onClick={() => setSelectedModuleIdx(i => i - 1)} data-testid="btn-prev-module">
                  ← Previous
                </Button>
              )}
              {!mod.completed ? (
                <Button
                  className="flex-1 relative overflow-hidden"
                  onClick={() => completeMutation.mutate({ moduleId: mod.id, elapsedSeconds: elapsedSec })}
                  disabled={completeMutation.isPending || !gatePassed}
                  data-testid="btn-mark-complete">
                  {/* Filling progress bar behind the label while the 15s gate is active */}
                  {!gatePassed && (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-500 ease-linear"
                      style={{ width: `${Math.min(100, (elapsedSec / MIN_GATE_SECONDS) * 100)}%` }}
                    />
                  )}
                  <span className="relative flex items-center justify-center">
                    {completeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : !gatePassed ? (
                      <Clock className="w-4 h-4 mr-1" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                    )}
                    {!gatePassed
                      ? `Read or listen · 0:${String(remainingSec).padStart(2, "0")}`
                      : "Mark Complete"}
                  </span>
                </Button>
              ) : selectedModuleIdx < modules.length - 1 ? (
                <Button className="flex-1" onClick={() => setSelectedModuleIdx(i => i + 1)} data-testid="btn-next-module">
                  Next Module →
                </Button>
              ) : hasQuiz ? (
                <Button className="flex-1" onClick={() => setSelectedModuleIdx(modules.length)} data-testid="btn-go-to-quiz">
                  <ClipboardList className="w-4 h-4 mr-1" />Go to Quiz
                </Button>
              ) : (
                <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled data-testid="btn-course-done">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> All Done!
                </Button>
              )}
            </div>
          </div>
        )}
        {isQuizStep && (
          <div className="fixed bottom-16 left-0 right-0 z-40 p-3 bg-background border-t border-border safe-area-bottom">
            <div className="max-w-3xl mx-auto">
              <Button variant="outline" className="w-full" onClick={() => setSelectedModuleIdx(modules.length - 1)} data-testid="btn-back-to-modules">
                ← Back to Modules
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Course list view
  const assigned = myCourses.filter(c => c.status !== "completed");
  const completed = myCourses.filter(c => c.isCompleted);

  return (
    <div className="p-4 pb-24 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">My Training</h1>
        <p className="text-sm text-muted-foreground">Complete your assigned courses</p>
      </div>

      {/* Quick stats */}
      {myCourses.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Assigned", value: myCourses.length, icon: BookOpen, color: "text-blue-500" },
            { label: "In Progress", value: myCourses.filter(c => c.status === "in_progress").length, icon: Clock, color: "text-amber-500" },
            { label: "Completed", value: completed.length, icon: Trophy, color: "text-green-500" },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
                <Icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
                <div className="text-lg font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : myCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl">
          <BookOpen className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-base font-semibold text-foreground mb-1">No courses assigned</p>
          <p className="text-sm text-muted-foreground">Your manager will assign training courses here.</p>
        </div>
      ) : (
        <>
          {assigned.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">Assigned Courses</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {assigned.map(c => <CourseCard key={c.id} course={c} onClick={() => { setSelectedCourseId(c.id); setSelectedModuleIdx(0); }} />)}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">Completed</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {completed.map(c => <CourseCard key={c.id} course={c} onClick={() => { setSelectedCourseId(c.id); setSelectedModuleIdx(0); }} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
