import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, CheckCircle2, Play, ChevronRight, Loader2, Award,
  FileText, Image, AlertCircle, ArrowLeft, Clock, User,
} from "lucide-react";

type PublicCourse = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  thumbnailData: string | null;
  estimatedDuration: string | null;
  certificateEnabled: boolean;
  companyName: string;
  modules: {
    id: string;
    title: string;
    description: string | null;
    youtubeEmbedId: string | null;
    lessonText: string | null;
    sortOrder: number;
    assets: { id: string; assetData: string; sortOrder: number }[];
  }[];
};

type LearnerSession = {
  learnerId: string;
  name: string;
  email: string;
  completedModules: string[];
  isCompleted: boolean;
  certificate: { certificateCode: string; issuedAt: string } | null;
};

function printCertificate(cert: { certificateCode: string; issuedAt: string }, course: PublicCourse, name: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  const date = new Date(cert.issuedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Certificate</title><style>
    @page { size: A4 landscape; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; background: #fff; width: 297mm; height: 210mm; display: flex; align-items: center; justify-content: center; }
    .cert { border: 8px solid #1e40af; border-radius: 12px; padding: 40px 60px; text-align: center; width: 260mm; height: 185mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #eff6ff 0%, #fff 50%, #eff6ff 100%); }
    .header { color: #1e40af; font-size: 13px; text-transform: uppercase; letter-spacing: 3px; }
    .title { font-size: 36px; color: #1e3a8a; font-style: italic; margin: 8px 0; }
    .subtitle { font-size: 14px; color: #6b7280; }
    .name { font-size: 42px; color: #111827; font-style: italic; border-bottom: 2px solid #1e40af; padding-bottom: 4px; margin: 12px 0; }
    .course { font-size: 20px; color: #1e40af; font-weight: bold; margin: 8px 0; }
    .company { font-size: 14px; color: #6b7280; }
    .date { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .footer { font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; width: 100%; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 16px; font-weight: bold; color: #1e40af; }
    .code { font-family: monospace; font-size: 11px; color: #9ca3af; }
  </style></head><body>
  <div class="cert">
    <div>
      <div class="header">Certificate of Completion</div>
      <div class="title">This is to certify that</div>
    </div>
    <div>
      <div class="name">${name}</div>
      <div class="subtitle">has successfully completed the training course</div>
      <div class="course">${course.title}</div>
      <div class="company">Provided by ${course.companyName}</div>
      <div class="date">Completed on ${date}</div>
    </div>
    <div class="footer">
      <div class="logo">ClockField Training</div>
      <div class="code">Certificate ID: ${cert.certificateCode}</div>
    </div>
  </div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

export default function PublicTrainingCourse() {
  const { publicId } = useParams<{ publicId: string }>();
  const { toast } = useToast();
  const [learner, setLearner] = useState<LearnerSession | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [selectedModuleIdx, setSelectedModuleIdx] = useState(0);
  const [moduleListOpen, setModuleListOpen] = useState(false);

  // Load persisted session
  useEffect(() => {
    const saved = sessionStorage.getItem(`training_learner_${publicId}`);
    if (saved) {
      try { setLearner(JSON.parse(saved)); } catch {}
    }
  }, [publicId]);

  const { data: course, isLoading, isError } = useQuery<PublicCourse>({
    queryKey: ["/api/public/training", publicId],
    queryFn: () => fetch(`/api/public/training/${publicId}`).then(r => {
      if (!r.ok) throw new Error("Course not found");
      return r.json();
    }),
    retry: false,
  });

  const startMutation = useMutation({
    mutationFn: (data: { name: string; email: string }) =>
      fetch(`/api/public/training/${publicId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: (data: any) => {
      const session: LearnerSession = { learnerId: data.learnerId, name: nameInput, email: emailInput, completedModules: [], isCompleted: false, certificate: null };
      setLearner(session);
      sessionStorage.setItem(`training_learner_${publicId}`, JSON.stringify(session));
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: (moduleId: string) =>
      fetch(`/api/public/training/${publicId}/progress/${moduleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId: learner?.learnerId }),
      }).then(r => r.json()),
    onSuccess: (data: any) => {
      const updated: LearnerSession = {
        ...learner!,
        completedModules: [...(learner?.completedModules ?? []), data.moduleId],
        isCompleted: data.isCompleted ?? false,
        certificate: data.certificate ?? learner?.certificate ?? null,
      };
      setLearner(updated);
      sessionStorage.setItem(`training_learner_${publicId}`, JSON.stringify(updated));
      toast({ title: "Module completed!" });
      if (data.isCompleted) toast({ title: "Course complete! 🎉", description: "You can now download your certificate." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-center px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-semibold mb-2">Course Not Found</h1>
        <p className="text-muted-foreground max-w-sm">This training link is invalid or the course is no longer available.</p>
      </div>
    );
  }

  // Registration screen
  if (!learner) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl border border-border shadow-lg overflow-hidden">
          <div className="h-40 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative">
            {course.thumbnailData ? (
              <img src={course.thumbnailData} alt="" className="w-full h-full object-cover absolute inset-0" />
            ) : (
              <BookOpen className="w-16 h-16 text-primary/40" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-4 text-white">
              <div className="text-xs opacity-80">{course.companyName}</div>
              <div className="text-lg font-bold leading-tight">{course.title}</div>
            </div>
          </div>
          <div className="p-6">
            <div className="flex gap-4 text-sm text-muted-foreground mb-5">
              {course.estimatedDuration && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{course.estimatedDuration}</span>}
              <span className="flex items-center gap-1"><FileText className="w-4 h-4" />{course.modules.length} modules</span>
              {course.certificateEnabled && <span className="flex items-center gap-1 text-amber-600"><Award className="w-4 h-4" />Certificate</span>}
            </div>
            {course.description && <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{course.description}</p>}
            <div className="space-y-3">
              <div>
                <Label>Your Name <span className="text-destructive">*</span></Label>
                <Input className="mt-1" placeholder="Jane Smith" value={nameInput} onChange={e => setNameInput(e.target.value)} data-testid="input-learner-name" />
              </div>
              <div>
                <Label>Email Address <span className="text-destructive">*</span></Label>
                <Input className="mt-1" type="email" placeholder="jane@example.com" value={emailInput} onChange={e => setEmailInput(e.target.value)} data-testid="input-learner-email" />
              </div>
              <Button
                className="w-full"
                onClick={() => startMutation.mutate({ name: nameInput, email: emailInput })}
                disabled={!nameInput.trim() || !emailInput.trim() || startMutation.isPending}
                data-testid="btn-start-course">
                {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                Start Training
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const completedSet = new Set(learner.completedModules);
  const mod = course.modules[selectedModuleIdx];
  const totalPct = course.modules.length > 0 ? Math.round((completedSet.size / course.modules.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">{course.companyName} · {course.title}</div>
            <div className="text-sm font-medium text-foreground">{completedSet.size}/{course.modules.length} completed · {totalPct}%</div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <User className="w-3.5 h-3.5" />{learner.name}
          </div>
        </div>
        <div className="max-w-3xl mx-auto mt-2 w-full h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${totalPct}%` }} />
        </div>
      </div>

      {!mod ? (
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
              <span className="text-xs text-muted-foreground">Module {selectedModuleIdx + 1} of {course.modules.length}</span>
              <h2 className="text-xl font-bold text-foreground mt-0.5">{mod.title}</h2>
              {mod.description && <p className="text-sm text-muted-foreground mt-1">{mod.description}</p>}
            </div>

            {/* Lesson text */}
            {mod.lessonText && (
              <div className="bg-muted/30 rounded-lg p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {mod.lessonText}
              </div>
            )}

            {/* Images */}
            {(mod.assets?.length ?? 0) > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {mod.assets?.map(a => (
                  <img key={a.id} src={a.assetData} alt="" className="rounded-lg border border-border w-full object-cover aspect-video" />
                ))}
              </div>
            )}

            {!mod.youtubeEmbedId && !mod.lessonText && (mod.assets?.length ?? 0) === 0 && (
              <div className="flex flex-col items-center py-10 text-muted-foreground text-sm">
                <FileText className="w-8 h-8 mb-2" />
                Read through this module and mark it complete when ready.
              </div>
            )}
          </div>

          {/* Module list */}
          <div className="px-4">
            <button
              className="w-full flex items-center justify-between p-3 border border-border rounded-lg mb-3 text-sm"
              onClick={() => setModuleListOpen(v => !v)}
              data-testid="btn-toggle-module-list">
              <span className="font-medium text-foreground">All Modules</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${moduleListOpen ? "rotate-90" : ""}`} />
            </button>
            {moduleListOpen && (
              <div className="border border-border rounded-lg overflow-hidden mb-4">
                {course.modules.map((m, i) => (
                  <button
                    key={m.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm border-b border-border last:border-0 transition-colors ${i === selectedModuleIdx ? "bg-primary/5" : "hover:bg-muted/30"}`}
                    onClick={() => { setSelectedModuleIdx(i); setModuleListOpen(false); }}
                    data-testid={`btn-module-${m.id}`}>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold ${completedSet.has(m.id) ? "border-green-500 bg-green-500 text-white" : i === selectedModuleIdx ? "border-primary text-foreground" : "border-muted-foreground text-foreground"}`}>
                      {completedSet.has(m.id) ? "✓" : i + 1}
                    </div>
                    <span className={`flex-1 ${completedSet.has(m.id) ? "line-through text-muted-foreground" : "text-foreground"}`}>{m.title}</span>
                    {m.youtubeEmbedId && <Play className="w-3 h-3 text-muted-foreground" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Certificate */}
          {learner.isCompleted && learner.certificate && course.certificateEnabled && (
            <div className="mx-4 mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl flex items-center gap-3">
              <Award className="w-8 h-8 text-amber-500 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-sm">Course Complete! 🎉</div>
                <div className="text-xs text-muted-foreground">Your certificate is ready to download</div>
              </div>
              <Button size="sm" variant="outline" className="border-amber-400 text-amber-700" onClick={() => printCertificate(learner.certificate!, course, learner.name)} data-testid="btn-download-cert">
                Download
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Sticky bottom */}
      {mod && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
          <div className="max-w-3xl mx-auto flex gap-3">
            {selectedModuleIdx > 0 && (
              <Button variant="outline" className="flex-1" onClick={() => setSelectedModuleIdx(i => i - 1)} data-testid="btn-prev-module">← Prev</Button>
            )}
            {!completedSet.has(mod.id) ? (
              <Button className="flex-1" onClick={() => completeMutation.mutate(mod.id)} disabled={completeMutation.isPending} data-testid="btn-mark-complete">
                {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Mark Complete
              </Button>
            ) : selectedModuleIdx < course.modules.length - 1 ? (
              <Button className="flex-1" onClick={() => setSelectedModuleIdx(i => i + 1)} data-testid="btn-next-module">Next →</Button>
            ) : (
              <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled>
                <CheckCircle2 className="w-4 h-4 mr-1" /> All Done!
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
