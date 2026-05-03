import { Activity, ChevronRight } from "lucide-react";

const featured = { who: "SARAH M.", what: "FINISHED", target: "MOD 03 · Chemical Safety", when: "12m" };
const earlier = [
  { who: "MARCUS T.", what: "FINISHED", target: "MOD 05 · PPE Basics", when: "38m" },
  { who: "PRIYA K.", what: "FINISHED", target: "MOD 02 · Hazard ID", when: "1h" },
  { who: "DEVON L.", what: "FINISHED", target: "MOD 04 · Spill Response", when: "2h" },
];
const spark = [3, 5, 4, 7, 6, 9, 17];
const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "TODAY"];

export function QuietOperator() {
  const max = Math.max(...spark);
  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-6 font-['Inter']">
      <div className="w-[460px] bg-white border border-zinc-300 rounded-md overflow-hidden" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.02)" }}>
        {/* Header — instrument panel */}
        <div className="px-4 py-2 border-b border-zinc-200 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-zinc-900" />
            <span className="h-1 w-1 rounded-full bg-zinc-300" />
            <span className="h-1 w-1 rounded-full bg-zinc-300" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-900 font-semibold">PULSE</span>
          <span className="ml-auto text-[10px] font-mono text-zinc-400">24h</span>
        </div>

        {/* Featured — terse */}
        <div className="px-4 pt-3.5 pb-3 grid grid-cols-[1fr_auto] gap-3 items-baseline">
          <div className="min-w-0">
            <div className="text-[10px] font-mono tracking-[0.18em] text-zinc-400 uppercase mb-0.5">{featured.what}</div>
            <div className="text-[14px] text-zinc-900 leading-tight">
              <span className="font-semibold">{featured.who}</span>
              <span className="text-zinc-400"> · </span>
              <span className="text-zinc-700">{featured.target}</span>
            </div>
          </div>
          <div className="text-[11px] font-mono text-zinc-400 tabular-nums">−{featured.when}</div>
        </div>

        {/* Histogram — wireframe bars */}
        <div className="px-4 pb-2 pt-1 border-t border-zinc-100">
          <div className="grid grid-cols-7 gap-px h-8 items-end">
            {spark.map((v, i) => (
              <div key={i} className="flex flex-col justify-end items-stretch h-full">
                <div className="bg-zinc-900" style={{ height: `${(v / max) * 100}%`, opacity: i === spark.length - 1 ? 1 : 0.25 }} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px mt-1.5">
            {days.map((d, i) => (
              <div key={i} className={`text-[9px] font-mono text-center ${i === days.length - 1 ? "text-zinc-900 font-semibold" : "text-zinc-400"}`}>{d}</div>
            ))}
          </div>
        </div>

        {/* Stream — table-like */}
        <div className="px-4 pt-3 pb-3 border-t border-zinc-100">
          <div className="text-[10px] font-mono tracking-[0.18em] text-zinc-400 uppercase mb-2">LOG</div>
          <div className="divide-y divide-zinc-100">
            {earlier.map((a, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-3 items-baseline py-1.5 text-[12px]">
                <span className="font-mono text-[10px] text-zinc-300 tabular-nums">{String(i + 2).padStart(2, "0")}</span>
                <span className="text-zinc-700 truncate"><span className="font-semibold text-zinc-900">{a.who}</span> <span className="text-zinc-400">{a.target}</span></span>
                <span className="font-mono text-[10px] text-zinc-400 tabular-nums">−{a.when}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer — instrument readout */}
        <div className="border-t border-zinc-200 px-4 py-2 flex items-center bg-zinc-50">
          <Activity className="w-3 h-3 text-zinc-500" />
          <span className="ml-2 text-[11px] font-mono tabular-nums text-zinc-700">
            <span className="font-semibold text-zinc-900">17</span><span className="text-zinc-400"> EVT / DAY</span>
          </span>
          <button className="ml-auto text-[11px] font-mono text-zinc-500 hover:text-zinc-900 flex items-center gap-0.5 uppercase tracking-wider">
            Manage <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
