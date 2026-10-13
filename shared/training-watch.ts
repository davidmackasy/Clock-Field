export type WatchedRange = [number, number];
/** Merge continuous playback ranges; replayed or skipped time earns no extra credit. */
export function recordWatch(ranges: WatchedRange[], from: number, to: number, duration: number): WatchedRange[] {
  if (![from,to,duration].every(Number.isFinite) || duration <= 0 || to <= from || to - from > 3) return ranges;
  const start=Math.max(0,from), end=Math.min(duration,to);
  if(end<=start)return ranges;
  const next: WatchedRange = [start,end];
  const sorted:WatchedRange[]=[...ranges,next].sort((a,b)=>a[0]-b[0]);
  const merged:WatchedRange[]=[];
  for(const interval of sorted){const last=merged[merged.length-1];if(last&&interval[0]<=last[1])last[1]=Math.max(last[1],interval[1]);else merged.push([interval[0],interval[1]]);}
  return merged;
}
export function watchedSeconds(ranges: WatchedRange[]){return ranges.reduce((sum,[from,to])=>sum+to-from,0);}
