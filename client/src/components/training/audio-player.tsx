import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Volume2, AlertCircle } from "lucide-react";

type Props = {
  text: string;
  title?: string;
};

const SPEEDS: { label: string; value: number }[] = [
  { label: "0.75×", value: 0.75 },
  { label: "1×", value: 1 },
  { label: "1.25×", value: 1.25 },
  { label: "1.5×", value: 1.5 },
];

export function AudioPlayer({ text, title }: Props) {
  const [supported, setSupported] = useState(true);
  const [stage, setStage] = useState<"idle" | "playing" | "paused">("idle");
  const [rate, setRate] = useState(1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
    }
  }, []);

  // Cancel speech on unmount or text change
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setStage("idle");
      utteranceRef.current = null;
    }
  }, [text]);

  if (!supported) return null;

  const buildUtterance = () => {
    const fullText = title ? `${title}. ${text}` : text;
    const u = new SpeechSynthesisUtterance(fullText);
    u.rate = rate;
    u.onend = () => setStage("idle");
    u.onerror = () => setStage("idle");
    return u;
  };

  const handlePlay = () => {
    if (stage === "paused") {
      window.speechSynthesis.resume();
      setStage("playing");
      return;
    }
    window.speechSynthesis.cancel();
    const u = buildUtterance();
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
    setStage("playing");
  };

  const handlePause = () => {
    window.speechSynthesis.pause();
    setStage("paused");
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setStage("idle");
  };

  const handleSpeedChange = (newRate: number) => {
    setRate(newRate);
    // If currently playing, restart with new rate
    if (stage === "playing" || stage === "paused") {
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

  if (!text || !text.trim()) return null;

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/20" data-testid="audio-player">
      <div className="flex items-center gap-2 mb-2">
        <Volume2 className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Listen to this module</span>
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
      {stage === "playing" && (
        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Playing audio…
        </div>
      )}
      <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Uses your browser's text-to-speech voice.
      </div>
    </div>
  );
}
