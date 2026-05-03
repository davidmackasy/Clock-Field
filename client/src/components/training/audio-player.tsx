import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Volume2, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type Props = {
  text: string;
  title?: string;
  // When provided, the player can fetch a premium OpenAI TTS audio URL from
  // the server (cached per module-content-hash). Falls back to the browser's
  // SpeechSynthesis API if the server can't generate audio (e.g. no API key).
  moduleId?: string;
  publicId?: string; // for public learners
};

const SPEEDS: { label: string; value: number }[] = [
  { label: "0.75×", value: 0.75 },
  { label: "1×", value: 1 },
  { label: "1.25×", value: 1.25 },
  { label: "1.5×", value: 1.5 },
];

export function AudioPlayer({ text, title, moduleId, publicId }: Props) {
  const [supported, setSupported] = useState(true);
  const [stage, setStage] = useState<"idle" | "playing" | "paused">("idle");
  const [rate, setRate] = useState(1);
  const [premiumUrl, setPremiumUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [premiumError, setPremiumError] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const browserTtsAvailable = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!browserTtsAvailable) setSupported(false);
  }, [browserTtsAvailable]);

  // Cancel speech and reset cached audio when text changes
  useEffect(() => {
    if (browserTtsAvailable) window.speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setStage("idle");
    setPremiumUrl(null);
    setPremiumError(null);
    utteranceRef.current = null;
  }, [text, moduleId, browserTtsAvailable]);

  useEffect(() => {
    return () => {
      if (browserTtsAvailable) window.speechSynthesis.cancel();
      if (audioRef.current) audioRef.current.pause();
    };
  }, [browserTtsAvailable]);

  if (!text || !text.trim()) return null;

  const handleGeneratePremium = async () => {
    if (!moduleId && !publicId) return;
    setGenerating(true);
    setPremiumError(null);
    try {
      const path = publicId
        ? `/api/public/training/${publicId}/modules/${moduleId}/audio`
        : `/api/training/modules/${moduleId}/audio`;
      const res = await apiRequest("POST", path, {});
      const data = await res.json();
      if (data?.audioData) {
        setPremiumUrl(data.audioData);
      } else {
        throw new Error(data?.message || "No audio returned");
      }
    } catch (e: any) {
      setPremiumError(e?.message || "Premium audio unavailable; using browser voice.");
    } finally {
      setGenerating(false);
    }
  };

  const playPremium = () => {
    if (!audioRef.current || !premiumUrl) return;
    audioRef.current.playbackRate = rate;
    audioRef.current.play();
    setStage("playing");
  };
  const pausePremium = () => { audioRef.current?.pause(); setStage("paused"); };
  const stopPremium = () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } setStage("idle"); };

  const buildUtterance = () => {
    const fullText = title ? `${title}. ${text}` : text;
    const u = new SpeechSynthesisUtterance(fullText);
    u.rate = rate;
    u.onend = () => setStage("idle");
    u.onerror = () => setStage("idle");
    return u;
  };

  const playBrowser = () => {
    if (!browserTtsAvailable) return;
    if (stage === "paused") { window.speechSynthesis.resume(); setStage("playing"); return; }
    window.speechSynthesis.cancel();
    const u = buildUtterance();
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
    setStage("playing");
  };
  const pauseBrowser = () => { if (browserTtsAvailable) { window.speechSynthesis.pause(); setStage("paused"); } };
  const stopBrowser = () => { if (browserTtsAvailable) { window.speechSynthesis.cancel(); } setStage("idle"); };

  const usingPremium = !!premiumUrl;
  const handlePlay = usingPremium ? playPremium : playBrowser;
  const handlePause = usingPremium ? pausePremium : pauseBrowser;
  const handleStop = usingPremium ? stopPremium : stopBrowser;

  const handleSpeedChange = (newRate: number) => {
    setRate(newRate);
    if (usingPremium && audioRef.current) {
      audioRef.current.playbackRate = newRate;
      return;
    }
    if (browserTtsAvailable && (stage === "playing" || stage === "paused")) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(title ? `${title}. ${text}` : text);
      u.rate = newRate;
      u.onend = () => setStage("idle");
      u.onerror = () => setStage("idle");
      utteranceRef.current = u;
      window.speechSynthesis.speak(u);
      setStage("playing");
    }
  };

  if (!supported && !moduleId && !publicId) return null;

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/20" data-testid="audio-player">
      <div className="flex items-center gap-2 mb-2">
        <Volume2 className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Listen to this module</span>
        {usingPremium && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 px-1.5 py-0.5 rounded flex items-center gap-1" data-testid="badge-premium-audio">
            <Sparkles className="w-2.5 h-2.5" />Premium
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {stage !== "playing" ? (
          <Button size="sm" onClick={handlePlay} data-testid="btn-audio-play">
            <Play className="w-3.5 h-3.5 mr-1" />
            {stage === "paused" ? "Resume" : "Play"}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={handlePause} data-testid="btn-audio-pause">
            <Pause className="w-3.5 h-3.5 mr-1" />Pause
          </Button>
        )}
        {stage !== "idle" && (
          <Button size="sm" variant="outline" onClick={handleStop} data-testid="btn-audio-stop">
            <Square className="w-3.5 h-3.5 mr-1" />Stop
          </Button>
        )}
        {(moduleId || publicId) && !usingPremium && (
          <Button size="sm" variant="outline" onClick={handleGeneratePremium} disabled={generating} data-testid="btn-audio-premium">
            {generating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
            {generating ? "Generating…" : "Premium Voice"}
          </Button>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-muted-foreground mr-1">Speed:</span>
          {SPEEDS.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => handleSpeedChange(s.value)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                rate === s.value
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
              data-testid={`btn-audio-speed-${s.value}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {premiumUrl && (
        <audio
          ref={audioRef}
          src={premiumUrl}
          onEnded={() => setStage("idle")}
          onPause={() => setStage(s => s === "playing" ? "paused" : s)}
          className="hidden"
        />
      )}
      {stage === "playing" && (
        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Playing audio…
        </div>
      )}
      {premiumError && (
        <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />{premiumError}
        </div>
      )}
      <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {usingPremium ? "Using premium AI voice." : "Uses your browser's text-to-speech voice. Click Premium for higher-quality audio."}
      </div>
    </div>
  );
}
