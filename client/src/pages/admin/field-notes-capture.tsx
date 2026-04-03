import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MicOff, Square, ChevronLeft, Loader2, AlertCircle, Images, Mic } from "lucide-react";

function compressImage(dataUrl: string, maxW = 1200, quality = 0.82): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

declare global {
  interface Window { SpeechRecognition: any; webkitSpeechRecognition: any; }
}

export default function FieldNotesCapture() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("sessionId");
  const returnPath = params.get("return") ?? "/admin/field-notes";

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkStartRef = useRef<string>(new Date().toISOString());
  const chunkIndexRef = useRef(0);

  const [photos, setPhotos] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [interimText, setInterimText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState("");
  const [stopping, setStopping] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const photoCountRef = useRef(0);

  const photoMutation = useMutation({
    mutationFn: ({ fileUrl, capturedAt }: { fileUrl: string; capturedAt: string }) =>
      apiRequest("POST", `/api/field-notes/sessions/${sessionId}/photo`, {
        fileUrl, capturedAt, sequenceIndex: photoCountRef.current,
      }).then(r => r.json()),
  });

  const transcriptMutation = useMutation({
    mutationFn: ({ rawText, startedAt, endedAt, chunkIndex }: any) =>
      apiRequest("POST", `/api/field-notes/sessions/${sessionId}/transcript`, {
        rawText, startedAt, endedAt, chunkIndex,
      }).then(r => r.json()),
  });

  const stopMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/field-notes/sessions/${sessionId}/stop`).then(r => r.json()),
    onSuccess: () => navigate(`${returnPath}/session/${sessionId}`),
    onError: () => toast({ title: "Failed to stop session", variant: "destructive" }),
  });

  useEffect(() => {
    if (!sessionId) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); setCameraReady(true); }
      }).catch(err => setCameraError(err.message));
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      try { recognitionRef.current?.stop(); } catch {}
    };
  }, [sessionId]);

  const flushTranscript = useCallback((text: string) => {
    if (!text.trim()) return;
    const endedAt = new Date().toISOString();
    transcriptMutation.mutate({
      rawText: text.trim(),
      startedAt: chunkStartRef.current,
      endedAt,
      chunkIndex: chunkIndexRef.current++,
    });
    chunkStartRef.current = new Date().toISOString();
  }, []);

  const toggleMic = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { setMicError("Voice recognition not supported in this browser."); return; }
    if (micActive) {
      try { recognitionRef.current?.stop(); } catch {}
      setMicActive(false);
      return;
    }
    setMicError("");
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    chunkStartRef.current = new Date().toISOString();
    rec.onresult = (e: any) => {
      let interim = ""; let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      if (final.trim()) { setTranscript(prev => [...prev, final.trim()]); setInterimText(""); flushTranscript(final.trim()); }
      else setInterimText(interim);
    };
    rec.onerror = (e: any) => { if (e.error !== "no-speech") { setMicError("Mic: " + e.error); setMicActive(false); } };
    rec.onend = () => { if (micActive) try { rec.start(); } catch {} };
    recognitionRef.current = rec;
    rec.start();
    setMicActive(true);
  }, [micActive, flushTranscript]);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || capturing) return;
    setCapturing(true);
    const capturedAt = new Date().toISOString();
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const raw = c.toDataURL("image/jpeg", 0.95);
    const compressed = await compressImage(raw);
    photoCountRef.current++;
    setPhotos(prev => [...prev, compressed]);
    photoMutation.mutate({ fileUrl: compressed, capturedAt });
    setCapturing(false);
  }, [capturing]);

  const stopSession = async () => {
    if (stopping) return;
    setStopping(true);
    try { recognitionRef.current?.stop(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    if (interimText.trim()) await transcriptMutation.mutateAsync({
      rawText: interimText.trim(),
      startedAt: chunkStartRef.current,
      endedAt: new Date().toISOString(),
      chunkIndex: chunkIndexRef.current++,
    }).catch(() => {});
    stopMutation.mutate();
  };

  const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");

  const navigateBack = () => {
    try { recognitionRef.current?.stop(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    navigate(returnPath);
  };

  if (!sessionId) return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <div className="text-center"><AlertCircle className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
        <p>No session ID</p><button onClick={() => navigate("/admin/field-notes")} className="mt-3 underline text-sm">Go Back</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col bg-black text-white overflow-hidden" style={{ height: "100dvh" }}>
      {/* ── Fixed top bar ── */}
      <div className="flex-none flex items-center justify-between px-4 py-3 bg-black/90 border-b border-white/10 z-20">
        <button data-testid="button-back-capture" onClick={navigateBack}
          className="flex items-center gap-1 text-white/70 hover:text-white text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", stopping ? "bg-yellow-500" : "bg-red-500 animate-pulse")} />
          <span className="font-mono text-sm font-semibold">{mm}:{ss}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-white/60">
          <Images className="w-3.5 h-3.5" />
          <span data-testid="text-photo-count">{photos.length}</span>
        </div>
      </div>

      {/* ── Camera viewfinder ── */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-8 bg-black">
            <AlertCircle className="w-12 h-12 text-yellow-400" />
            <p className="text-sm text-white/80">Camera unavailable</p>
            <p className="text-xs text-white/40">Use the mic to record voice notes</p>
          </div>
        ) : (
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />
        )}
        <canvas ref={canvasRef} className="hidden" />

        {/* last photo thumbnail — bottom-left of viewfinder */}
        {photos.length > 0 && (
          <div className="absolute bottom-2 left-2 w-16 h-16 rounded-lg overflow-hidden border-2 border-white/40">
            <img src={photos[photos.length - 1]} alt="last" className="w-full h-full object-cover" />
          </div>
        )}

        {/* live transcript overlay */}
        {(transcript.length > 0 || interimText) && (
          <div className="absolute bottom-2 right-2 left-20 bg-black/70 backdrop-blur rounded-lg p-2 max-h-24 overflow-y-auto">
            <p className="text-xs text-white/90 leading-relaxed">
              {transcript.slice(-2).join(" ")}
              {interimText && <span className="text-white/50"> {interimText}</span>}
            </p>
          </div>
        )}

        {/* Capture flash */}
        {capturing && <div className="absolute inset-0 bg-white/30 animate-ping" style={{ animationDuration: "0.15s", animationIterationCount: 1 }} />}
      </div>

      {/* ── Fixed bottom controls ── */}
      <div className="flex-none bg-black border-t border-white/10 px-4 pt-3 pb-6 z-20">
        {micError && <p className="text-xs text-red-400 text-center mb-2">{micError}</p>}

        {/* filmstrip */}
        {photos.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto mb-3 pb-0.5 scrollbar-none">
            {photos.slice(-8).map((p, i) => (
              <img key={i} src={p} className="w-12 h-12 rounded object-cover flex-shrink-0 border border-white/20" alt="" />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          {/* Mic */}
          <button
            data-testid="button-toggle-mic"
            onClick={toggleMic}
            disabled={stopping}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center transition-all flex-shrink-0",
              micActive ? "bg-blue-500 shadow-[0_0_20px_4px_rgba(59,130,246,0.5)]" : "bg-white/10 hover:bg-white/20"
            )}
          >
            {micActive ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6 text-white/50" />}
          </button>

          {/* Shutter */}
          <button
            data-testid="button-capture-photo"
            onClick={capturePhoto}
            disabled={(!cameraReady && !cameraError) || stopping || capturing}
            className={cn(
              "w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all flex-shrink-0",
              ((!cameraReady && !cameraError) || stopping || capturing) ? "opacity-40" : "active:scale-95"
            )}
          >
            <div className={cn("w-14 h-14 rounded-full", capturing ? "bg-white/60" : "bg-white")} />
          </button>

          {/* Stop */}
          <button
            data-testid="button-stop-session"
            onClick={stopSession}
            disabled={stopping}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-60"
          >
            {stopping ? <Loader2 className="w-6 h-6 animate-spin" /> : <Square className="w-5 h-5 fill-white" />}
          </button>
        </div>

        <p className="text-center text-[11px] text-white/30 mt-2">
          {micActive ? "Mic on — speaking..." : "Tap mic to record voice"} · Tap circle to take photo · Tap square to stop
        </p>
      </div>
    </div>
  );
}
