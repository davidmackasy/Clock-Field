import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ChevronRight, ShieldCheck } from "lucide-react";

const activity = [
  { who: "Sarah M.", what: "finished", target: "Module 3 · Chemical Safety", when: "12m ago", tone: "good" },
  { who: "Marcus T.", what: "started", target: "Module 5 · PPE Basics", when: "38m ago", tone: "info" },
  { who: "Priya K.", what: "failed quiz on", target: "Module 2", when: "1h ago", tone: "warn" },
];

const spark = [3, 5, 4, 7, 6, 9, 8, 11, 10, 13, 12, 15];

export function Pulse() {
  const max = Math.max(...spark);
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-['Inter']">
      <Card className="w-[460px] overflow-hidden border-slate-200 shadow-sm">
        {/* Live header strip */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-2.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Live activity</span>
          <span className="ml-auto text-[11px] text-emerald-700/70">last 24h</span>
        </div>

        {/* Most-recent action — foregrounded */}
        <div className="px-5 pt-4 pb-3">
          <div className="text-[15px] leading-snug text-slate-900">
            <span className="font-semibold">{activity[0].who}</span>
            <span className="text-slate-500"> {activity[0].what} </span>
            <span className="font-medium">{activity[0].target}</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{activity[0].when}</div>
        </div>

        {/* Course context — secondary */}
        <div className="px-5 pb-3 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-slate-700 truncate">Safety & Equipment Training</div>
            <div className="text-[11px] text-slate-400">Compliance · 8 modules</div>
          </div>
          <Badge variant="secondary" className="ml-auto bg-slate-100 text-slate-600 font-normal">Required</Badge>
        </div>

        {/* Sparkline — completions over time */}
        <div className="px-5 pb-3">
          <div className="flex items-end gap-1 h-10">
            {spark.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-gradient-to-t from-emerald-200 to-emerald-400"
                style={{ height: `${(v / max) * 100}%`, opacity: 0.4 + (i / spark.length) * 0.6 }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
            <span>Mon</span><span>Wed</span><span>Fri</span><span>Today</span>
          </div>
        </div>

        {/* Recent activity stream */}
        <div className="px-5 pb-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Earlier today</div>
          <div className="space-y-1.5">
            {activity.slice(1).map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span className={`h-1.5 w-1.5 rounded-full ${a.tone === "warn" ? "bg-amber-500" : "bg-slate-300"}`} />
                <span className="text-slate-700"><span className="font-medium">{a.who}</span> {a.what} <span className="text-slate-500">{a.target}</span></span>
                <span className="ml-auto text-[11px] text-slate-400">{a.when}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-3 bg-slate-50/50">
          <div className="flex items-center gap-1.5 text-[12px] text-slate-600">
            <Activity className="w-3.5 h-3.5" />
            <span><span className="font-semibold text-slate-900">17</span> events today</span>
          </div>
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-slate-600 hover:text-slate-900">
            Manage <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
