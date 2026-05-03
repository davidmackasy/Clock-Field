import { Search, ChevronDown, ArrowRight } from "lucide-react";

const courses = [
  {
    ticker: "SE",
    title: "Safety & Equipment Training",
    category: "COMPLIANCE",
    status: "REQUIRED",
    learners: 24,
    modules: 8,
    completed: 67,
    active: [
      { initials: "SM", progress: 6 },
      { initials: "JT", progress: 4 },
      { initials: "AK", progress: 2 },
    ]
  },
  {
    ticker: "CS",
    title: "Customer Service Standards",
    category: "SKILLS",
    status: "PUBLISHED",
    learners: 32,
    modules: 6,
    completed: 84,
    active: [
      { initials: "PL", progress: 5 },
      { initials: "MR", progress: 5 },
      { initials: "KD", progress: 4 },
    ]
  },
  {
    ticker: "NO",
    title: "New Hire Onboarding",
    category: "ONBOARDING",
    status: "REQUIRED",
    learners: 12,
    modules: 5,
    completed: 92,
    active: [
      { initials: "BJ", progress: 4 },
      { initials: "RL", progress: 4 },
    ]
  },
  {
    ticker: "FC",
    title: "Food Handler Certification",
    category: "COMPLIANCE",
    status: "REQUIRED",
    learners: 18,
    modules: 7,
    completed: 41,
    active: [
      { initials: "TY", progress: 3 },
      { initials: "NM", progress: 3 },
      { initials: "OS", progress: 2 },
      { initials: "WE", progress: 2 },
    ]
  },
  {
    ticker: "LF",
    title: "Leadership Foundations",
    category: "SKILLS",
    status: "PUBLISHED",
    learners: 9,
    modules: 10,
    completed: 28,
    active: [
      { initials: "GH", progress: 3 },
      { initials: "VB", progress: 2 },
      { initials: "XQ", progress: 1 },
    ]
  },
  {
    ticker: "CH",
    title: "Cash Handling & POS",
    category: "SKILLS",
    status: "DRAFT",
    learners: 15,
    modules: 4,
    completed: 0,
    active: []
  }
];

export function QuietOperatorGrid() {
  return (
    <div className="min-h-screen bg-zinc-100 font-['Inter'] text-zinc-900 pb-12 selection:bg-zinc-900 selection:text-white">
      {/* Top Status Bar */}
      <div className="bg-zinc-900 text-zinc-400 text-[10px] font-mono tracking-widest px-6 py-1.5 flex justify-between items-center uppercase">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-sm animate-pulse" />
            <span className="text-zinc-100">SYSTEM: ONLINE</span>
          </div>
          <span>PULSE · 24 ACTIVE</span>
        </div>
        <span>0930 LOCAL</span>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 mt-10 space-y-8">
        
        {/* 1. Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-1">Training Hub</h1>
            <p className="text-sm text-zinc-500">Create courses, assign employees, track completions</p>
          </div>
          <button className="bg-zinc-900 hover:bg-zinc-800 text-white font-mono text-[11px] tracking-wider uppercase px-4 py-2.5 rounded-sm transition-colors flex items-center gap-2">
            + NEW COURSE
          </button>
        </div>

        {/* 2. Stats Row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "TOTAL COURSES", value: "24" },
            { label: "EMP ASSIGNED", value: "148" },
            { label: "COMPLETIONS", value: "892" },
            { label: "IN PROGRESS", value: "37" },
          ].map((stat, i) => (
            <div key={i} className="bg-white border border-zinc-200 p-4 rounded-sm flex flex-col justify-between items-start" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.02)" }}>
              <span className="text-[10px] font-mono tracking-widest text-zinc-400">{stat.label}</span>
              <span className="text-3xl font-mono text-zinc-900 mt-2">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* 3. Filter Row */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 bg-white border border-zinc-200 rounded-sm overflow-hidden flex items-center">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3" />
            <input 
              type="text" 
              placeholder="SEARCH COURSES..." 
              className="w-full bg-transparent border-none focus:ring-0 text-sm font-mono placeholder:text-zinc-400 py-2.5 pl-10 pr-4 outline-none"
            />
          </div>
          
          <div className="bg-white border border-zinc-200 rounded-sm flex items-center px-3 py-2.5 cursor-pointer hover:bg-zinc-50 w-48 justify-between">
            <span className="text-[11px] font-mono tracking-wider text-zinc-600">ALL CATEGORIES</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </div>

          <div className="bg-white border border-zinc-200 rounded-sm flex items-center px-3 py-2.5 cursor-pointer hover:bg-zinc-50 w-40 justify-between">
            <span className="text-[11px] font-mono tracking-wider text-zinc-600">ALL STATUS</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </div>
        </div>

        {/* 4. Course Grid */}
        <div className="grid grid-cols-3 gap-5">
          {courses.map((c, i) => (
            <div key={i} className="group relative bg-white border border-zinc-200 rounded-sm flex flex-col transition-all hover:border-zinc-400" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.02)" }}>
              
              {/* Card Header Strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-200 group-hover:bg-zinc-900 transition-colors" />

              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-8 h-8 bg-zinc-100 border border-zinc-200 rounded-sm flex items-center justify-center font-mono text-[12px] font-semibold text-zinc-900">
                    {c.ticker}
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">{c.category}</span>
                    <div className="mt-1 font-mono text-[10px] font-semibold text-zinc-900">
                      [{c.status}]
                    </div>
                  </div>
                </div>

                <h3 className="text-base font-semibold leading-tight text-zinc-900 mb-6">{c.title}</h3>
                
                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div>
                    <div className="text-[9px] font-mono text-zinc-400 mb-1 uppercase">Cohort</div>
                    <div className="text-sm font-mono text-zinc-900">{c.completed}%</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-mono text-zinc-400 mb-1 uppercase">Learners</div>
                    <div className="text-sm font-mono text-zinc-900">{c.learners}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-mono text-zinc-400 mb-1 uppercase">Modules</div>
                    <div className="text-sm font-mono text-zinc-900">{c.modules}</div>
                  </div>
                </div>

                <div className="mt-auto pt-6 border-t border-zinc-100">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[9px] font-mono text-zinc-400 tracking-wider">PROGRESS PATH</span>
                    <div className="flex items-center gap-1">
                      {c.active.length > 0 ? (
                        <>
                          <span className="text-[9px] font-mono text-zinc-400 mr-1">ACTIVE:</span>
                          {c.active.slice(0, 3).map((a, j) => (
                            <span key={j} className="text-[9px] font-mono bg-zinc-100 text-zinc-600 px-1 border border-zinc-200 rounded-sm">
                              {a.initials}
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="text-[9px] font-mono text-zinc-400">NO ACTIVE</span>
                      )}
                    </div>
                  </div>

                  {/* Wireframe Module Path */}
                  <div className="relative pt-2 pb-1 px-1.5 flex justify-between items-center">
                    {/* Connecting Line */}
                    <div className="absolute top-1/2 left-2 right-2 h-px bg-zinc-200 -translate-y-1/2" />
                    
                    {/* Completed Line Overlay */}
                    {c.completed > 0 && (
                      <div 
                        className="absolute top-1/2 left-2 h-px bg-zinc-900 -translate-y-1/2" 
                        style={{ width: `calc(${(c.completed / 100) * 100}% - 8px)` }}
                      />
                    )}

                    {/* Nodes */}
                    {Array.from({ length: c.modules }).map((_, idx) => {
                      const pct = idx / (c.modules - 1);
                      const isCompleted = (pct * 100) <= c.completed;
                      
                      return (
                        <div 
                          key={idx} 
                          className={`relative z-10 w-2 h-2 ${isCompleted ? 'bg-zinc-900' : 'bg-white border border-zinc-300'}`}
                          style={{
                            boxShadow: isCompleted ? 'none' : '0 0 0 2px white'
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer Open Affordance */}
              <div className="px-5 py-3 border-t border-zinc-200 bg-zinc-50/50 flex justify-between items-center group-hover:bg-zinc-100 transition-colors cursor-pointer">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">ACCESS DATA</span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
              </div>
            </div>
          ))}
        </div>
        
      </div>
    </div>
  );
}
