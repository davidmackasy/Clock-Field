import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, ClipboardList, Building2, Home, Camera, Mic, MicOff, Square, Trash2, Play, SkipForward, Images, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormConfig, FormStep, FormField } from "@shared/schema";

type FormData = { id: string; name: string; config: FormConfig; companyName: string; companyLogo: string | null; brandColor: string | null };

function isFieldVisible(field: FormField, values: Record<string, any>): boolean {
  const rule = field.visibilityRule ?? "always";
  if (rule !== "always") {
    const propType = (values.propertyType ?? "").toLowerCase();
    if (rule === "residential_only" && propType !== "residential") return false;
    if (rule === "commercial_only" && propType !== "commercial") return false;
  }
  if (field.showWhenField && field.showWhenValues) {
    const triggerValue = values[field.showWhenField];
    if (!triggerValue || !field.showWhenValues.includes(triggerValue)) return false;
  }
  return true;
}

function FormInput({ field, value, onChange, error }: {
  field: FormField; value: any; onChange: (v: any) => void; error?: string;
}) {
  const base = cn(
    "w-full rounded-xl border px-4 py-3 text-sm bg-white transition-all outline-none",
    "focus:ring-2 focus:ring-offset-0 placeholder-gray-400 text-gray-900",
    error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-gray-200 focus:border-indigo-300 focus:ring-indigo-100"
  );
  if (field.type === "select") {
    return (
      <select className={cn(base, "cursor-pointer")} value={value ?? ""} onChange={e => onChange(e.target.value)}>
        <option value="">Select an option…</option>
        {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === "textarea") {
    return <textarea className={cn(base, "resize-none min-h-[100px]")} placeholder={field.placeholder} value={value ?? ""} onChange={e => onChange(e.target.value)} rows={4} />;
  }
  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all", value ? "border-indigo-500 bg-indigo-500" : "border-gray-300 group-hover:border-indigo-400")}>
          {value && <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </div>
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="sr-only" />
        <span className="text-sm text-gray-600 leading-5">{field.label}</span>
      </label>
    );
  }
  return <input type={field.type} className={base} placeholder={field.placeholder} value={value ?? ""} onChange={e => onChange(e.target.value)} />;
}

function StepForm({ step, values, errors, onChange }: {
  step: FormStep; values: Record<string, any>; errors: Record<string, string>; onChange: (id: string, value: any) => void;
}) {
  const visibleFields = step.fields.filter(f => f.enabled && isFieldVisible(f, values));
  const rows: FormField[][] = [];
  let i = 0;
  while (i < visibleFields.length) {
    const f = visibleFields[i];
    if (f.column === "half" && visibleFields[i + 1]?.column === "half") { rows.push([f, visibleFields[i + 1]]); i += 2; }
    else { rows.push([f]); i++; }
  }
  return (
    <div className="space-y-4">
      {rows.map((row, ri) => (
        <div key={ri} className={cn("flex gap-3", row.length === 2 ? "flex-row" : "flex-col")}>
          {row.map(field => (
            <div key={field.id} className="flex-1 flex flex-col gap-1.5">
              {field.type !== "checkbox" && (
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  {field.label}{field.required && <span className="text-red-500 text-xs">*</span>}
                </label>
              )}
              <FormInput field={field} value={values[field.id]} onChange={v => onChange(field.id, v)} error={errors[field.id]} />
              {errors[field.id] && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors[field.id]}</p>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Walkthrough Step ──────────────────────────────────────────────────────────
type WalkthroughPhoto = { localId: string; dataUrl: string; photoId?: string; uploading: boolean; error: boolean };
type WalkthroughResult = { walkthroughId: string; photoCount: number; durationSeconds: number; transcript: string };

function WalkthroughStep({ companyId, brandColor, onComplete, onSkip }: {
  companyId: string; brandColor: string; onComplete: (result: WalkthroughResult) => void; onSkip: () => void;
}) {
  const [phase, setPhase] = useState<"ask" | "capturing" | "review">("ask");
  const [walkthroughId, setWalkthroughId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<WalkthroughPhoto[]>([]);
  const [timer, setTimer] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [micDenied, setMicDenied] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const speechRef = useRef<any>(null);
  const photoIndexRef = useRef(0);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch {
      setCameraDenied(true);
    }
  }, []);

  const startMic = useCallback(async () => {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(micStream);
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start(1000);
      recorderRef.current = recorder;
      // Web Speech API for live transcript
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const speech = new SpeechRecognition();
        speech.continuous = true; speech.interimResults = false; speech.lang = "en-US";
        speech.onresult = (e: any) => {
          const chunk = Array.from(e.results).slice(e.resultIndex).map((r: any) => r[0].transcript).join(" ");
          setTranscript(prev => prev ? prev + " " + chunk : chunk);
        };
        speech.start();
        speechRef.current = speech;
      }
    } catch {
      setMicDenied(true);
    }
  }, []);

  const stopMic = useCallback(() => {
    try { recorderRef.current?.stop(); } catch {}
    try { recorderRef.current?.stream?.getTracks().forEach(t => t.stop()); } catch {}
    try { speechRef.current?.stop(); } catch {}
    recorderRef.current = null; speechRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    streamRef.current = null;
  }, []);

  const startWalkthrough = async () => {
    if (!consentChecked) return;
    try {
      const r = await fetch("/api/public/walkthrough/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await r.json();
      setWalkthroughId(data.walkthroughId);
    } catch {}
    photoIndexRef.current = 0;
    await startCamera();
    if (micOn) await startMic();
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    setPhase("capturing");
  };

  const takePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !walkthroughId) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const localId = `photo_${Date.now()}`;
    const orderIndex = photoIndexRef.current++;
    const newPhoto: WalkthroughPhoto = { localId, dataUrl, uploading: true, error: false };
    setPhotos(prev => [...prev, newPhoto]);
    // Upload to backend
    try {
      const r = await fetch(`/api/public/walkthrough/${walkthroughId}/photo`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: dataUrl, orderIndex, timestampSeconds: timer }),
      });
      const result = await r.json();
      setPhotos(prev => prev.map(p => p.localId === localId ? { ...p, photoId: result.photoId, uploading: false } : p));
    } catch {
      setPhotos(prev => prev.map(p => p.localId === localId ? { ...p, uploading: false, error: true } : p));
    }
  }, [walkthroughId, timer]);

  // Handle file input fallback (when camera denied)
  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!walkthroughId) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        if (!dataUrl) return;
        const localId = `photo_${Date.now()}_${Math.random()}`;
        const orderIndex = photoIndexRef.current++;
        setPhotos(prev => [...prev, { localId, dataUrl, uploading: true, error: false }]);
        try {
          const r = await fetch(`/api/public/walkthrough/${walkthroughId}/photo`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileUrl: dataUrl, orderIndex, timestampSeconds: timer }),
          });
          const result = await r.json();
          setPhotos(prev => prev.map(p => p.localId === localId ? { ...p, photoId: result.photoId, uploading: false } : p));
        } catch {
          setPhotos(prev => prev.map(p => p.localId === localId ? { ...p, uploading: false, error: true } : p));
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }, [walkthroughId, timer]);

  const toggleMic = async () => {
    if (micOn) { stopMic(); setMicOn(false); }
    else { await startMic(); setMicOn(true); }
  };

  const stopWalkthrough = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    stopCamera();
    // Get audio blob
    let audioUrl: string | null = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      await new Promise<void>(resolve => {
        recorderRef.current!.onstop = resolve;
        recorderRef.current!.stop();
        recorderRef.current!.stream?.getTracks().forEach(t => t.stop());
      });
      if (audioChunksRef.current.length > 0) {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size < 10 * 1024 * 1024) { // 10MB limit for audio
          audioUrl = await new Promise(resolve => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.readAsDataURL(blob);
          });
        }
      }
    } else {
      stopMic();
    }
    // Send stop to backend
    if (walkthroughId) {
      await fetch(`/api/public/walkthrough/${walkthroughId}/stop`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl, durationSeconds: timer, transcript: transcript || null }),
      }).catch(() => {});
    }
    setPhase("review");
  };

  const removePhoto = async (photo: WalkthroughPhoto) => {
    if (photo.photoId && walkthroughId) {
      await fetch(`/api/public/walkthrough/${walkthroughId}/photo/${photo.photoId}`, { method: "DELETE" }).catch(() => {});
    }
    setPhotos(prev => prev.filter(p => p.localId !== photo.localId));
  };

  const handleContinue = () => {
    onComplete({
      walkthroughId: walkthroughId!,
      photoCount: photos.filter(p => p.photoId).length,
      durationSeconds: timer,
      transcript,
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopCamera();
      stopMic();
    };
  }, [stopCamera, stopMic]);

  // ── Phase: Ask ────────────────────────────────────────────────────────────
  if (phase === "ask") {
    return (
      <div className="space-y-5">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: `${brandColor}15` }}>
            <Video className="w-8 h-8" style={{ color: brandColor }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Quick Walkthrough</h2>
          <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
            Photos and voice notes help us understand the condition of the space and provide a more accurate quote.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800 leading-relaxed">
          <strong>Privacy Notice:</strong> Only upload photos and voice notes you want to share with the cleaning company. Do not include private documents, passwords, payment cards, or personal items you do not want reviewed.
        </div>

        <label data-testid="checkbox-walkthrough-consent" className="flex items-start gap-3 cursor-pointer">
          <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
            consentChecked ? "border-indigo-500 bg-indigo-500" : "border-gray-300")}>
            {consentChecked && <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <input type="checkbox" checked={consentChecked} onChange={e => setConsentChecked(e.target.checked)} className="sr-only" />
          <span className="text-sm text-gray-600">I agree to share these photos and voice notes with the cleaning company for quote review.</span>
        </label>

        <div className="flex flex-col gap-3">
          <button data-testid="button-start-walkthrough"
            disabled={!consentChecked}
            onClick={startWalkthrough}
            className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: brandColor }}>
            <Camera className="w-4 h-4" /> Yes, Start Walkthrough
          </button>
          <button data-testid="button-skip-walkthrough" onClick={onSkip}
            className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
            <SkipForward className="w-4 h-4" /> Skip This Step
          </button>
        </div>
      </div>
    );
  }

  // ── Phase: Capturing ──────────────────────────────────────────────────────
  if (phase === "capturing") {
    return (
      <div className="space-y-4">
        {/* Timer */}
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-gray-900">{formatTime(timer)}</div>
          <p className="text-xs text-gray-400 mt-1">Walk through your space and take photos of the areas you want cleaned.</p>
        </div>

        {/* Camera preview or file input fallback */}
        {cameraDenied ? (
          <div className="rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 p-6 text-center space-y-3">
            <Camera className="w-10 h-10 text-gray-400 mx-auto" />
            <p className="text-sm text-gray-500">Camera access is off. You can upload photos manually.</p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer" style={{ background: brandColor }}>
              <Images className="w-4 h-4" /> Add Photos
              <input type="file" accept="image/*" multiple capture="environment" className="sr-only" onChange={handleFileInput} />
            </label>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
            <canvas ref={canvasRef} className="hidden" />
            {/* Capture button overlay */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <button data-testid="button-take-photo" onClick={takePhoto}
                disabled={photos.length >= 40}
                className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center shadow-lg hover:scale-105 transition-transform disabled:opacity-50">
                <div className="w-10 h-10 rounded-full" style={{ background: brandColor }} />
              </button>
            </div>
          </div>
        )}

        {/* Instruction text */}
        <p className="text-xs text-center text-gray-400">
          You can talk while taking photos. {micDenied ? "Microphone is off — you can still take photos." : ""}
        </p>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3">
          <button data-testid="button-toggle-mic" onClick={toggleMic}
            className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors",
              micOn && !micDenied ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-500")}>
            {micOn && !micDenied ? <><Mic className="w-4 h-4" /> Mic On</> : <><MicOff className="w-4 h-4" /> Mic Off</>}
          </button>

          {cameraDenied && (
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer" style={{ background: brandColor }}>
              <Camera className="w-4 h-4" /> Take Photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFileInput} />
            </label>
          )}

          <button data-testid="button-stop-walkthrough" onClick={stopWalkthrough}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ background: "#ef4444" }}>
            <Square className="w-4 h-4" /> Stop
          </button>
        </div>

        {/* Photo count and thumbnails */}
        {photos.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">{photos.length} photo{photos.length !== 1 ? "s" : ""} captured</p>
            <div className="flex gap-2 flex-wrap">
              {photos.slice(-8).map(photo => (
                <div key={photo.localId} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
                  <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
                  {photo.uploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-4 h-4 text-white animate-spin" /></div>}
                  {photo.error && <div className="absolute inset-0 bg-red-400/40 flex items-center justify-center"><AlertCircle className="w-4 h-4 text-white" /></div>}
                </div>
              ))}
              {photos.length > 8 && <div className="w-14 h-14 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">+{photos.length - 8}</div>}
            </div>
          </div>
        )}

        {photos.length >= 40 && (
          <p className="text-xs text-amber-600 text-center">You have reached the maximum number of photos (40).</p>
        )}
      </div>
    );
  }

  // ── Phase: Review ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewPhoto(null)}>
          <img src={previewPhoto} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${brandColor}15` }}>
          <Images className="w-5 h-5" style={{ color: brandColor }} />
        </div>
        <div>
          <p className="font-semibold text-gray-900">Walkthrough Complete</p>
          <p className="text-xs text-gray-500">{formatTime(timer)} recorded · {photos.filter(p => p.photoId).length} photos captured</p>
        </div>
      </div>

      {transcript && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
          <p className="text-xs font-medium text-blue-700 mb-1">Voice notes transcript</p>
          <p className="text-xs text-blue-800 leading-relaxed">{transcript}</p>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-6 text-center">
          <p className="text-sm text-gray-400">No photos were captured.</p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Review your photos — tap to preview, remove unwanted ones</p>
          <div className="grid grid-cols-4 gap-2">
            {photos.map(photo => (
              <div key={photo.localId} className="relative group rounded-lg overflow-hidden aspect-square border border-gray-200">
                <img src={photo.dataUrl} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewPhoto(photo.dataUrl)} data-testid={`img-walkthrough-${photo.localId}`} />
                {photo.uploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-4 h-4 text-white animate-spin" /></div>}
                {photo.error && <div className="absolute inset-0 bg-red-400/40 flex items-center justify-center text-center p-1"><p className="text-[10px] text-white">Upload failed</p></div>}
                <button data-testid={`button-remove-photo-${photo.localId}`}
                  onClick={() => removePhoto(photo)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white items-center justify-center hidden group-hover:flex opacity-90">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button data-testid="button-walkthrough-continue" onClick={handleContinue}
        disabled={photos.some(p => p.uploading) || uploadingPhotos}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: brandColor }}>
        {(photos.some(p => p.uploading) || uploadingPhotos) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Continue <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function PublicQuoteForm() {
  const [, params] = useRoute("/form/:companyId/:slug");
  const search = useSearch();
  const companyId = params?.companyId ?? "";
  const slug = params?.slug ?? "";
  const isEmbed = new URLSearchParams(search).get("embed") === "true";

  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [walkthroughResult, setWalkthroughResult] = useState<WalkthroughResult | null>(null);

  const handleReset = () => {
    setSubmitted(false); setCurrentStep(0); setFormValues({}); setErrors({}); setWalkthroughResult(null);
  };

  const { data: formData, isLoading, error: loadError } = useQuery<FormData>({
    queryKey: ["/api/public/forms", companyId, slug],
    queryFn: () => fetch(`/api/public/forms/${companyId}/${slug}`).then(r => {
      if (!r.ok) throw new Error("Form not found");
      return r.json();
    }),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const visibleData: Record<string, any> = {};
      formData?.config.steps.forEach(step => {
        step.fields.forEach(field => {
          if (field.enabled && isFieldVisible(field, formValues) && formValues[field.id] !== undefined) {
            visibleData[field.id] = formValues[field.id];
          }
        });
      });
      const r = await fetch(`/api/public/forms/${companyId}/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visibleData),
      });
      return r.json();
    },
    onSuccess: async (data) => {
      // Link walkthrough to submission if exists
      if (walkthroughResult?.walkthroughId && data?.id) {
        await fetch(`/api/public/walkthrough/${walkthroughResult.walkthroughId}/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId: data.id }),
        }).catch(() => {});
      }
      setSubmitted(true);
    },
  });

  const brandColor = formData?.brandColor || "#6366f1";

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center", isEmbed ? "py-16" : "min-h-screen bg-gray-50")}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-gray-500">Loading form…</p>
        </div>
      </div>
    );
  }

  if (loadError || !formData) {
    return (
      <div className={cn("flex items-center justify-center p-4", isEmbed ? "py-16" : "min-h-screen bg-gray-50")}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Form Not Found</h2>
          <p className="text-gray-500 text-sm">This form may have been removed or deactivated.</p>
        </div>
      </div>
    );
  }

  const enabledSteps = formData.config.steps.filter(s => s.enabled);
  // Total steps = configured steps + walkthrough step
  const totalSteps = enabledSteps.length + 1;
  const walkthroughStepIndex = enabledSteps.length;
  const isOnWalkthroughStep = currentStep === walkthroughStepIndex;
  const isOnConfiguredStep = currentStep < enabledSteps.length;
  const step = isOnConfiguredStep ? enabledSteps[currentStep] : null;

  const validateStep = () => {
    if (!step) return true;
    const newErrors: Record<string, string> = {};
    step.fields.filter(f => f.enabled && f.required && isFieldVisible(f, formValues)).forEach(f => {
      const v = formValues[f.id];
      if (!v || (typeof v === "string" && !v.trim())) { newErrors[f.id] = `${f.label} is required`; }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    // Move to walkthrough step if on last configured step
    if (currentStep === enabledSteps.length - 1) {
      setCurrentStep(walkthroughStepIndex);
      if (!isEmbed) window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (isOnConfiguredStep) {
      setCurrentStep(prev => prev + 1);
      if (!isEmbed) window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep(prev => prev - 1);
    if (!isEmbed) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className={cn("flex flex-col", isEmbed ? "bg-transparent" : "min-h-screen bg-gradient-to-b from-gray-50 to-white")}>
        {!isEmbed && (
          <header className="pt-10 pb-6 text-center px-4">
            {formData.companyLogo ? (
              <img src={formData.companyLogo} alt={formData.companyName} className="h-12 w-auto mx-auto mb-3 object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: brandColor }}>
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
            )}
            <h1 className="text-base font-semibold text-gray-900">{formData.companyName}</h1>
          </header>
        )}
        <main className={cn("flex items-center justify-center px-4", isEmbed ? "py-12" : "flex-1 pb-16")}>
          <div className="w-full max-w-md text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: `${brandColor}15` }}>
              <CheckCircle2 className="w-10 h-10" style={{ color: brandColor }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Request Submitted!</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Thank you for reaching out. We've received your request{walkthroughResult ? " and walkthrough photos" : ""} and will be in touch shortly.
            </p>
            <button onClick={handleReset} className="px-6 py-3 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ background: brandColor }} data-testid="button-submit-another">
              Submit Another Request
            </button>
          </div>
        </main>
        {isEmbed ? (
          <div className="mt-4 pb-4 text-center text-xs text-gray-500">
            Created using{" "}
            <a href="https://clockfield.com" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-700 hover:text-gray-900 underline underline-offset-2">Clockfield</a>
          </div>
        ) : (
          <footer className="py-5 text-center">
            <p className="text-xs text-gray-400">Powered by <span className="font-medium">Clockfield</span></p>
          </footer>
        )}
      </div>
    );
  }

  const propertyType = formValues.propertyType;
  const isResidential = propertyType === "Residential";
  const isCommercial = propertyType === "Commercial";

  return (
    <div className={cn("flex flex-col", isEmbed ? "bg-transparent" : "min-h-screen bg-gradient-to-b from-gray-50 to-white")}>
      {/* Branding header */}
      {!isEmbed && (
        <header className="pt-8 pb-4 text-center px-4">
          {formData.companyLogo ? (
            <img src={formData.companyLogo} alt={formData.companyName} className="h-12 w-auto mx-auto mb-3 object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: brandColor }}>
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
          )}
          <h1 className="text-base font-semibold text-gray-900">{formData.companyName}</h1>
          <div className="mt-4 h-px bg-gray-100 max-w-md mx-auto" />
        </header>
      )}

      {/* Progress bar — totalSteps includes walkthrough */}
      <div className={cn("px-4 max-w-lg mx-auto w-full", isEmbed ? "pt-4 pb-2" : "py-3")}>
        <div className="flex gap-1.5 mb-2">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div key={idx} className="flex-1 h-1.5 rounded-full transition-all duration-500"
              style={{ background: idx <= currentStep ? brandColor : "#e5e7eb", opacity: idx < currentStep ? 0.5 : 1 }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-gray-400">Step {currentStep + 1} of {totalSteps}</p>
          {propertyType && (
            <span className={cn("flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
              isResidential ? "bg-green-50 text-green-700 border border-green-200" : "bg-blue-50 text-blue-700 border border-blue-200")}>
              {isResidential ? <Home className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
              {propertyType}
            </span>
          )}
        </div>
      </div>

      {/* Main form card */}
      <main className={cn("px-4", isEmbed ? "pb-4" : "flex-1 pb-6")}>
        <div className="max-w-lg mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">

            {/* Walkthrough step */}
            {isOnWalkthroughStep ? (
              <WalkthroughStep
                companyId={companyId}
                brandColor={brandColor}
                onComplete={(result) => {
                  setWalkthroughResult(result);
                  submitMutation.mutate();
                }}
                onSkip={() => submitMutation.mutate()}
              />
            ) : step ? (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
                  {propertyType && step.fields.some(f => f.visibilityRule && f.visibilityRule !== "always") && (
                    <p className="text-sm text-gray-400 mt-1">{isResidential ? "Showing residential fields" : "Showing commercial fields"}</p>
                  )}
                </div>
                <StepForm step={step} values={formValues} errors={errors}
                  onChange={(id, value) => {
                    setFormValues(prev => {
                      const next = { ...prev, [id]: value };
                      if (id === "propertyType") setErrors({});
                      return next;
                    });
                    if (errors[id]) setErrors(prev => { const e = { ...prev }; delete e[id]; return e; });
                  }}
                />
                {/* Navigation */}
                <div className={cn("flex gap-3 mt-8", currentStep > 0 ? "justify-between" : "justify-end")}>
                  {currentStep > 0 && (
                    <button data-testid="button-form-back" onClick={handleBack}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                  )}
                  <button data-testid="button-form-next" onClick={handleNext}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 min-w-[140px] justify-center"
                    style={{ background: brandColor }}>
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : null}

            {/* Submission pending spinner (shown on walkthrough skip/after walkthrough complete) */}
            {submitMutation.isPending && (
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Submitting your request…
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      {isEmbed ? (
        <div className="mt-4 pb-4 text-center text-xs text-gray-500">
          Created using{" "}
          <a href="https://clockfield.com" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-700 hover:text-gray-900 underline underline-offset-2">Clockfield</a>
        </div>
      ) : (
        <footer className="py-5 text-center">
          <p className="text-xs text-gray-400">Powered by <span className="font-medium">Clockfield</span></p>
        </footer>
      )}
    </div>
  );
}
