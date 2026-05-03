import React from "react";
import { Sparkles, Sprout, Sun, Heart, Search, ChevronDown, Leaf, Users, ChevronRight, Check } from "lucide-react";
import { Card } from "@/components/ui/card";

const stats = [
  { label: "Courses growing", value: 24, bg: "#ffedd5", text: "#c2410c", icon: Sprout },
  { label: "Employees tending", value: 148, bg: "#f3e8ff", text: "#a21caf", icon: Users },
  { label: "Full harvests", value: 892, bg: "#d1fae5", text: "#047857", icon: Heart },
  { label: "Currently sprouting", value: 37, bg: "#fef3c7", text: "#b45309", icon: Sun },
];

const courses = [
  {
    title: "Safety & Equipment Training",
    category: "Compliance",
    status: "Required",
    learners: 24,
    modules: 8,
    progress: 67,
    microcopy: "Taking shape",
    avatars: [
      { init: "JD", bg: "#fca5a5" },
      { init: "SM", bg: "#fcd34d" },
      { init: "AK", bg: "#86efac" },
    ],
  },
  {
    title: "Customer Service Standards",
    category: "Skills",
    status: "Published",
    learners: 32,
    modules: 6,
    progress: 84,
    microcopy: "Almost blooming",
    avatars: [
      { init: "EW", bg: "#c4b5fd" },
      { init: "RJ", bg: "#93c5fd" },
      { init: "LM", bg: "#fca5a5" },
      { init: "TS", bg: "#fcd34d" },
    ],
  },
  {
    title: "New Hire Onboarding",
    category: "Onboarding",
    status: "Required",
    learners: 12,
    modules: 5,
    progress: 92,
    microcopy: "In full bloom",
    avatars: [
      { init: "KL", bg: "#86efac" },
      { init: "OP", bg: "#fcd34d" },
      { init: "WN", bg: "#c4b5fd" },
    ],
  },
  {
    title: "Food Handler Certification",
    category: "Compliance",
    status: "Required",
    learners: 18,
    modules: 7,
    progress: 41,
    microcopy: "Sprouting nicely",
    avatars: [
      { init: "QA", bg: "#fca5a5" },
      { init: "ZX", bg: "#86efac" },
      { init: "BN", bg: "#93c5fd" },
    ],
  },
  {
    title: "Leadership Foundations",
    category: "Skills",
    status: "Published",
    learners: 9,
    modules: 10,
    progress: 28,
    microcopy: "Taking root",
    avatars: [
      { init: "MK", bg: "#fcd34d" },
      { init: "PO", bg: "#c4b5fd" },
    ],
  },
  {
    title: "Cash Handling & POS",
    category: "Skills",
    status: "Draft",
    learners: 15,
    modules: 4,
    progress: 0,
    microcopy: "Still budding",
    avatars: [
      { init: "TY", bg: "#fca5a5" },
      { init: "UI", bg: "#93c5fd" },
    ],
  },
];

function ModuleTrail({ total, progress }: { total: number; progress: number }) {
  const completedNodes = Math.floor((progress / 100) * total);
  
  return (
    <div className="relative pt-3 pb-2 w-full">
      {/* Soft connecting line */}
      <div className="absolute top-[22px] left-2 right-2 h-1.5 rounded-full bg-orange-50/60 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-rose-400 to-amber-400 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Pebbles */}
      <div className="relative flex justify-between items-center px-1">
        {Array.from({ length: total }).map((_, i) => {
          const isDone = i < completedNodes;
          const isCurrent = i === completedNodes;
          return (
            <div key={i} className="relative flex flex-col items-center group">
              <div 
                className={`h-4 w-4 rounded-full flex items-center justify-center transition-all z-10 ${
                  isDone 
                    ? 'bg-gradient-to-br from-rose-400 to-rose-500 shadow-[0_2px_8px_rgba(244,63,94,0.4)] scale-110' 
                    : isCurrent 
                      ? 'bg-white border-2 border-amber-400 shadow-[0_2px_8px_rgba(251,191,36,0.3)] scale-125' 
                      : 'bg-white border border-orange-100'
                }`}
              >
                {isDone && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LivingPulseGrid() {
  return (
    <div 
      className="min-h-screen font-['Inter'] pb-24"
      style={{ 
        background: "linear-gradient(135deg, #fff7ed 0%, #fef3f2 50%, #fff1f2 100%)" 
      }}
    >
      <div className="max-w-[1200px] mx-auto pt-12 px-8">
        
        {/* Header Row */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold text-stone-800 tracking-tight flex items-center gap-3 mb-2">
              <Leaf className="w-8 h-8 text-rose-400" />
              Training Hub
            </h1>
            <p className="text-lg text-stone-500 font-medium">
              Tend your courses, nurture employees, track full blooms.
            </p>
          </div>
          <button 
            className="h-12 px-6 rounded-full flex items-center gap-2 text-white font-semibold text-[15px] shadow-[0_8px_20px_-6px_rgba(244,63,94,0.5)] hover:scale-105 transition-transform"
            style={{ background: "linear-gradient(135deg, #fb7185 0%, #f59e0b 100%)" }}
          >
            <Sparkles className="w-4 h-4" />
            Plant a new course
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-5 mb-10">
          {stats.map((stat, i) => (
            <div 
              key={i} 
              className="rounded-3xl p-5 border border-white/60 backdrop-blur-sm"
              style={{ 
                backgroundColor: stat.bg,
                boxShadow: `0 10px 30px -10px ${stat.bg}80, inset 0 2px 0 0 rgba(255,255,255,0.7)`
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <stat.icon className="w-5 h-5 opacity-80" style={{ color: stat.text }} />
              </div>
              <div className="text-3xl font-bold mb-1 tracking-tight" style={{ color: stat.text }}>
                {stat.value}
              </div>
              <div className="text-sm font-medium opacity-80" style={{ color: stat.text }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Filter Row */}
        <div className="flex items-center gap-4 mb-8 bg-white/40 p-3 rounded-3xl backdrop-blur-md border border-rose-50/50 shadow-[0_8px_30px_-12px_rgba(251,113,133,0.15)]">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-rose-300 absolute left-4 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search the garden..." 
              className="w-full bg-white/70 border-none h-12 rounded-2xl pl-12 pr-4 text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-200 transition-all font-medium"
            />
          </div>
          <div className="relative">
            <select className="appearance-none bg-white/70 border-none h-12 rounded-2xl pl-5 pr-10 text-stone-700 font-medium focus:outline-none focus:ring-2 focus:ring-rose-200 transition-all cursor-pointer">
              <option>All Categories</option>
              <option>Safety</option>
              <option>Onboarding</option>
              <option>Compliance</option>
              <option>Skills</option>
            </select>
            <ChevronDown className="w-4 h-4 text-stone-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select className="appearance-none bg-white/70 border-none h-12 rounded-2xl pl-5 pr-10 text-stone-700 font-medium focus:outline-none focus:ring-2 focus:ring-rose-200 transition-all cursor-pointer">
              <option>All Status</option>
              <option>Published</option>
              <option>Draft</option>
              <option>Required</option>
            </select>
            <ChevronDown className="w-4 h-4 text-stone-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-3 gap-6">
          {courses.map((course, i) => (
            <div 
              key={i}
              className="bg-white rounded-[24px] overflow-hidden border border-rose-50 hover:-translate-y-1 transition-transform duration-300 relative group"
              style={{ 
                boxShadow: "0 20px 40px -15px rgba(244, 114, 182, 0.15), 0 4px 12px -4px rgba(251, 146, 60, 0.08)" 
              }}
            >
              {/* Header Gradient Strip */}
              <div 
                className="h-2 w-full opacity-70"
                style={{ background: "linear-gradient(90deg, #fb7185 0%, #fbbf24 100%)" }}
              />
              
              <div className="p-6">
                {/* Meta */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50">
                      {course.category}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      course.status === 'Required' ? 'text-amber-700 bg-amber-100' :
                      course.status === 'Published' ? 'text-emerald-700 bg-emerald-100' :
                      'text-stone-500 bg-stone-100'
                    }`}>
                      {course.status}
                    </span>
                  </div>
                </div>

                {/* Title & Progress Meta */}
                <h3 className="text-xl font-bold text-stone-800 leading-tight mb-2 pr-4 group-hover:text-rose-500 transition-colors">
                  {course.title}
                </h3>
                
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm font-medium text-stone-500 flex items-center gap-1.5">
                    {course.progress === 100 ? <Heart className="w-4 h-4 text-rose-400" /> : <Sprout className="w-4 h-4 text-amber-500" />}
                    {course.microcopy}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-stone-800 tracking-tighter">{course.progress}%</span>
                    <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">cohort</span>
                  </div>
                </div>

                {/* Pebble Path */}
                <div className="mb-6 bg-orange-50/30 -mx-2 px-2 py-3 rounded-2xl">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 pl-1">
                    Path to bloom
                  </div>
                  <ModuleTrail total={course.modules} progress={course.progress} />
                </div>

                {/* Learners & Action */}
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {course.avatars.map((avatar, j) => (
                        <div 
                          key={j}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white relative z-10"
                          style={{ backgroundColor: avatar.bg }}
                        >
                          {avatar.init}
                          {j === 0 && course.progress > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full border border-white animate-pulse" />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] font-medium text-stone-500 leading-tight">
                      <span className="text-stone-700 font-bold block">{course.learners}</span>
                      tending
                    </div>
                  </div>
                  
                  <button className="h-9 w-9 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors duration-300">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
