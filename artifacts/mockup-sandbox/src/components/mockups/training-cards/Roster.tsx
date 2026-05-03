import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

const learners = [
  { name: "Sarah Mitchell", role: "Lead", progress: 100, color: "#10b981", initials: "SM" },
  { name: "Marcus Tate", role: "Cleaner", progress: 86, color: "#3b82f6", initials: "MT" },
  { name: "Priya Kapoor", role: "Cleaner", progress: 64, color: "#a855f7", initials: "PK" },
  { name: "Jordan Lee", role: "Trainee", progress: 42, color: "#f59e0b", initials: "JL" },
  { name: "Elena Romero", role: "Cleaner", progress: 25, color: "#ef4444", initials: "ER" },
  { name: "Devon Park", role: "Trainee", progress: 8, color: "#06b6d4", initials: "DP" },
];

const more = 18;

function Ring({ progress, color, initials, size = 64 }: { progress: number; color: string; initials: string; size?: number }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#f1f5f9" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div
        className="absolute inset-[5px] rounded-full flex items-center justify-center text-white text-[14px] font-semibold tracking-wide"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
    </div>
  );
}

export function Roster() {
  const featured = learners.slice(0, 4);
  const cohortAvg = Math.round(learners.reduce((s, l) => s + l.progress, 0) / learners.length);

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-6 font-['Inter']">
      <Card className="w-[460px] p-6 border-zinc-200 shadow-sm bg-white">
        {/* Tiny course header — context only */}
        <div className="flex items-center gap-2 mb-5">
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-medium">
            Compliance
          </div>
          <div className="text-[11px] text-zinc-400">·</div>
          <div className="text-[11px] text-zinc-500">Safety & Equipment Training</div>
        </div>

        {/* Featured rings — the people lead */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {featured.map((l) => (
            <div key={l.name} className="flex flex-col items-center text-center">
              <Ring progress={l.progress} color={l.color} initials={l.initials} />
              <div className="mt-2 text-[12px] font-medium text-zinc-900 leading-tight truncate w-full">
                {l.name.split(" ")[0]}
              </div>
              <div className="text-[10px] text-zinc-500 tabular-nums">{l.progress}%</div>
            </div>
          ))}
        </div>

        {/* Stacked overflow */}
        <div className="flex items-center gap-3 py-3 border-y border-zinc-100">
          <div className="flex -space-x-2">
            {learners.slice(4).map((l) => (
              <div
                key={l.name}
                className="h-8 w-8 rounded-full ring-2 ring-white flex items-center justify-center text-white text-[10px] font-semibold"
                style={{ backgroundColor: l.color }}
              >
                {l.initials}
              </div>
            ))}
            <div className="h-8 w-8 rounded-full ring-2 ring-white bg-zinc-200 flex items-center justify-center text-zinc-700 text-[10px] font-semibold">
              +{more}
            </div>
          </div>
          <div className="text-[11px] text-zinc-500 leading-tight">
            <div>and {more + 2} more</div>
            <div className="text-zinc-400">enrolled in this course</div>
          </div>
        </div>

        {/* Cohort summary — minimized */}
        <div className="flex items-end gap-4 mt-5">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Cohort avg</div>
            <div className="text-3xl font-bold text-zinc-900 tabular-nums leading-none mt-1">{cohortAvg}<span className="text-base text-zinc-400 font-medium">%</span></div>
          </div>
          <div className="flex-1">
            <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
              <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${cohortAvg}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-400 mt-1.5">
              <span>1 done</span>
              <span>3 in progress</span>
              <span>20 not started</span>
            </div>
          </div>
        </div>

        <Button variant="ghost" size="sm" className="w-full mt-4 h-8 text-zinc-600 hover:text-zinc-900 justify-between">
          <span>Manage cohort</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </Card>
    </div>
  );
}
