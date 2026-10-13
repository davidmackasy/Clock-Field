import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Clock, CheckCircle2, Play, Loader2, Award, ArrowLeft, Lock, ClipboardList, Search, ChevronRight, AlertCircle } from "lucide-react";
import { QuizRunner, type QuizPayload, type QuizSubmitResult } from "@/components/training/quiz-runner";
import { AudioPlayer } from "@/components/training/audio-player";
import { CourseVideo } from "@/components/training/course-video";
import { LessonBlocks, buildLessonScript, type LessonBlock } from "@/components/training/lesson-blocks";
import { downloadCertificate } from "@/lib/certificate";

type Course = { id: string; title: string; description: string | null; category: string | null; thumbnailData: string | null; isRequired: boolean; estimatedDuration: string | null; certificateEnabled: boolean; totalModules: number; completedModules: number; progressPct: number; isCompleted: boolean; modulesComplete: boolean; hasQuiz: boolean; quizRequired: boolean; quizPending: boolean; quizPassed: boolean; status: string; dueDate?: string | null; certificate: { certificateCode: string; issuedAt: string; learnerName: string } | null };
type Module = { id: string; title: string; description: string | null; youtubeEmbedId: string | null; lessonText: string | null; sortOrder: number; isRequired: boolean; assets: { id: string; assetData: string; sortOrder: number }[]; blocks?: LessonBlock[]; completed: boolean };
type CourseView = { course: Course; modules: Module[] };
function dateLabel(value: string) { return new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }

export default function EmployeeTraining() {
  const { toast } = useToast();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('course'));
  const [selectedModuleIdx, setSelectedModuleIdx] = useState(0);
  const [search, setSearch] = useState(''), [filter, setFilter] = useState('all');
  const [seconds, setSeconds] = useState<Record<string, number>>({});
  const [watch, setWatch] = useState<Record<string, {watchedSeconds:number;duration:number}>>({});
  const { data: myCourses = [], isLoading, isError, refetch } = useQuery<Course[]>({ queryKey: ['/api/training/my-courses'], refetchInterval:30000 });
  const { data: courseView, isLoading: courseLoading, isError: courseError, refetch: reloadCourse } = useQuery<CourseView>({ queryKey: ['/api/training/my-courses', selectedCourseId], enabled: !!selectedCourseId, refetchInterval:30000 });
  const { data: quizPayload, isLoading: quizLoading, isError: quizError, refetch: reloadQuiz } = useQuery<QuizPayload | null>({
    queryKey: ['/api/training/my-courses', selectedCourseId, 'quiz'], enabled: !!selectedCourseId,
    queryFn: async () => { const r = await fetch(`/api/training/my-courses/${selectedCourseId}/quiz`); if(r.status===404) return null; if(!r.ok)throw Error('Could not load quiz'); return r.json(); }, retry:false,
  });
  const refresh = async () => { await queryClient.invalidateQueries({queryKey:['/api/training/my-courses']}); await queryClient.invalidateQueries({queryKey:['/api/training/my-reminder']}); };
  const openCourse = (id: string | null) => { setSelectedCourseId(id); setSelectedModuleIdx(0); window.history.replaceState(null,'',id ? `?course=${encodeURIComponent(id)}` : window.location.pathname); };
  useEffect(() => {
    if(!courseView) return;
    const first = courseView.modules.findIndex(m=>!m.completed);
    setSelectedModuleIdx(first >= 0 ? first : courseView.course.quizPending ? courseView.modules.length : 0);
  }, [selectedCourseId, courseView?.course.id]);
  const module = courseView?.modules[selectedModuleIdx];
  useEffect(() => {
    if(!module || module.completed || module.youtubeEmbedId) return;
    const timer = setInterval(()=>{ if(document.visibilityState==='visible') setSeconds(s=>({...s,[module.id]:(s[module.id]||0)+1})); },1000);
    return ()=>clearInterval(timer);
  },[module?.id,module?.completed]);
  const complete = useMutation({
    mutationFn: async (mod: Module) => { const viewing=watch[mod.id]; const r=await apiRequest('POST',`/api/training/my-courses/${selectedCourseId}/progress/${mod.id}`,{elapsedSeconds:mod.youtubeEmbedId ? viewing?.watchedSeconds : seconds[mod.id],videoWatchedSeconds:viewing?.watchedSeconds,videoDuration:viewing?.duration}); return r.json(); },
    onSuccess: async () => { await refresh(); toast({title:'Lesson completed'}); const next=courseView?.modules.findIndex((m,i)=>i>selectedModuleIdx&&!m.completed) ?? -1; if(next>=0)setSelectedModuleIdx(next);else if(quizPayload)setSelectedModuleIdx(courseView!.modules.length); },
    onError: (e:any)=>toast({title:'Could not save progress',description:e.message,variant:'destructive'}),
  });
  const startQuiz = async () => {const r=await apiRequest('POST',`/api/training/my-courses/${selectedCourseId}/quiz/start`);return r.json();};
  const submitQuiz = async (id:string,answers:Record<string,any>):Promise<QuizSubmitResult> => {const r=await apiRequest('POST',`/api/training/quiz-attempts/${id}/submit`,{answers});const result=await r.json();await refresh();return result;};
  const certificate = (course:Course)=>course.certificate&&downloadCertificate({name:course.certificate.learnerName,courseTitle:course.title,certificateCode:course.certificate.certificateCode,issuedAt:course.certificate.issuedAt});

  if(selectedCourseId) {
    if(courseLoading) return <div className="flex justify-center p-16"><Loader2 className="animate-spin" aria-label="Loading course" /></div>;
    if(courseError || !courseView) return <div className="p-6 space-y-4"><Button variant="ghost" onClick={()=>openCourse(null)}><ArrowLeft className="mr-2 h-4 w-4"/>My learning</Button><p role="alert">This course is unavailable or could not load.</p><Button onClick={()=>reloadCourse()}>Try again</Button></div>;
    const {course,modules}=courseView;
    const isQuiz=selectedModuleIdx===modules.length && !!quizPayload;
    const mod=isQuiz ? undefined : module;
    const watched=mod ? watch[mod.id] : undefined;
    const ready=!!mod && (mod.completed || (mod.youtubeEmbedId ? !!watched && watched.duration>0 && watched.watchedSeconds >= Math.max(Math.min(15,watched.duration),watched.duration*.9) : (seconds[mod.id]||0)>=15));
    const outline=<div className="rounded-xl border bg-card overflow-hidden"><div className="p-4 border-b"><h2 className="font-semibold">Course content</h2><p className="text-xs text-muted-foreground mt-1">{course.completedModules} of {modules.length} lessons complete</p></div>{modules.map((m,i)=><button type="button" key={m.id} aria-current={i===selectedModuleIdx?'step':undefined} onClick={()=>setSelectedModuleIdx(i)} className={`w-full text-left flex gap-3 p-4 border-b last:border-b-0 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary ${i===selectedModuleIdx?'bg-primary/10':''}`} data-testid={`lesson-${m.id}`}><span className="shrink-0 mt-0.5">{m.completed?<CheckCircle2 className="h-5 w-5 text-green-600"/>:m.youtubeEmbedId?<Play className="h-5 w-5 text-muted-foreground"/>:<BookOpen className="h-5 w-5 text-muted-foreground"/>}</span><span className="min-w-0"><span className="block text-sm font-medium break-words">{i+1}. {m.title}</span><span className="text-xs text-muted-foreground">{m.completed?'Completed':m.youtubeEmbedId?'Video lesson':'Read or listen'}{!m.isRequired?' · Optional':''}</span></span></button>)}{quizPayload&&<button type="button" onClick={()=>setSelectedModuleIdx(modules.length)} className={`w-full p-4 flex gap-3 text-left hover:bg-muted ${isQuiz?'bg-primary/10':''}`} data-testid="lesson-quiz">{quizPayload.hasPassed?<CheckCircle2 className="h-5 w-5 text-green-600"/>:!quizPayload.modulesComplete?<Lock className="h-5 w-5"/>:<ClipboardList className="h-5 w-5"/>}<span className="text-sm font-medium">Final quiz<span className="block text-xs font-normal text-muted-foreground">{quizPayload.hasPassed?'Passed':course.quizRequired?'Required to complete':'Optional practice'}</span></span></button>}</div>;
    return <div className="min-w-0 pb-24">
      <header className="bg-slate-950 text-white p-5 sm:p-7"><button onClick={()=>openCourse(null)} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white mb-4" data-testid="back-to-learning"><ArrowLeft className="h-4 w-4"/>My learning</button><div className="text-xs text-slate-300 mb-2">{course.category || 'Training'}{course.dueDate?` · Due ${dateLabel(course.dueDate)}`:''}</div><h1 className="text-xl sm:text-2xl font-bold break-words">{course.title}</h1><div className="mt-4 flex items-center gap-3"><div className="h-2 bg-white/20 rounded-full flex-1 max-w-md overflow-hidden" role="progressbar" aria-label="Course progress" aria-valuenow={course.progressPct} aria-valuemin={0} aria-valuemax={100}><div className="bg-blue-400 h-full" style={{width:`${course.progressPct}%`}}/></div><span className="text-sm">{course.progressPct}%</span></div></header>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
        <main className="min-w-0 space-y-5">
          {course.isCompleted&&<div className="p-4 rounded-xl bg-green-50 border border-green-200 flex flex-wrap items-center gap-3"><CheckCircle2 className="h-6 w-6 text-green-600"/><div className="flex-1"><h2 className="font-semibold">Training complete</h2><p className="text-sm text-muted-foreground">Your manager can see your saved completion.</p></div>{course.certificateEnabled&&course.certificate&&<Button variant="outline" onClick={()=>certificate(course)}><Award className="mr-2 h-4 w-4"/>Certificate</Button>}</div>}
          {quizError&&<div role="alert" className="p-4 border rounded-lg">Could not load the course quiz. <Button variant="outline" size="sm" onClick={()=>reloadQuiz()}>Retry</Button></div>}
          {isQuiz&&quizPayload?<QuizRunner key={quizPayload.quiz.id} payload={quizPayload} onStart={startQuiz} onSubmit={submitQuiz} onPassed={()=>refresh()}/>:mod?<>
            {mod.youtubeEmbedId&&<div className="rounded-xl overflow-hidden border"><CourseVideo key={mod.id} videoId={mod.youtubeEmbedId} title={mod.title} onWatch={value=>setWatch(w=>({...w,[mod.id]:value}))}/></div>}
            <div><p className="text-xs text-muted-foreground">Lesson {selectedModuleIdx+1} of {modules.length}</p><h2 className="text-xl font-semibold mt-1">{mod.title}</h2>{mod.description&&<p className="mt-2 text-sm text-muted-foreground">{mod.description}</p>}</div>
            {!mod.youtubeEmbedId&&(mod.lessonText||mod.blocks?.length)&&<AudioPlayer text={buildLessonScript({title:mod.title,description:mod.description,lessonText:mod.lessonText,blocks:mod.blocks})} title={mod.title} moduleId={mod.id}/>}
            <LessonBlocks blocks={mod.blocks} fallbackText={mod.lessonText} fallbackAssets={mod.assets}/>
            {!mod.completed&&<p className="text-sm text-muted-foreground" aria-live="polite">{mod.youtubeEmbedId ? ready?'Video reviewed. Save this lesson to continue.':`Watch the lesson before completing it.${watched?.duration?` ${Math.min(100,Math.round(watched.watchedSeconds/watched.duration*100))}% watched.`:''}` : ready?'Finished reading or listening? Save this lesson to continue.':`Review this lesson · ${Math.max(0,15-(seconds[mod.id]||0))} seconds remaining`}</p>}
            <div className="flex flex-wrap gap-3 border-t pt-4"><Button variant="outline" disabled={selectedModuleIdx===0} onClick={()=>setSelectedModuleIdx(i=>i-1)}>Previous</Button>{!mod.completed?<Button disabled={!ready||complete.isPending||quizLoading||quizError} onClick={()=>complete.mutate(mod)} data-testid="complete-lesson">{complete.isPending&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Complete lesson <ChevronRight className="ml-2 h-4 w-4"/></Button>:selectedModuleIdx<modules.length-1?<Button onClick={()=>setSelectedModuleIdx(i=>i+1)}>Next lesson</Button>:quizPayload?<Button onClick={()=>setSelectedModuleIdx(modules.length)}>Go to quiz</Button>:<Button variant="outline" onClick={()=>openCourse(null)}>Back to my learning</Button>}</div>
          </>:<div className="p-6 border rounded-xl">Your manager has not added any lessons yet.</div>}
        </main><aside className="min-w-0 lg:sticky lg:top-4 self-start">{outline}</aside>
      </div></div>;
  }
  const visible=myCourses.filter(c=>(filter==='all'||(filter==='completed'?c.isCompleted:!c.isCompleted))&&`${c.title} ${c.category||''}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="p-4 sm:p-6 pb-24 max-w-7xl mx-auto min-w-0">
    <header className="mb-6"><p className="text-xs uppercase tracking-wide text-primary font-semibold">Training hub</p><h1 className="text-2xl sm:text-3xl font-bold mt-1">My learning</h1><p className="text-muted-foreground mt-2 text-sm">Your assigned training, lessons and certificates in one place.</p></header>
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6"><div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Filter courses">{[['all','All courses'],['pending','To complete'],['completed','Completed']].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)} className={`px-3 py-2 rounded-md text-sm ${filter===value?'bg-background shadow-sm font-semibold':''}`}>{label}</button>)}</div><label className="flex items-center gap-2 border rounded-lg p-2 w-full sm:w-64"><Search className="h-4 w-4 text-muted-foreground"/><input aria-label="Search assigned courses" placeholder="Search your courses" value={search} onChange={e=>setSearch(e.target.value)} className="bg-transparent w-full min-w-0 text-sm outline-none"/></label></div>
    {isLoading?<div className="flex justify-center p-16"><Loader2 className="animate-spin" aria-label="Loading assigned courses"/></div>:isError?<div role="alert" className="p-6 border rounded-xl"><AlertCircle className="h-6 w-6 text-destructive mb-2"/><p>Could not load your assigned training.</p><Button className="mt-3" onClick={()=>refetch()}>Try again</Button></div>:!visible.length?<div className="text-center p-12 border border-dashed rounded-xl"><BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3"/><h2 className="font-semibold">{myCourses.length?'No matching courses':'No training assigned yet'}</h2><p className="text-muted-foreground text-sm mt-2">{myCourses.length?'Try another filter or search.':'Training will appear here when your manager assigns it.'}</p></div>:<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{visible.map(course=><button type="button" key={course.id} onClick={()=>openCourse(course.id)} className="group text-left rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow focus-visible:ring-2 focus-visible:ring-primary" data-testid={`course-${course.id}`}>
      <div className="aspect-video bg-slate-100 relative">{course.thumbnailData?<img src={course.thumbnailData} alt="" className="w-full h-full object-cover"/>:<div className="h-full flex items-center justify-center"><BookOpen className="h-12 w-12 text-primary/40"/></div>}<div className="absolute left-3 top-3 flex gap-2">{course.isRequired&&<Badge>Required</Badge>}{course.isCompleted&&<Badge className="bg-green-700">Completed</Badge>}</div></div>
      <div className="p-4 space-y-3"><p className="text-xs text-muted-foreground">{course.category||'Training'}</p><h2 className="font-semibold text-base line-clamp-2 min-h-[3rem]">{course.title}</h2><div className="flex flex-wrap gap-3 text-xs text-muted-foreground"><span>{course.totalModules} lessons</span>{course.estimatedDuration&&<span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{course.estimatedDuration}</span>}{course.hasQuiz&&<span>Quiz included</span>}</div>{course.dueDate&&<p className="text-xs">Due {dateLabel(course.dueDate)}</p>}<div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{width:`${course.progressPct}%`}}/></div><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{course.quizPending?'Quiz required':`${course.progressPct}% complete`}</span><span className="font-semibold text-primary">{course.isCompleted?'Review course':course.completedModules?'Continue learning':'Start course'} →</span></div></div></button>)}</div>}
  </div>;
}
