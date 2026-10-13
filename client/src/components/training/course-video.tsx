import { recordWatch, watchedSeconds, type WatchedRange } from "@shared/training-watch";
import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";

type Watch = { watchedSeconds: number; duration: number };
let apiPromise: Promise<any> | undefined;
function youtubeApi(): Promise<any> {
  if ((window as any).YT?.Player) return Promise.resolve((window as any).YT);
  return apiPromise ||= new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { apiPromise = undefined; reject(new Error("Video player timed out")); }, 20000);
    const prior = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => { clearTimeout(timeout); prior?.(); resolve((window as any).YT); };
    const script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => { clearTimeout(timeout); apiPromise = undefined; reject(new Error("Video player could not load")); };
    document.head.appendChild(script);
  });
}

export function CourseVideo({ videoId, title, onWatch }: { videoId: string; title: string; onWatch: (watch: Watch) => void }) {
  const host = useRef<HTMLDivElement>(null), report = useRef(onWatch);
  report.current = onWatch;
  const [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false, player: any, timer: ReturnType<typeof setInterval> | undefined;
    let previous: number | undefined;
    let ranges: WatchedRange[] = [];
    const sample = () => {
      const at=Number(player?.getCurrentTime?.() || 0), duration=Number(player?.getDuration?.() || 0);
      if (previous !== undefined && document.visibilityState === "visible") ranges=recordWatch(ranges,previous,at,duration);
      previous=at;
      if(duration>0)report.current({watchedSeconds:watchedSeconds(ranges),duration});
    };
    setError(false);
    youtubeApi().then(YT => {
      if (disposed || !host.current) return;
      const node = document.createElement("div"); host.current.replaceChildren(node);
      player = new YT.Player(node, {
        host: "https://www.youtube-nocookie.com", videoId, width: "100%", height: "100%",
        playerVars: { playsinline: 1, origin: window.location.origin, rel: 0 },
        events: {
          onReady: () => { player.getIframe().title = title; }, onError: () => setError(true),
          onStateChange: (event: any) => {
            if (event.data === 1) previous=Number(event.target.getCurrentTime());
            else { sample(); previous=undefined; }
          },
        },
      });
      timer = setInterval(() => {
        if (player.getPlayerState?.() === 1 && document.visibilityState === "visible") sample();
        else previous=undefined;
      }, 1000);
    }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; if (timer) clearInterval(timer); player?.destroy?.(); };
  }, [videoId, title]);
  return <div>
    <div ref={host} className="aspect-video min-h-[200px] w-full overflow-hidden bg-black [&_iframe]:h-full [&_iframe]:w-full" data-testid="course-video" />
    {error && <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />This video is unavailable. Contact your manager to update the lesson video.</p>}
  </div>;
}
