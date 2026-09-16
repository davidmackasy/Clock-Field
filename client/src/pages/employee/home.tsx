import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { localToday } from "@/lib/timezone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation as useWouterLocation } from "wouter";
import { Clock, Play, Square, Calendar, ShieldAlert, ChevronRight, Zap, X as XIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, GraduationCap, Briefcase } from "lucide-react";

export default function EmployeeHome() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useWouterLocation();
  const [elapsed, setElapsed] = useState(0);
  const [blockClockOutOpen, setBlockClockOutOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [blockSfnClockOutOpen, setBlockSfnClockOutOpen] = useState(false);
  const [pendingSfnItems, setPendingSfnItems] = useState<any[]>([]);
  const [paDismissed, setPaDismissed] = useState(false);
  const [paClockInDialogOpen, setPaClockInDialogOpen] = useState(false);
  const [paLightbox, setPaLightbox] = useState<{ photoIds: string[]; idx: number } | null>(null);
  const [fitOpen, setFitOpen] = useState(false);
  const [fitShiftId, setFitShiftId] = useState<string | undefined>();
  const [fitAnswers, setFitAnswers] = useState<(boolean | undefined)[]>([undefined, undefined, undefined, undefined, undefined]);
  const [fitConfirmed, setFitConfirmed] = useState(false);
  const [facePhotoData, setFacePhotoData] = useState<string | null>(null);
  const [facePhotoCapturedAt, setFacePhotoCapturedAt] = useState<string | null>(null);
  const [facePhotoAccepted, setFacePhotoAccepted] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const faceVideoRef = useRef<HTMLVideoElement>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);

  const { data: tzData } = useQuery<{ timezone: string }>({
    queryKey: ["/api/settings/timezone"],
    staleTime: Infinity,
  });
  const tz = tzData?.timezone || "UTC";

  const { data: activeEntry, isLoading: entryLoading } = useQuery<any>({
    queryKey: ["/api/time-entries/active"],
    refetchInterval: 10000,
  });

  const { data: myShifts, isLoading: shiftsLoading } = useQuery<any[]>({
    queryKey: ["/api/shifts"],
  });

  const { data: clockOutCheck } = useQuery<{ hasPending: boolean; count: number; requests: any[] }>({
    queryKey: ["/api/employee/cleaner-requests/clock-out-check"],
    enabled: !!activeEntry,
    staleTime: 30_000,
    refetchInterval: activeEntry ? 60_000 : false,
  });

  const { data: sfnClockOutCheck } = useQuery<{ hasIncomplete: boolean; count: number; items: any[] }>({
    queryKey: ["/api/employee/scheduled-field-notes/clock-out-check"],
    enabled: !!activeEntry,
    staleTime: 30_000,
    refetchInterval: activeEntry ? 60_000 : false,
  });

  const { data: myPriorityAlerts = [] } = useQuery<any[]>({
    queryKey: ["/api/employee/priority-alerts"],
    refetchInterval: 5 * 60_000,
  });

  const { data: trainingReminder } = useQuery<{
    hasReminder: boolean;
    totalRequiredIncomplete: number;
    training: {
      assignmentId: string;
      courseId: string;
      title: string;
      status: string;
      progressPercent: number;
      required: boolean;
      retakeRequired: boolean;
    } | null;
  }>({
    queryKey: ["/api/training/my-reminder"],
    refetchInterval: 5 * 60_000,
  });

  const clockInMut = useMutation({
    mutationFn: async ({ shiftId, verificationId }: { shiftId?: string; verificationId: string }) => {
      const res = await apiRequest("POST", "/api/time-entries/clock-in", { shiftId, verificationId });
      return res.json();
    },
    onSuccess: () => {
      setFitOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Clock-In Successful", description: "Your Fit for Duty Check has been submitted." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const fitSubmitMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fit-for-duty", { answers: fitAnswers, confirmationAccepted: fitConfirmed, shiftId: fitShiftId, facePhotoData, facePhotoCapturedAt });
      return res.json();
    },
    onSuccess: (data) => {
      clockInMut.mutate({ shiftId: fitShiftId, verificationId: data.id });
    },
    onError: (err: any) => toast({ title: "Unable to save verification", description: err.message, variant: "destructive" }),
  });

  const openFit = (shiftId?: string) => {
    setFitShiftId(shiftId); setFitAnswers([undefined, undefined, undefined, undefined, undefined]); setFitConfirmed(false); setFacePhotoData(null); setFacePhotoCapturedAt(null); setFacePhotoAccepted(false); setCameraError(""); setFitOpen(true);
  };

  const stopFaceCamera = () => {
    faceStreamRef.current?.getTracks().forEach(track => track.stop());
    faceStreamRef.current = null;
    if (faceVideoRef.current) faceVideoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraStarting(false);
    setCameraReady(false);
  };

  const startFaceCamera = async () => {
    stopFaceCamera();
    setFacePhotoData(null);
    setFacePhotoCapturedAt(null);
    setFacePhotoAccepted(false);
    setCameraError("");
    setCameraStarting(true);
    setCameraActive(true);
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("CAMERA_UNAVAILABLE");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 720 },
            height: { ideal: 1280 },
          },
          audio: false,
        });
      } catch (initialError) {
        if (initialError instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(initialError.name)) {
          throw initialError;
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      faceStreamRef.current = stream;
      const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
        let attempts = 0;
        const findVideo = () => {
          if (faceVideoRef.current) return resolve(faceVideoRef.current);
          if (++attempts >= 30) return reject(new Error("VIDEO_NOT_MOUNTED"));
          requestAnimationFrame(findVideo);
        };
        findVideo();
      });

      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("CAMERA_START_TIMEOUT")), 10000);
          video.onloadedmetadata = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          video.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error("CAMERA_PREVIEW_FAILED"));
          };
        });
      }

      await video.play();

      if (!stream.active || !stream.getVideoTracks().some(track => track.readyState === "live") || video.videoWidth <= 0 || video.videoHeight <= 0 || video.paused) {
        throw new Error("CAMERA_NOT_READY");
      }

      setCameraStarting(false);
      setCameraReady(true);
    } catch (error) {
      stopFaceCamera();
      if (error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name)) {
        setCameraError("Camera access is blocked. Please enable camera permission for ClockField in your browser settings and try again.");
      } else if (error instanceof Error && error.message === "CAMERA_UNAVAILABLE") {
        setCameraError("Camera access requires a supported browser and a secure HTTPS connection.");
      } else {
        setCameraError("The camera preview could not start. Check that another app is not using the camera, then try again.");
      }
    }
  };

  const captureFacePhoto = async () => {
    const video = faceVideoRef.current;
    const stream = faceStreamRef.current;
    if (!cameraReady || !video || video.paused || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight || !stream?.active) {
      setCameraError("The camera is not ready yet. Wait for the live preview, then try again.");
      return;
    }
    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("The photo could not be captured. Please try again.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) {
      setCameraError("The photo could not be captured. Please try again.");
      return;
    }
    try {
      const photoData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("PHOTO_READ_FAILED"));
        reader.onerror = () => reject(reader.error || new Error("PHOTO_READ_FAILED"));
        reader.readAsDataURL(blob);
      });
      setFacePhotoData(photoData);
      setFacePhotoCapturedAt(new Date().toISOString());
      setCameraError("");
      stopFaceCamera();
    } catch {
      setCameraError("The photo could not be prepared. Please capture it again.");
    }
  };

  useEffect(() => () => stopFaceCamera(), []);

  const clockOutMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/time-entries/clock-out");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Clocked out!" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!activeEntry) { setElapsed(0); return; }
    const start = new Date(activeEntry.clockInAt).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleClockOutAttempt = () => {
    if (sfnClockOutCheck?.hasIncomplete && sfnClockOutCheck.items?.length > 0) {
      setPendingSfnItems(sfnClockOutCheck.items);
      setBlockSfnClockOutOpen(true);
    } else if (clockOutCheck?.hasPending && clockOutCheck.requests?.length > 0) {
      setPendingRequests(clockOutCheck.requests);
      setBlockClockOutOpen(true);
    } else {
      clockOutMut.mutate();
    }
  };

  const today = localToday(tz);
  const todayShifts = (myShifts || []).filter(s => s.shiftDate === today && s.status === "scheduled");
  const upcomingShifts = (myShifts || []).filter(s => s.shiftDate > today && s.status === "scheduled").slice(0, 3);
  const isActive = !!activeEntry;

  return (
    <div className="p-4 pb-24 space-y-5">
      <Dialog open={fitOpen} onOpenChange={(open) => { if (!open) stopFaceCamera(); setFitOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Fit for Duty Check</DialogTitle><DialogDescription>Complete each question and take a live photo before clocking in.</DialogDescription></DialogHeader>
          <p className="text-sm text-muted-foreground">To help maintain a safe workplace for employees, clients, and the public, we require a quick fitness-for-duty check before starting your shift. Please answer the following questions honestly.</p>
          <div className="space-y-5 mt-2">
            {[
              "Are you fit and able to safely perform your assigned duties today?",
              "Are you currently affected by alcohol, cannabis, recreational drugs, or any other substance that could impair your ability to work safely?",
              "Is anything currently affecting your judgment, coordination, concentration, reaction time, or ability to work safely?",
              "Are you excessively tired, fatigued, or otherwise not alert enough to safely perform your duties?",
              "Is there any other reason you believe you may not be able to safely perform your assigned duties today?",
            ].map((question, i) => (
              <div key={question} className="space-y-2">
                <p className="text-sm font-medium">{i + 1}. {question}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map(value => (
                    <Button key={String(value)} type="button" variant={fitAnswers[i] === value ? "default" : "outline"} className="h-12 text-base" onClick={() => setFitAnswers(a => a.map((x, j) => j === i ? value : x))}>{value ? "Yes" : "No"}</Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {!fitAnswers.some(answer => answer === undefined) && <div className="space-y-3 rounded-lg border p-4">
            <div><p className="font-semibold">Quick Photo Verification</p><p className="text-sm text-muted-foreground">Please take a quick live photo to confirm your attendance for this shift.</p></div>
            {!cameraActive && !facePhotoData && <div className="space-y-2 text-center"><p className="text-sm font-medium">Camera Access Required</p><p className="text-sm text-muted-foreground">ClockField needs access to your camera to take your attendance verification photo.</p><Button type="button" variant="outline" className="w-full h-12" onClick={startFaceCamera}>{cameraError ? "Try Again" : "Enable Camera"}</Button></div>}
            {cameraActive && <div className="space-y-3"><div className="relative overflow-hidden rounded-lg bg-muted aspect-[4/3]"><video ref={faceVideoRef} autoPlay playsInline muted className={cameraReady ? "h-full w-full object-cover [transform:scaleX(-1)]" : "h-full w-full opacity-0"} />{!cameraReady && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">{cameraStarting ? "Starting camera…" : "Preparing camera…"}</div>}</div><Button type="button" className="w-full" onClick={captureFacePhoto} disabled={!cameraReady}>Capture Photo</Button></div>}
            {facePhotoData && <div className="space-y-3"><img src={facePhotoData} alt="Captured live attendance verification" className="aspect-[4/3] w-full rounded-lg object-cover [transform:scaleX(-1)]" /><div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" onClick={startFaceCamera}>Retake</Button><Button type="button" onClick={() => setFacePhotoAccepted(true)} disabled={facePhotoAccepted}>{facePhotoAccepted ? "Photo Selected" : "Use Photo"}</Button></div></div>}
            {cameraError && <p role="alert" className="text-sm text-destructive">{cameraError}</p>}
          </div>}
          {facePhotoAccepted && <label className="flex items-start gap-3 text-sm mt-3 cursor-pointer">
              <Checkbox checked={fitConfirmed} onCheckedChange={v => setFitConfirmed(v === true)} className="mt-0.5" />
              <span>I confirm that the answers I provided are true and accurate and that I am fit to safely perform my assigned duties.</span>
            </label>}
          <Button className="w-full h-12 text-base" disabled={fitAnswers.some(a => a === undefined) || !facePhotoAccepted || !fitConfirmed || fitSubmitMut.isPending || clockInMut.isPending} onClick={() => fitSubmitMut.mutate()}>Confirm &amp; Clock In</Button>
        </DialogContent>
      </Dialog>
      {/* Clock-out blocker modal */}
      <Dialog open={blockClockOutOpen} onOpenChange={setBlockClockOutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <ShieldAlert className="w-5 h-5" />
              Reply Required Before Clocking Out
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You have {pendingRequests.length} admin request{pendingRequests.length > 1 ? "s" : ""} that require{pendingRequests.length === 1 ? "s" : ""} your reply before you can clock out.
            </p>
            <div className="space-y-2">
              {pendingRequests.map((req: any) => (
                <div key={req.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold">{req.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{req.requestType?.replace(/_/g, " ")}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/employee/requests" onClick={() => setBlockClockOutOpen(false)}>
                <Button className="w-full" data-testid="button-go-to-requests-from-blocker">
                  <ChevronRight className="w-4 h-4 mr-1.5" />
                  Reply to Admin Now
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => { setBlockClockOutOpen(false); clockOutMut.mutate(); }}
                disabled={clockOutMut.isPending}
                data-testid="button-clock-out-anyway"
              >
                {clockOutMut.isPending ? "Clocking out..." : "Clock Out Anyway"}
              </Button>
              <Button variant="ghost" className="w-full text-sm" onClick={() => setBlockClockOutOpen(false)} data-testid="button-cancel-clock-out">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scheduled Field Notes clock-out blocker modal */}
      <Dialog open={blockSfnClockOutOpen} onOpenChange={setBlockSfnClockOutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <div className="flex flex-col leading-snug">
                <span className="font-semibold">Checklist Required</span>
                <span className="font-normal text-base">Before Clock Out</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You have {pendingSfnItems.length} required photo checklist{pendingSfnItems.length > 1 ? "s" : ""} that must be completed before clocking out.
            </p>
            <div className="space-y-2">
              {pendingSfnItems.map((item: any) => (
                <div key={item.assignmentId} className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="text-sm font-semibold">{item.templateName}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/employee/scheduled-field-notes" onClick={() => setBlockSfnClockOutOpen(false)}>
                <Button className="w-full" data-testid="button-go-to-checklists-from-blocker">
                  <ChevronRight className="w-4 h-4 mr-1.5" />
                  Complete Checklists Now
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => { setBlockSfnClockOutOpen(false); clockOutMut.mutate(); }}
                disabled={clockOutMut.isPending}
                data-testid="button-sfn-clock-out-anyway"
              >
                {clockOutMut.isPending ? "Clocking out..." : "Clock Out Anyway"}
              </Button>
              <Button variant="ghost" className="w-full text-sm" onClick={() => setBlockSfnClockOutOpen(false)} data-testid="button-sfn-cancel-clock-out">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div>
        <h1 className="text-xl font-bold" data-testid="text-welcome">
          Hi, {user?.firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Admin request reminder banner */}
      {clockOutCheck?.hasPending && (
        <Link href="/employee/requests">
          <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 cursor-pointer hover:bg-amber-100 transition-colors" data-testid="admin-request-reminder-banner">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">Admin Request Pending</p>
              <p className="text-xs text-amber-700">{clockOutCheck.count} request{clockOutCheck.count > 1 ? "s" : ""} require{clockOutCheck.count === 1 ? "s" : ""} your reply — check Reports tab</p>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
        </Link>
      )}

      {/* Required Training reminder */}
      {trainingReminder?.hasReminder && trainingReminder.training && (() => {
        const t = trainingReminder.training;
        const total = trainingReminder.totalRequiredIncomplete;
        const isRetake = t.status === "retake_needed";
        const isInProgress = t.status === "in_progress";
        let message: string;
        if (isRetake) message = `You need to retake ${t.title} to complete your required training.`;
        else if (isInProgress) message = `You are ${t.progressPercent}% done with ${t.title}. Please finish your required training.`;
        else message = `You have required training to complete: ${t.title}.`;
        return (
          <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3.5 space-y-3" data-testid="training-reminder-card">
            <div className="flex items-start gap-2.5">
              <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Required Training</p>
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0 text-[10px] h-4 px-1.5">Required</Badge>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5 leading-relaxed" data-testid="training-reminder-message">{message}</p>
                {total > 1 && (
                  <p className="text-[10px] text-blue-500 dark:text-blue-500 mt-1" data-testid="training-reminder-count">1 of {total} required trainings</p>
                )}
                {isInProgress && (
                  <div className="mt-2 h-1.5 w-full rounded-full bg-blue-200 dark:bg-blue-900">
                    <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${t.progressPercent}%` }} data-testid="training-reminder-progress" />
                  </div>
                )}
              </div>
            </div>
            <Button
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs font-semibold"
              onClick={() => navigate("/employee/training")}
              data-testid="button-training-reminder-action"
            >
              <GraduationCap className="w-3.5 h-3.5 mr-1.5" />
              {isRetake ? "Retake Training" : "Continue Training"}
            </Button>
          </div>
        );
      })()}

      {/* Priority Clean reminder banner */}
      {!paDismissed && myPriorityAlerts.length > 0 && (
        <div className="rounded-xl border-2 border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-700 p-3 space-y-2.5" data-testid="priority-clean-reminder">
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {myPriorityAlerts.length === 1 ? (
                <>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">{myPriorityAlerts[0].title}</p>
                  {myPriorityAlerts[0].locationName && (
                    <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">
                      Our client at <span className="font-semibold">{myPriorityAlerts[0].locationName}</span> reported an issue that needs attention.
                    </p>
                  )}
                  {myPriorityAlerts[0].message && !myPriorityAlerts[0].locationName && (
                    <p className="text-xs text-red-600 dark:text-red-300 mt-0.5 leading-relaxed">{myPriorityAlerts[0].message}</p>
                  )}
                  <p className="text-[10px] text-red-400 mt-0.5">
                    Created {new Date(myPriorityAlerts[0].createdAt).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">{myPriorityAlerts.length} Open Priority Clean Alerts</p>
                  <div className="space-y-0.5 mt-0.5">
                    {myPriorityAlerts.map((a: any) => (
                      <p key={a.id} className="text-xs text-red-600 dark:text-red-300">
                        {a.locationName ? `${a.locationName} — ` : ""}{a.title}
                      </p>
                    ))}
                  </div>
                </>
              )}
              {myPriorityAlerts[0]?.photos?.length > 0 && myPriorityAlerts.length === 1 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {myPriorityAlerts[0].photos.map((p: any, i: number) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPaLightbox({ photoIds: myPriorityAlerts[0].photos.map((x: any) => x.id), idx: i })}
                      className="relative w-14 h-14 rounded-md overflow-hidden border-2 border-red-300 focus:outline-none focus:ring-2 focus:ring-red-400 cursor-pointer group active:scale-95 transition-transform"
                      data-testid={`home-pa-photo-${p.id}`}
                    >
                      <img src={`/api/priority-alert-photos/${p.id}/image`} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 group-active:bg-black/35 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPaDismissed(true)}
              className="text-red-400 hover:text-red-600 p-0.5 shrink-0 transition-colors"
              data-testid="button-dismiss-priority-reminder"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
          <Button
            size="sm"
            className="w-full bg-red-600 hover:bg-red-700 text-white h-9 text-xs font-semibold"
            onClick={() => {
              if (!isActive) {
                setPaClockInDialogOpen(true);
              } else {
                navigate("/employee/work-log");
              }
            }}
            data-testid="button-priority-reminder-action"
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            {myPriorityAlerts.length === 1 ? "View Priority Work" : `View ${myPriorityAlerts.length} Priority Alerts`}
          </Button>
        </div>
      )}

      <Card className={isActive ? "border-primary/30 bg-primary/5 dark:bg-primary/10" : ""}>
        <CardContent className="p-5">
          {entryLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-16 w-40 mx-auto" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : isActive ? (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Currently Working</span>
              </div>
              <p className="text-5xl font-mono font-bold tracking-tight mb-1" data-testid="text-timer">{formatTime(elapsed)}</p>
              <p className="text-xs text-muted-foreground mb-5">
                Started at {new Date(activeEntry.clockInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <Button
                size="lg"
                variant="destructive"
                className="w-full h-14 text-base font-semibold"
                onClick={handleClockOutAttempt}
                disabled={clockOutMut.isPending}
                data-testid="button-clock-out"
              >
                <Square className="w-5 h-5 mr-2" />
                {clockOutMut.isPending ? "Clocking out..." : "Clock Out"}
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Not Clocked In</span>
              </div>
              <p className="text-4xl font-mono font-bold tracking-tight text-muted-foreground/30 mb-5" data-testid="text-timer-idle">00:00:00</p>

              {todayShifts.length > 0 ? (
                <div className="space-y-2">
                  {todayShifts.map(shift => (
                    <Button
                      key={shift.id}
                      size="lg"
                      className="w-full h-14 text-base font-semibold"
                       onClick={() => openFit(shift.id)}
                      disabled={clockInMut.isPending}
                      data-testid={`button-clock-in-${shift.id}`}
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Clock In — {new Date(shift.scheduledStartAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Button>
                  ))}
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full h-14 text-base font-semibold"
                   onClick={() => openFit()}
                  disabled={clockInMut.isPending}
                  data-testid="button-clock-in"
                >
                  <Play className="w-5 h-5 mr-2" />
                  {clockInMut.isPending ? "Clocking in..." : "Clock In"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {todayShifts.length > 0 && !isActive && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Today's Shifts</h2>
          <div className="space-y-2">
            {todayShifts.map(shift => (
              <Card key={shift.id} data-testid={`today-shift-${shift.id}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(shift.scheduledStartAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {new Date(shift.scheduledEndAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {shift.expectedHours && <p className="text-xs text-muted-foreground">{parseFloat(shift.expectedHours).toFixed(1)}h scheduled</p>}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">Scheduled</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {upcomingShifts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Upcoming</h2>
          <div className="space-y-2">
            {upcomingShifts.map(shift => (
              <Card key={shift.id} data-testid={`upcoming-shift-${shift.id}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(shift.shiftDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(shift.scheduledStartAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {new Date(shift.scheduledEndAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{parseFloat(shift.expectedHours || "0").toFixed(1)}h</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      {/* My Jobs */}
      <MyJobsSection />

      {/* Clock-in first dialog for priority alert action */}
      <Dialog open={paClockInDialogOpen} onOpenChange={setPaClockInDialogOpen}>
        <DialogContent className="max-w-sm" data-testid="dialog-pa-clock-in-first">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Zap className="w-5 h-5" /> Priority Clean — Clock In First
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You need to clock in before you can view and complete your priority clean assignment. Please clock in first, then visit your Work Log.
          </p>
          <Button
            className="w-full"
            onClick={() => setPaClockInDialogOpen(false)}
            data-testid="button-pa-clock-in-dismiss"
          >
            Got It
          </Button>
        </DialogContent>
      </Dialog>

      {/* Priority Alert Photo Lightbox */}
      {paLightbox && (
        <div
          className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center"
          onClick={() => setPaLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setPaLightbox(null)}
            data-testid="button-home-pa-lightbox-close"
          >
            <XIcon className="w-6 h-6" />
          </button>
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 rounded-full hover:bg-white/10 disabled:opacity-20 transition-colors"
            disabled={paLightbox.idx === 0}
            onClick={e => { e.stopPropagation(); setPaLightbox(p => p ? { ...p, idx: p.idx - 1 } : null); }}
            data-testid="button-home-pa-lightbox-prev"
          >
            <ChevronLeftIcon className="w-8 h-8" />
          </button>
          <img
            src={`/api/priority-alert-photos/${paLightbox.photoIds[paLightbox.idx]}/image`}
            alt=""
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 rounded-full hover:bg-white/10 disabled:opacity-20 transition-colors"
            disabled={paLightbox.idx === paLightbox.photoIds.length - 1}
            onClick={e => { e.stopPropagation(); setPaLightbox(p => p ? { ...p, idx: p.idx + 1 } : null); }}
            data-testid="button-home-pa-lightbox-next"
          >
            <ChevronRightIcon className="w-8 h-8" />
          </button>
          {paLightbox.photoIds.length > 1 && (
            <p className="absolute bottom-6 text-white/60 text-sm">{paLightbox.idx + 1} / {paLightbox.photoIds.length}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── My Jobs Section ──────────────────────────────────────────────────────────
function MyJobsSection() {
  const { data: jobs, isLoading } = useQuery<any[]>({ queryKey: ["/api/employee/my-jobs"] });

  if (isLoading) return (
    <div className="mx-4 mb-4 space-y-2">
      {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
    </div>
  );

  if (!jobs?.length) return null;

  const upcoming = jobs.filter(j => ["scheduled", "assigned", "in_progress"].includes(j.status));
  if (!upcoming.length) return null;

  const statusColor: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    assigned: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };

  return (
    <div className="px-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Briefcase className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">My Jobs</h2>
      </div>
      <div className="space-y-2">
        {upcoming.slice(0, 5).map((job: any) => (
          <div
            key={job.id}
            data-testid={`job-card-${job.id}`}
            className="flex items-center justify-between gap-3 bg-card border rounded-xl p-3.5 shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{job.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {job.scheduledDate} {job.startTime && `· ${job.startTime}`}
                {job.serviceType && ` · ${job.serviceType}`}
              </p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${statusColor[job.status] || "bg-muted text-muted-foreground"}`}>
              {job.status.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
