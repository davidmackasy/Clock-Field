import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Lock, ShieldCheck, Users, ChevronRight } from "lucide-react";

const modules = [
  { name: "Intro", done: 24 },
  { name: "Hazards", done: 22 },
  { name: "Chemicals", done: 18 },
  { name: "PPE", done: 14 },
  { name: "Equipment", done: 9 },
  { name: "Spills", done: 4 },
  { name: "Reporting", done: 1 },
  { name: "Final", done: 0 },
];

const total = 24;
const learners = [
  { initials: "SM", color: "bg-rose-400", at: 3 },
  { initials: "MT", color: "bg-amber-400", at: 5 },
  { initials: "PK", color: "bg-sky-400", at: 2 },
  { initials: "JL", color: "bg-violet-400", at: 6 },
];

export function Trail() {
  const overallProgress = Math.round(
    (modules.reduce((s, m) => s + m.done, 0) / (modules.length * total)) * 100
  );

  return (
    <div className="min-h-screen bg-[#fafaf7] flex items-center justify-center p-6 font-['Inter']">
      <Card className="w-[480px] p-6 border-stone-200 shadow-sm bg-white">
        {/* Header */}
        <div className="flex items-start gap-3 mb-1">
          <div className="h-9 w-9 rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-stone-900 leading-tight">Safety & Equipment Training</div>
            <div className="text-[11px] text-stone-500 mt-0.5">Compliance · {modules.length} modules · 24 learners</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-stone-900 leading-none tabular-nums">{overallProgress}%</div>
            <div className="text-[10px] text-stone-500 uppercase tracking-wider mt-0.5">cohort</div>
          </div>
        </div>

        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-400 mt-7 mb-3">Module path</div>

        {/* The trail */}
        <div className="relative px-1 pt-2 pb-1">
          {/* Connecting line */}
          <div className="absolute left-3 right-3 top-[14px] h-[2px] bg-stone-200">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          {/* Checkpoints */}
          <div className="relative flex justify-between items-start">
            {modules.map((m, i) => {
              const pct = m.done / total;
              const isDone = pct >= 0.95;
              const isActive = pct > 0.1 && pct < 0.95;
              const isLocked = pct <= 0.1;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5" style={{ width: 44 }}>
                  <div
                    className={`relative z-10 h-7 w-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                      isDone
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : isActive
                        ? "bg-white border-emerald-500 text-emerald-700 shadow-sm"
                        : "bg-white border-stone-300 text-stone-400"
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : isLocked ? <Lock className="w-3 h-3" /> : i + 1}
                  </div>
                  <div className={`text-[10px] text-center leading-tight ${isLocked ? "text-stone-400" : "text-stone-700"}`}>
                    {m.name}
                  </div>
                  <div className="text-[9px] text-stone-400 tabular-nums">
                    {m.done}/{total}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Learners along the trail */}
        <div className="mt-6 rounded-lg bg-stone-50 border border-stone-100 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-3.5 h-3.5 text-stone-500" />
            <div className="text-[11px] font-medium text-stone-700">Currently in flight</div>
            <div className="ml-auto text-[11px] text-stone-500">{learners.length} active</div>
          </div>
          <div className="space-y-1.5">
            {learners.slice(0, 3).map((l, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className={`h-6 w-6 rounded-full ${l.color} text-white text-[10px] font-semibold flex items-center justify-center shrink-0`}>
                  {l.initials}
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                  <div
                    className={`h-full ${l.color} opacity-80`}
                    style={{ width: `${(l.at / modules.length) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] text-stone-500 tabular-nums w-12 text-right">
                  {modules[l.at].name}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button variant="ghost" size="sm" className="w-full mt-3 h-8 text-stone-600 hover:text-stone-900 justify-between">
          <span>Walk the path</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </Card>
    </div>
  );
}
