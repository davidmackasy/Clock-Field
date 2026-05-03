import { Search, ChevronDown, ChevronRight, PenTool } from "lucide-react";

const INK = "#1c1917";
const ACCENT = "#7f1d1d";
const BG = "#f5f1ea";
const CARD_BG = "#fbf8f1";

const stats = [
  { label: "Total Courses", value: "24" },
  { label: "Employees Assigned", value: "148" },
  { label: "Completions", value: "892" },
  { label: "In Progress", value: "37" },
];

const courses = [
  {
    title: "Safety & Equipment",
    emphasis: "Training",
    category: "Compliance",
    status: "REQUIRED READING",
    learners: 24,
    modules: 8,
    cohort: 67,
    bylines: ["SM", "MT", "PK", "+21 others"],
  },
  {
    title: "Customer Service",
    emphasis: "Standards",
    category: "Skills",
    status: "PUBLISHED EDITION",
    learners: 32,
    modules: 6,
    cohort: 84,
    bylines: ["JL", "TR", "AB", "+29 others"],
  },
  {
    title: "New Hire",
    emphasis: "Onboarding",
    category: "Onboarding",
    status: "REQUIRED READING",
    learners: 12,
    modules: 5,
    cohort: 92,
    bylines: ["KL", "MC", "PR", "+9 others"],
  },
  {
    title: "Food Handler",
    emphasis: "Certification",
    category: "Compliance",
    status: "REQUIRED READING",
    learners: 18,
    modules: 7,
    cohort: 41,
    bylines: ["DW", "EW", "GH", "+15 others"],
  },
  {
    title: "Leadership",
    emphasis: "Foundations",
    category: "Skills",
    status: "PUBLISHED EDITION",
    learners: 9,
    modules: 10,
    cohort: 28,
    bylines: ["RT", "YU", "PL", "+6 others"],
  },
  {
    title: "Cash Handling &",
    emphasis: "POS",
    category: "Skills",
    status: "DRAFT EDITION",
    learners: 15,
    modules: 4,
    cohort: 0,
    bylines: ["No active contributors yet"],
  },
];

export function EditorialBriefingGrid() {
  return (
    <div
      className="min-h-screen font-['Inter',sans-serif] p-8 pb-20"
      style={{ backgroundColor: BG }}
    >
      <div className="max-w-[1200px] mx-auto space-y-12" style={{ backgroundColor: CARD_BG, padding: '48px', border: `1px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}` }}>
        
        {/* MASTHEAD */}
        <div className="flex items-center justify-between w-full border-b pb-2" style={{ borderColor: INK }}>
          <div
            className="text-[10px] uppercase font-semibold tracking-[0.32em]"
            style={{ color: ACCENT }}
          >
            Vol. 1 · Tuesday, May 03
          </div>
          <div
            className="text-[10px] uppercase font-semibold tracking-[0.32em]"
            style={{ color: INK }}
          >
            THE TRAINING JOURNAL
          </div>
        </div>

        {/* HEADER ROW */}
        <header className="flex items-end justify-between border-b-2 pb-6" style={{ borderColor: INK }}>
          <div>
            <h1
              className="text-6xl font-bold tracking-tight mb-3"
              style={{
                fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
                color: INK,
                letterSpacing: "-0.02em",
              }}
            >
              Training Hub
            </h1>
            <p
              className="text-[11px] uppercase tracking-[0.2em] font-medium"
              style={{ color: INK, opacity: 0.7 }}
            >
              Create courses, assign employees, track completions
            </p>
          </div>
          
          <button
            className="text-[13px] uppercase font-bold tracking-[0.1em] flex items-center gap-2 pb-1 transition-opacity hover:opacity-70"
            style={{ color: ACCENT, borderBottom: `2px solid ${ACCENT}` }}
          >
            <PenTool className="w-4 h-4" />
            ✦ Commission a course
          </button>
        </header>

        {/* METRICS */}
        <section className="grid grid-cols-2 md:grid-cols-4 border-b-2" style={{ borderColor: INK }}>
          {stats.map((stat, i) => (
            <div 
              key={i} 
              className="flex flex-col items-center justify-center py-6 border-r last:border-r-0 relative"
              style={{ borderColor: INK }}
            >
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-transparent border-t border-t-transparent" />
              
              <div
                className="text-4xl italic mb-2"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: INK, fontWeight: 500 }}
              >
                {stat.value}
              </div>
              <div
                className="text-[10px] uppercase font-bold tracking-[0.15em]"
                style={{ color: INK, opacity: 0.8 }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </section>

        {/* CONTENTS BAR (Filters) */}
        <section className="flex flex-col md:flex-row md:items-center gap-6 py-4 border-b" style={{ borderColor: INK }}>
          <div className="text-[11px] uppercase font-bold tracking-[0.2em]" style={{ color: ACCENT }}>
            Filed Under:
          </div>
          
          <div className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 absolute left-0" style={{ color: INK, opacity: 0.5 }} />
            <input
              type="text"
              placeholder="Search records..."
              className="w-full bg-transparent border-none outline-none pl-7 text-[14px] italic placeholder:italic"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: INK }}
            />
          </div>

          <div className="flex items-center gap-6">
            <button className="flex items-center gap-2 text-[14px] italic" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: INK }}>
              <span>All Categories</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4" style={{ backgroundColor: INK, opacity: 0.3 }} />
            <button className="flex items-center gap-2 text-[14px] italic" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: INK }}>
              <span>All Status</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        {/* COURSE GRID */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {courses.map((course, i) => {
            const completedModules = Math.round((course.cohort / 100) * course.modules);
            
            return (
              <div
                key={i}
                className="flex flex-col relative group cursor-pointer"
                style={{
                  backgroundColor: BG,
                  border: `1px solid ${INK}`,
                  boxShadow: `4px 4px 0 ${INK}`,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease"
                }}
              >
                {/* Status Kicker */}
                <div className="px-6 pt-5 pb-3 border-b" style={{ borderColor: `${INK}30` }}>
                  <div
                    className="text-[9px] uppercase font-bold tracking-[0.25em] mb-3"
                    style={{ color: ACCENT }}
                  >
                    ◆ {course.status}
                  </div>
                  <h2
                    className="text-xl leading-tight mb-2"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      color: INK,
                    }}
                  >
                    {course.title}{" "}
                    <span className="italic font-medium">{course.emphasis}</span>
                  </h2>
                  <div className="text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: INK, opacity: 0.6 }}>
                    Byline: {course.category}
                  </div>
                </div>

                {/* Module Path (Graph) */}
                <div className="px-6 py-5 border-b" style={{ borderColor: `${INK}30` }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[10px] uppercase font-semibold tracking-[0.1em]" style={{ color: INK }}>
                      Curriculum Path
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: INK, opacity: 0.5 }}>
                      {course.modules} Parts
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: course.modules }).map((_, mi) => {
                      const isCompleted = mi < completedModules;
                      const isCurrent = mi === completedModules;
                      
                      return (
                        <div key={mi} className="flex-1 flex items-center">
                          <div 
                            className="h-2 flex-1 border"
                            style={{ 
                              borderColor: INK,
                              backgroundColor: isCompleted ? INK : isCurrent ? ACCENT : "transparent",
                              opacity: isCompleted ? 1 : isCurrent ? 0.8 : 0.2
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cohort & Bylines */}
                <div className="px-6 py-5 flex-1 flex flex-col justify-between gap-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-[0.1em] mb-1" style={{ color: INK, opacity: 0.6 }}>
                        % Mastered
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span
                          className="text-3xl italic leading-none"
                          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: INK }}
                        >
                          {course.cohort}
                        </span>
                        <span className="text-[14px] italic" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: INK }}>
                          %
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                       <div className="text-[10px] uppercase font-bold tracking-[0.1em] mb-1" style={{ color: INK, opacity: 0.6 }}>
                        Active Cohort
                      </div>
                      <div className="text-[14px] font-medium" style={{ color: INK }}>
                        {course.learners} <span className="opacity-50">readers</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[12px] leading-snug" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: INK }}>
                      <span className="italic font-bold" style={{ color: ACCENT }}>Contributors:</span> {course.bylines.join(" · ")}
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="px-6 py-4 bg-black/5 flex items-center justify-between border-t" style={{ borderColor: `${INK}20`, backgroundColor: '#f0eadf' }}>
                  <div className="text-[10px] uppercase tracking-[0.1em] font-medium" style={{ color: INK, opacity: 0.5 }}>
                    Open Article
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: ACCENT }}>
                    Read Full <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </section>
        
        {/* Footer rule */}
        <div className="w-full h-1 border-t-2 border-b-2 mt-12 py-[1px]" style={{ borderColor: INK, backgroundClip: 'content-box', backgroundColor: 'transparent' }} />
      </div>
    </div>
  );
}
