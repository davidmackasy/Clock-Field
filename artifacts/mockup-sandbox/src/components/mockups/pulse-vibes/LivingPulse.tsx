import { ChevronRight, Sparkles } from "lucide-react";

const featured = { who: "Sarah", what: "wrapped up", target: "Chemical Safety", when: "12 minutes ago" };
const earlier = [
  { who: "Marcus", initial: "M", target: "PPE Basics", when: "38m", color: "#fbbf24" },
  { who: "Priya", initial: "P", target: "Hazard ID", when: "1h", color: "#f472b6" },
  { who: "Devon", initial: "D", target: "Spill Response", when: "2h", color: "#34d399" },
];
const spark = [3, 5, 4, 7, 6, 9, 17];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];

export function LivingPulse() {
  const max = Math.max(...spark);
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 font-['Inter']"
      style={{ background: "linear-gradient(135deg, #fff7ed 0%, #fef3f2 50%, #fff1f2 100%)" }}
    >
      <div
        className="w-[460px] rounded-[28px] overflow-hidden bg-white"
        style={{ boxShadow: "0 30px 80px -20px rgba(244, 114, 182, 0.25), 0 8px 24px -8px rgba(251, 146, 60, 0.18)" }}
      >
        {/* Header — soft warm strip */}
        <div
          className="px-6 py-3.5 flex items-center gap-2.5"
          style={{ background: "linear-gradient(90deg, #fff7ed 0%, #ffe4e6 100%)" }}
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "#fb7185" }} />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "#f43f5e" }} />
          </span>
          <span className="text-[12px] font-medium" style={{ color: "#be123c", letterSpacing: "0.04em" }}>warm activity today</span>
          <Sparkles className="ml-auto w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
        </div>

        {/* Featured — generous, conversational */}
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-white text-[14px] font-semibold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #fb7185 0%, #f59e0b 100%)" }}
            >
              S
            </div>
            <div className="min-w-0">
              <div className="text-[15px] leading-relaxed text-stone-800">
                <span className="font-semibold text-stone-900">{featured.who}</span>
                <span className="text-stone-500"> just {featured.what} </span>
                <span className="font-medium" style={{ color: "#be123c" }}>{featured.target}</span>
                <span className="text-stone-500"> 🎉</span>
              </div>
              <div className="text-[11px] text-stone-400 mt-1">{featured.when}</div>
            </div>
          </div>
        </div>

        {/* Histogram — soft pebble bars */}
        <div className="px-6 pb-4">
          <div className="flex items-end gap-1.5 h-12">
            {spark.map((v, i) => {
              const isToday = i === spark.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end h-full">
                  <div
                    className="rounded-full transition-all"
                    style={{
                      height: `${(v / max) * 100}%`,
                      minHeight: "8px",
                      background: isToday
                        ? "linear-gradient(180deg, #fb923c 0%, #f43f5e 100%)"
                        : "linear-gradient(180deg, #fed7aa 0%, #fecdd3 100%)",
                      opacity: 0.55 + (i / spark.length) * 0.45,
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] mt-2">
            {days.map((d, i) => (
              <span key={i} style={{ color: i === days.length - 1 ? "#be123c" : "#a8a29e", fontWeight: i === days.length - 1 ? 600 : 400 }}>
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Stream — color-tagged */}
        <div className="px-6 pb-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-2.5">earlier today</div>
          <div className="space-y-2">
            {earlier.map((a, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                  style={{ background: a.color }}
                >
                  {a.initial}
                </div>
                <span className="text-[13px] text-stone-700 min-w-0 truncate">
                  <span className="font-medium text-stone-900">{a.who}</span>
                  <span className="text-stone-400"> finished </span>
                  <span className="text-stone-600">{a.target}</span>
                </span>
                <span className="ml-auto text-[11px] text-stone-400">{a.when}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer — friendly */}
        <div
          className="px-6 py-4 flex items-center gap-3"
          style={{ background: "linear-gradient(90deg, #fff7ed 0%, #ffffff 100%)", borderTop: "1px solid #fed7aa" }}
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              <div className="h-5 w-5 rounded-full border-2 border-white" style={{ background: "#fb7185" }} />
              <div className="h-5 w-5 rounded-full border-2 border-white" style={{ background: "#fbbf24" }} />
              <div className="h-5 w-5 rounded-full border-2 border-white" style={{ background: "#34d399" }} />
            </div>
            <span className="text-[12px] text-stone-600">
              <span className="font-semibold text-stone-900">17</span> moments today
            </span>
          </div>
          <button
            className="ml-auto text-[12px] font-medium px-3 py-1.5 rounded-full flex items-center gap-0.5"
            style={{ background: "#fff", color: "#be123c", border: "1px solid #fecdd3" }}
          >
            Tend cohort <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
