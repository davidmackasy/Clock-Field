import { ChevronRight } from "lucide-react";

const featured = {
  who: "Sarah Mitchell",
  role: "Field Technician",
  target: "Chemical Safety",
  when: "12 minutes ago",
};
const earlier = [
  { who: "Marcus Tan", role: "Operations", target: "PPE Basics", when: "38m" },
  { who: "Priya Kapoor", role: "Compliance", target: "Hazard Identification", when: "1h" },
  { who: "Devon Lee", role: "Field Technician", target: "Spill Response", when: "2h" },
];
const spark = [3, 5, 4, 7, 6, 9, 17];
const days = ["M", "T", "W", "T", "F", "S", "•"];
const INK = "#1c1917";
const ACCENT = "#7f1d1d";

export function EditorialBriefing() {
  const max = Math.max(...spark);
  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ background: "#f5f1ea" }}
    >
      <div
        className="w-[460px] bg-[#fbf8f1] overflow-hidden"
        style={{
          fontFamily: "'Inter', sans-serif",
          border: `1px solid ${INK}`,
          boxShadow: "8px 8px 0 #1c1917",
        }}
      >
        {/* Masthead */}
        <div className="px-7 pt-6 pb-3" style={{ borderBottom: `2px solid ${INK}` }}>
          <div className="flex items-baseline justify-between">
            <span
              className="text-[10px] uppercase font-semibold"
              style={{ letterSpacing: "0.32em", color: ACCENT }}
            >
              The Daily Briefing
            </span>
            <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: INK, opacity: 0.5 }}>
              Vol. 1 · 24h
            </span>
          </div>
          <div
            className="mt-2 text-[11px] uppercase"
            style={{ letterSpacing: "0.24em", color: INK, opacity: 0.6, fontWeight: 500 }}
          >
            Safety &amp; Equipment Training
          </div>
        </div>

        {/* Lede */}
        <div className="px-7 pt-5 pb-5" style={{ borderBottom: `1px solid ${INK}30` }}>
          <div
            className="text-[10px] uppercase mb-2"
            style={{ letterSpacing: "0.28em", color: ACCENT, fontWeight: 600 }}
          >
            ◆ Latest
          </div>
          <h1
            className="leading-[1.15] mb-2"
            style={{
              fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
              fontSize: "22px",
              fontWeight: 600,
              color: INK,
              letterSpacing: "-0.01em",
            }}
          >
            {featured.who} completes <span style={{ fontStyle: "italic" }}>{featured.target}</span>.
          </h1>
          <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: INK, opacity: 0.5 }}>
            {featured.role} &nbsp;·&nbsp; {featured.when}
          </div>
        </div>

        {/* Chart — engraved bars */}
        <div className="px-7 py-5" style={{ borderBottom: `1px solid ${INK}30` }}>
          <div
            className="text-[10px] uppercase mb-3"
            style={{ letterSpacing: "0.28em", color: INK, opacity: 0.55, fontWeight: 600 }}
          >
            Seven-day completions
          </div>
          <div className="flex items-end gap-1.5 h-10" style={{ borderBottom: `1px solid ${INK}` }}>
            {spark.map((v, i) => {
              const isToday = i === spark.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end h-full">
                  <div
                    style={{
                      height: `${(v / max) * 100}%`,
                      background: isToday ? INK : "transparent",
                      border: `1px solid ${INK}`,
                      borderBottom: "none",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 mt-1.5">
            {days.map((d, i) => (
              <div
                key={i}
                className="flex-1 text-center text-[10px]"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  color: i === days.length - 1 ? ACCENT : INK,
                  opacity: i === days.length - 1 ? 1 : 0.55,
                  fontWeight: i === days.length - 1 ? 700 : 400,
                }}
              >
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Bylines */}
        <div className="px-7 py-5" style={{ borderBottom: `1px solid ${INK}30` }}>
          <div
            className="text-[10px] uppercase mb-3"
            style={{ letterSpacing: "0.28em", color: INK, opacity: 0.55, fontWeight: 600 }}
          >
            Also today
          </div>
          <div className="space-y-3">
            {earlier.map((a, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-3 items-baseline">
                <span
                  className="text-[10px] tabular-nums"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    color: ACCENT,
                    fontWeight: 700,
                    fontStyle: "italic",
                  }}
                >
                  {String(i + 2).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div
                    className="text-[14px] leading-snug"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      color: INK,
                      fontWeight: 500,
                      letterSpacing: "-0.005em",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{a.who}</span>
                    <span style={{ opacity: 0.55, fontStyle: "italic", fontWeight: 400 }}> on </span>
                    <span style={{ fontStyle: "italic" }}>{a.target}</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.16em] mt-0.5" style={{ color: INK, opacity: 0.45 }}>
                    {a.role}
                  </div>
                </div>
                <span className="text-[10px] tabular-nums" style={{ color: INK, opacity: 0.45 }}>
                  {a.when}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Colophon */}
        <div className="px-7 py-4 flex items-baseline gap-3" style={{ background: "#f0eadf" }}>
          <div className="text-[10px] uppercase" style={{ letterSpacing: "0.24em", color: INK, opacity: 0.6 }}>
            Filed today
          </div>
          <span style={{ color: INK, opacity: 0.4 }}>·</span>
          <div className="text-[12px]" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: INK }}>
            <span style={{ fontWeight: 700, fontSize: "16px" }}>17</span>{" "}
            <span style={{ fontStyle: "italic", opacity: 0.7 }}>entries</span>
          </div>
          <button
            className="ml-auto text-[10px] uppercase flex items-center gap-1"
            style={{
              letterSpacing: "0.22em",
              color: ACCENT,
              fontWeight: 600,
              borderBottom: `1px solid ${ACCENT}`,
              paddingBottom: "1px",
            }}
          >
            Edit roster <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
