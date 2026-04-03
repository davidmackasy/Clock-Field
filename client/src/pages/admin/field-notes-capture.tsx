import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Camera, Mic, MicOff, Square, ChevronLeft,
  Loader2, AlertCircle, CheckCircle2, Images
} from "lucide-react";

function compressImage(dataUrl: string, maxW = 1200, quality = 0.82): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function FieldNotesCapture() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const sessionId = search.get("sessionId");
  const returnPath = search.get("return") ?? "/admin/field-notes";

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [photos, setPhotos] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [interimText, setInterimText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState("");
  const [stopping, setStopping] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);

  const { data: session } = useQuery<any>({
    queryKey: ["/api/field-notes/sessions", sessionId],
    queryFn: () => apiRequest("GET", `/api/field-notes/sessions/${sessionId}`).then(r => r.json()),
    enabled: !!sessionId,
  });

  const photoMutation = useMutation({
    mutationFn: (fileUrl: string) =>
      apiRequest("POST", `/api/field-notes/sessions/${sessionId}/photo`, {
        fileUrl,
        sequenceIndex: photoCount,
      }).then(r => r.json()),
  });

  const transcriptMutation = useMutation({
    mutationFn: (rawText: string) =>
      apiRequest("POST", `/api/field-notes/sessions/${sessionId}/transcript`, {
        rawText,
        chunkIndex: transcript.length,
        startedAt: new Date().toISOString(),
      }).then(r => r.json()),
  });

  const stopMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/field-notes/sessions/${sessionId}/stop`).then(r => r.json()),
    onSuccess: () => {
      navigate(`/admin/field-notes/session/${sessionId}`);
    },
    onError: () => toast({ title: "Failed to stop session", variant: "destructive" }),
  });

  // Start camera
  useEffect(() => {
    if (!sessionId) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraReady(true);
        }
      })
      .catch(err => {
        setCameraError("Camera not available: " + err.message);
      });
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    };
  }, [sessionId]);

  // Toggle microphone / SpeechRecognition
  const toggleMic = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      setMicError("Voice recognition not supported in this browser.");
      return;
    }
    if (micActive) {
      recognitionRef.current?.stop();
      setMicActive(false);
      return;
    }
    setMicError("");
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      if (final.trim()) {
        setTranscript(prev => [...prev, final.trim()]);
        setInterimText("");
        transcriptMutation.mutate(final.trim());
      } else {
        setInterimText(interim);
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === "no-speech") return;
      setMicError("Mic error: " + e.error);
      setMicActive(false);
    };
    rec.onend = () => {
      if (micActive) { try { rec.start(); } catch {} }
    };
    recognitionRef.current = rec;
    rec.start();
    setMicActive(true);
  }, [micActive, transcript.length]);

  // Capture photo
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const raw = c.toDataURL("image/jpeg", 0.95);
    const compressed = await compressImage(raw);
    setPhotos(prev => [...prev, compressed]);
    setPhotoCount(prev => prev + 1);
    photoMutation.mutate(compressed);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const stopSession = async () => {
    setStopping(true);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    // Flush interim text if any
    if (interimText.trim()) {
      await transcriptMutation.mutateAsync(interimText.trim()).catch(() => {});
    }
    stopMutation.mutate();
  };

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-2" />
          <p className="font-medium">No session ID provided</p>
          <Button className="mt-3" onClick={() => navigate("/admin/field-notes")}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 z-10">
        <button
          data-testid="button-back-capture"
          className="flex items-center gap-1 text-white/80 hover:text-white text-sm"
          onClick={() => navigate(returnPath)}
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <span className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            stopping ? "bg-yellow-400" : "bg-red-500"
          )} />
          <span className="text-sm font-mono font-semibold">{formatTime(elapsed)}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-white/70">
          <Images className="w-3.5 h-3.5" />
          <span>{photos.length} photos</span>
        </div>
      </div>

      {/* Viewfinder */}
      <div className="flex-1 relative bg-black">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
            <AlertCircle className="w-10 h-10 text-yellow-400" />
            <p className="text-sm text-white/80">{cameraError}</p>
            <p className="text-xs text-white/50">You can still use the microphone to record notes</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />
          </>
        )}

        {/* Transcript overlay */}
        {(transcript.length > 0 || interimText) && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur rounded-xl p-3 max-h-28 overflow-y-auto">
            <p className="text-xs text-white/90 leading-relaxed">
              {transcript.slice(-3).join(" ")}
              {interimText && <span className="text-white/50"> {interimText}</span>}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black px-6 pb-8 pt-4">
        {micError && (
          <p className="text-xs text-red-400 text-center mb-2">{micError}</p>
        )}

        {/* Photo filmstrip */}
        {photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto mb-4 pb-1">
            {photos.slice(-6).map((p, i) => (
              <img
                key={i}
                src={p}
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-white/20"
                alt={`Photo ${i + 1}`}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          {/* Mic toggle */}
          <button
            data-testid="button-toggle-mic"
            onClick={toggleMic}
            disabled={stopping}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center transition-all",
              micActive
                ? "bg-blue-500 shadow-[0_0_16px_4px_rgba(59,130,246,0.4)]"
                : "bg-white/10 hover:bg-white/20"
            )}
          >
            {micActive ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6 text-white/60" />}
          </button>

          {/* Shutter */}
          <button
            data-testid="button-capture-photo"
            onClick={capturePhoto}
            disabled={!cameraReady || stopping}
            className="w-20 h-20 rounded-full border-4 border-white bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all disabled:opacity-40"
          >
            <div className="w-14 h-14 rounded-full bg-white" />
          </button>

          {/* Stop */}
          <button
            data-testid="button-stop-session"
            onClick={stopSession}
            disabled={stopping}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all disabled:opacity-60"
          >
            {stopping ? <Loader2 className="w-6 h-6 animate-spin" /> : <Square className="w-5 h-5 fill-white" />}
          </button>
        </div>

        <p className="text-center text-xs text-white/40 mt-3">
          {cameraReady ? "Tap the white button to take a photo" : "Camera unavailable — tap mic to record voice notes"}
        </p>
      </div>
    </div>
  );
}
