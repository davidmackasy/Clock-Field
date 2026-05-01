import { useState, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, CheckCircle2, ChevronLeft, ChevronRight, Loader2,
  RotateCcw, AlertCircle, ClipboardCheck, X, ImagePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

type Section = {
  id: string; title: string; sortOrder: number;
  steps: Step[];
};
type Step = {
  id: string; title: string; description: string;
  referenceImageUrl: string | null; isRequired: boolean; sortOrder: number;
  submission: { id: string; submittedImageUrl: string; submittedAt: string } | null;
};
type Submission = {
  id: string; templateId: string; status: string;
  submissionDate: string; totalSteps: number; completedSteps: number;
  template: { name: string; introText: string; outroText: string };
  sections: Section[];
};

export default function EmployeeScheduledFieldNotesCapture() {
  const [, params] = useRoute("/employee/scheduled-field-notes/:id");
  const submissionId = params?.id || "";
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Flat step index across all sections
  const [flatStepIndex, setFlatStepIndex] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [showOutro, setShowOutro] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [retaking, setRetaking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const { data: submission, isLoading } = useQuery<Submission>({
    queryKey: ["/api/employee/scheduled-field-notes/submissions", submissionId],
    queryFn: () => fetch(`/api/employee/scheduled-field-notes/submissions/${submissionId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });

  const submitStep = useMutation({
    mutationFn: ({ stepId, imageUrl }: { stepId: string; imageUrl: string }) =>
      apiRequest("POST", `/api/employee/scheduled-field-notes/submissions/${submissionId}/steps/${stepId}`, { imageUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee/scheduled-field-notes/submissions", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/scheduled-field-notes/today"] });
      setCapturedImage(null);
      setRetaking(false);
    },
    onError: () => toast({ title: "Failed to save photo", variant: "destructive" }),
  });

  const completeSubmission = useMutation({
    mutationFn: () => apiRequest("POST", `/api/employee/scheduled-field-notes/submissions/${submissionId}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee/scheduled-field-notes/today"] });
      setShowOutro(true);
    },
    onError: (e: any) => toast({ title: e.message || "Could not complete", variant: "destructive" }),
  });

  const handleImageCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setCapturedImage(reader.result); };
    reader.readAsDataURL(file);
    e.target.value = "";
    setRetaking(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div>
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Checklist not found</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/employee/scheduled-field-notes")}>Back</Button>
        </div>
      </div>
    );
  }

  // Build flat steps list
  const allSteps: (Step & { sectionTitle: string; sectionIndex: number })[] = [];
  (submission.sections || [])
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((section, si) => {
      (section.steps || [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .forEach(step => allSteps.push({ ...step, sectionTitle: section.title, sectionIndex: si }));
    });

  const currentStep = allSteps[flatStepIndex];
  const totalRequired = allSteps.filter(s => s.isRequired).length;
  const completedRequired = allSteps.filter(s => s.isRequired && s.submission).length;
  const allRequiredDone = completedRequired >= totalRequired;

  // Outro screen
  if (showOutro || submission.status === "completed") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <ClipboardCheck className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">All Done!</h2>
        {submission.template?.outroText && (
          <p className="text-muted-foreground mb-6 max-w-xs">{submission.template.outroText}</p>
        )}
        <p className="text-sm text-muted-foreground mb-8">
          {completedRequired}/{totalRequired} required steps completed · {format(parseISO(submission.submissionDate), "MMMM d, yyyy")}
        </p>
        <Button className="w-full max-w-xs" onClick={() => navigate("/employee/scheduled-field-notes")} data-testid="button-sfn-done">
          Back to Checklists
        </Button>
      </div>
    );
  }

  // Intro screen
  if (showIntro) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="border-b px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/employee/scheduled-field-notes")} data-testid="button-sfn-back-intro"><ChevronLeft className="w-5 h-5" /></Button>
          <span className="font-semibold text-base">{submission.template?.name || "Checklist"}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Camera className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{submission.template?.name || "Checklist"}</h2>
          {submission.template?.introText && (
            <p className="text-muted-foreground mb-6 max-w-xs">{submission.template.introText}</p>
          )}
          <p className="text-sm text-muted-foreground mb-8">
            {totalRequired} required step{totalRequired !== 1 ? "s" : ""} · Take a photo for each
          </p>

          {/* Step overview */}
          <div className="w-full max-w-xs text-left space-y-2 mb-8">
            {(submission.sections || []).sort((a, b) => a.sortOrder - b.sortOrder).map(section => (
              <div key={section.id} className="border rounded-xl p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{section.title}</p>
                <div className="space-y-1">
                  {(section.steps || []).sort((a, b) => a.sortOrder - b.sortOrder).map((step, i) => (
                    <div key={step.id} className="flex items-center gap-2 text-sm">
                      {step.submission ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                      <span className={step.submission ? "text-muted-foreground line-through" : ""}>{step.title}</span>
                      {!step.isRequired && <span className="text-[10px] text-muted-foreground ml-auto">(optional)</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button size="lg" className="w-full max-w-xs" onClick={() => setShowIntro(false)} data-testid="button-sfn-start">
            <Camera className="w-5 h-5 mr-2" />Start Checklist
          </Button>
        </div>
      </div>
    );
  }

  if (!currentStep) {
    // All steps done (or no steps), show complete button
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">All steps completed!</h2>
        <p className="text-muted-foreground mb-8">{completedRequired}/{totalRequired} required steps done</p>
        <Button size="lg" className="w-full max-w-xs" onClick={() => completeSubmission.mutate()} disabled={completeSubmission.isPending} data-testid="button-sfn-complete">
          {completeSubmission.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ClipboardCheck className="w-5 h-5 mr-2" />}
          Complete Checklist
        </Button>
      </div>
    );
  }

  const alreadySubmitted = !!currentStep.submission && !retaking;
  const canGoBack = flatStepIndex > 0;
  const canGoNext = flatStepIndex < allSteps.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 sticky top-0 bg-background z-10">
        <Button variant="ghost" size="icon" onClick={() => setShowIntro(true)} data-testid="button-sfn-back-capture"><ChevronLeft className="w-5 h-5" /></Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{currentStep.sectionTitle}</p>
          <p className="font-medium text-sm truncate">{submission.template?.name || "Checklist"}</p>
        </div>
        <span className="text-sm text-muted-foreground shrink-0">{flatStepIndex + 1}/{allSteps.length}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${allSteps.length > 0 ? ((flatStepIndex) / allSteps.length) * 100 : 0}%` }} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 max-w-lg mx-auto space-y-4">
          {/* Step title */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step {flatStepIndex + 1}</span>
              {!currentStep.isRequired && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Optional</span>}
              {currentStep.submission && !retaking && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Submitted</span>}
            </div>
            <h2 className="text-xl font-bold">{currentStep.title}</h2>
            {currentStep.description && <p className="text-sm text-muted-foreground mt-1">{currentStep.description}</p>}
          </div>

          {/* Reference photo */}
          {currentStep.referenceImageUrl && (
            <div className="rounded-2xl overflow-hidden border">
              <div className="px-3 py-2 bg-muted/50 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Reference Photo</span>
              </div>
              <img src={currentStep.referenceImageUrl} alt="Reference" className="w-full object-cover max-h-52" />
            </div>
          )}

          {/* Photo area */}
          <div className="space-y-3">
            {alreadySubmitted && currentStep.submission ? (
              <div className="rounded-2xl overflow-hidden border-2 border-green-200 relative">
                <img src={currentStep.submission.submittedImageUrl} alt="Your photo" className="w-full object-cover max-h-64" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-3 flex items-center justify-between">
                  <span className="text-white text-xs">Submitted {format(parseISO(currentStep.submission.submittedAt), "h:mm a")}</span>
                  <Button size="sm" variant="secondary" onClick={() => setRetaking(true)} data-testid={`button-retake-${currentStep.id}`} className="text-xs h-7">
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Retake
                  </Button>
                </div>
              </div>
            ) : capturedImage ? (
              <div className="rounded-2xl overflow-hidden border-2 border-primary/30 relative">
                <img src={capturedImage} alt="Captured" className="w-full object-cover max-h-64" />
                <button onClick={() => { setCapturedImage(null); setRetaking(false); }} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => cameraRef.current?.click()}
                data-testid={`button-take-photo-${currentStep.id}`}
                className="w-full border-2 border-dashed rounded-2xl h-52 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary hover:text-primary transition-colors active:scale-[0.99]"
              >
                <Camera className="w-10 h-10" />
                <div className="text-center">
                  <p className="font-medium text-sm">Take a Photo</p>
                  <p className="text-xs mt-0.5">Tap to open camera</p>
                </div>
              </button>
            )}

            {/* Camera inputs */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleImageCapture} className="hidden" data-testid={`input-camera-${currentStep.id}`} />
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageCapture} className="hidden" />

            {/* Upload from gallery fallback */}
            {!capturedImage && !alreadySubmitted && (
              <Button variant="outline" size="sm" className="w-full text-muted-foreground" onClick={() => fileRef.current?.click()} data-testid={`button-upload-photo-${currentStep.id}`}>
                <ImagePlus className="w-4 h-4 mr-2" />Choose from Gallery
              </Button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            {capturedImage ? (
              <Button
                className="flex-1"
                onClick={() => submitStep.mutate({ stepId: currentStep.id, imageUrl: capturedImage })}
                disabled={submitStep.isPending}
                data-testid={`button-submit-step-${currentStep.id}`}
              >
                {submitStep.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                Submit Photo
              </Button>
            ) : alreadySubmitted ? (
              canGoNext ? (
                <Button className="flex-1" onClick={() => setFlatStepIndex(i => i + 1)} data-testid="button-next-step">
                  Next Step <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Button className="flex-1" onClick={() => completeSubmission.mutate()} disabled={completeSubmission.isPending || !allRequiredDone} data-testid="button-sfn-finish">
                  {completeSubmission.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ClipboardCheck className="w-5 h-5 mr-2" />}
                  Complete Checklist
                </Button>
              )
            ) : (
              <>
                {!currentStep.isRequired && canGoNext && (
                  <Button variant="outline" className="flex-1" onClick={() => setFlatStepIndex(i => i + 1)} data-testid="button-skip-step">
                    Skip (Optional)
                  </Button>
                )}
                {!currentStep.isRequired && !canGoNext && (
                  <Button variant="outline" className="flex-1" onClick={() => completeSubmission.mutate()} disabled={completeSubmission.isPending || !allRequiredDone} data-testid="button-sfn-skip-and-finish">
                    Skip & Finish
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Bottom navigation */}
          <div className="flex items-center justify-between pt-2 pb-6">
            <Button variant="ghost" size="sm" onClick={() => { setFlatStepIndex(i => i - 1); setCapturedImage(null); setRetaking(false); }} disabled={!canGoBack} data-testid="button-prev-step" className="text-muted-foreground">
              <ChevronLeft className="w-4 h-4 mr-1" />Previous
            </Button>
            <div className="flex gap-1">
              {allSteps.map((s, i) => (
                <button key={s.id} onClick={() => { setFlatStepIndex(i); setCapturedImage(null); setRetaking(false); }}
                  className={cn("w-2 h-2 rounded-full transition-all", i === flatStepIndex ? "bg-primary w-4" : s.submission ? "bg-green-400" : "bg-muted-foreground/30")} />
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setFlatStepIndex(i => i + 1); setCapturedImage(null); setRetaking(false); }} disabled={!canGoNext} data-testid="button-next-step-bottom" className="text-muted-foreground">
              Next<ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
