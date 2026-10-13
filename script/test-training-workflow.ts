import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { transform } from 'esbuild';
import { trainingState } from '../shared/training-state';
const modules=[{id:'read',isRequired:true},{id:'video',isRequired:false}];
const quiz:any={id:'quiz',isRequired:true,allowRetake:false,passingScore:80,questions:[{id:'q',questionType:'true_false',correctAnswerJson:'true'}]};
assert.equal(trainingState(modules,new Set(['read']),null,false).isCompleted,true);
assert.equal(trainingState(modules,new Set(['read']),quiz,false).isCompleted,false);
assert.equal(trainingState(modules,new Set(['read']),quiz,false).progressPct,90);
assert.equal(trainingState(modules,new Set(['read']),quiz,true).isCompleted,true);
assert.equal(trainingState([{id:'optional'}],new Set(),null,false).isCompleted,false);
assert.equal(trainingState([],new Set(),null,true).isCompleted,false);
assert.equal(trainingState(modules,new Set(['read']),{isRequired:true,questions:[]},false).isCompleted,true);
assert.equal(trainingState(modules,new Set(['foreign']),null,false).completedModules,0);

// Exercise the real route helpers without a production database or notifications.
const source=await fs.readFile('server/routes.ts','utf8');
const start=source.indexOf('  async function buildQuizPayload('),end=source.indexOf('  // GET /api/training/my-courses/:courseId/quiz',start);
const code=(await transform(source.slice(start,end),{loader:'ts'})).code;
let attempts:any[]=[{id:'unfinished',companyId:'company',courseId:'course',employeeId:'employee',completedAt:null,passed:false}];
let progress=[{moduleId:'read'}],writes=0,assigned=true;
const storage:any={getTrainingQuizByCourse:async()=>quiz,getTrainingModules:async()=>modules,getTrainingProgress:async()=>progress,getTrainingQuizAttempts:async()=>attempts,hasPassedTrainingQuiz:async()=>attempts.some(a=>a.passed),getTrainingQuizAttempt:async(id:string)=>attempts.find(a=>a.id===id),getMyTrainingCourse:async()=>assigned?{}:null,createTrainingQuizAttempt:async()=>{throw Error('Must reuse the unfinished attempt');},updateTrainingQuizAttempt:async(id:string,data:any)=>{const a=attempts.find(a=>a.id===id);if(a.completedAt)return undefined;writes++;Object.assign(a,data);return a;}};
const helpers=new Function('storage','trainingNow','scoreTrainingQuestion',`${code};return {buildQuizPayload,startQuizAttempt,submitQuizAttempt};`)(storage,()=>new Date().toISOString(),(q:any,a:any)=>a===JSON.parse(q.correctAnswerJson));
assert.equal((await helpers.buildQuizPayload('course','employee')).canRetake,true);
assert.equal((await helpers.startQuizAttempt('course','company','employee')).attempt.id,'unfinished');
assert.equal((await helpers.submitQuizAttempt('unfinished',{q:true},{employeeId:'wrong',companyId:'company'})).error.status,403);
assert.equal((await helpers.submitQuizAttempt('unfinished',{q:true},{employeeId:'employee',companyId:'foreign'})).error.status,403);
assigned=false;assert.equal((await helpers.submitQuizAttempt('unfinished',{q:true},{employeeId:'employee',companyId:'company'})).error.status,404);assert.equal(writes,0);assigned=true;
assert.equal((await helpers.submitQuizAttempt('unfinished',{q:false},{employeeId:'employee',companyId:'company'})).passed,false);
assert.equal((await helpers.buildQuizPayload('course','employee')).canRetake,false);
assert.equal((await helpers.startQuizAttempt('course','company','employee')).error.status,400);
assert.equal((await helpers.submitQuizAttempt('unfinished',{q:true},{employeeId:'employee',companyId:'company'})).error.status,400);assert.equal(writes,1);
progress=[];assert.equal((await helpers.startQuizAttempt('course','company','employee')).error.status,400);

// Exercise the real learner-access method: same tenant AND published AND assigned.
const storageSource=await fs.readFile('server/storage.ts','utf8');const methodStart=storageSource.indexOf('  async getMyTrainingCourse(courseId:');const methodEnd=storageSource.indexOf('\n  async markModuleComplete',methodStart);
const method=(await transform(`class LearnerStorage {${storageSource.slice(methodStart,methodEnd)}}`,{loader:'ts'})).code;
const table:any={courseId:'courseId',employeeId:'employeeId',companyId:'companyId'};let matchingAssignment=true,published=true;
const fakeDb={select:()=>({from:()=>({where:async()=>matchingAssignment?[{createdAt:'2026-10-12',dueDate:'2026-10-20'}]:[]})})};
const learner=new Function('db','trainingAssignments','and','eq','trainingState',`${method};return new LearnerStorage();`)(fakeDb,table,(...v:any[])=>v,(...v:any[])=>v,trainingState);
Object.assign(learner,{getUser:async()=>({companyId:'company'}),getTrainingCourse:async()=>({id:'course',companyId:'company',isPublished:published}),getTrainingModules:async()=>modules,getTrainingProgress:async()=>[{moduleId:'read'}],getTrainingQuizByCourse:async()=>null,getTrainingCertificate:async()=>null});
assert.equal((await learner.getMyTrainingCourse('course','employee','company')).course.isCompleted,true);
assert.equal(await learner.getMyTrainingCourse('course','employee','foreign'),null);
published=false;assert.equal(await learner.getMyTrainingCourse('course','employee','company'),null);published=true;matchingAssignment=false;assert.equal(await learner.getMyTrainingCourse('course','employee','company'),null);
console.log('PASS: shared completion with optional lessons/certificates/quizzes; empty course handling; quiz resume, retake policy and immutable result; learner/company/published/assignment access before progress or scoring.');
// Real progress endpoint rejects invalid video/module/assignment before writing.
const progressStart=source.indexOf('  app.post("/api/training/my-courses/:courseId/progress/:moduleId"'),progressEnd=source.indexOf('\n  // ── Public Training Routes',progressStart);
let progressHandler:any;const progressCode=(await transform(source.slice(progressStart,progressEnd),{loader:'ts'})).code;
let moduleWrites=0,available=true;
const progressStorage={getTrainingCourse:async()=>({companyId:'company'}),getMyTrainingCourse:async()=>available?{modules:[{id:'video',youtubeEmbedId:'demo'}]}:null,getTrainingProgress:async()=>[],markModuleComplete:async()=>{moduleWrites++;},getTrainingModules:async()=>[{id:'video',isRequired:true}]};
new Function('app','requireAuth','storage','tryIssueTrainingCertificate',progressCode)({post:(_path:any,...handlers:any[])=>progressHandler=handlers.at(-1)},()=>{},progressStorage,async()=>null);
async function progressCall(body:any,moduleId='video'){const req:any={user:{id:'employee',companyId:'company',role:'employee',firstName:'Example',lastName:'Cleaner'},params:{courseId:'course',moduleId},body};const res:any={code:200,status(c:number){this.code=c;return this;},json(body:any){this.body=body;return this;}};await progressHandler(req,res);return res;}
assert.equal((await progressCall({elapsedSeconds:15})).body.code,'VIDEO_REQUIRED');
assert.equal((await progressCall({elapsedSeconds:15,videoDuration:100,videoWatchedSeconds:15})).code,400);
assert.equal((await progressCall({elapsedSeconds:90,videoDuration:100,videoWatchedSeconds:90},'foreign')).code,404);
available=false;assert.equal((await progressCall({elapsedSeconds:90,videoDuration:100,videoWatchedSeconds:90})).code,404);assert.equal(moduleWrites,0);available=true;
assert.equal((await progressCall({elapsedSeconds:90,videoDuration:100,videoWatchedSeconds:90})).code,200);assert.equal(moduleWrites,1);
// Finishing a no-certificate course must still update assignment completion.
const certStart=source.indexOf('  async function tryIssueTrainingCertificate('),certEnd=source.indexOf('  function genPublicId()',certStart);
const certCode=(await transform(source.slice(certStart,certEnd),{loader:'ts'})).code;let statusWrites=0;
const certStorage={getTrainingCourse:async()=>({companyId:'company',certificateEnabled:false}),getTrainingModules:async()=>[{id:'read',isRequired:true}],getTrainingProgress:async()=>[{moduleId:'read'}],getTrainingQuizByCourse:async()=>null};
const finish=new Function('storage','db','trainingAssignments','eq','and','trainingNow','genCertCode',`${certCode};return tryIssueTrainingCertificate;`)(certStorage,{update:()=>({set:()=>({where:async()=>{statusWrites++;}})})},table,(...a:any[])=>a,(...a:any[])=>a,()=>'',()=>'');
assert.equal(await finish({courseId:'course',companyId:'company',employeeId:'employee',learnerName:'Example Cleaner'}),null);assert.equal(statusWrites,1);
console.log('PASS: video completion validation, module ownership, and completion saved even with certificates disabled.');
// The real hub summary counts assignments from required lesson/quiz state, not stale DB status.
const statsStart=storageSource.indexOf('  async getTrainingStats(companyId:'),statsEnd=storageSource.indexOf('\n  async createTrainingModule',statsStart);
const statsMethod=(await transform(`class StatsStorage {${storageSource.slice(statsStart,statsEnd)}}`,{loader:'ts'})).code;
const courseTable={companyId:'companyId'},assignmentTable={companyId:'companyId'},moduleTable={id:'id',isRequired:'isRequired',courseId:'courseId'};
const rows=[{courseId:'course',employeeId:'complete'},{courseId:'course',employeeId:'pending'}];
const statsDb={select:(selection:any)=>({from:(table:any)=>({where:async()=>selection?.count!==undefined?[{count:table===courseTable?1:2}]:table===assignmentTable?rows:[{id:'read',isRequired:true}]})})};
const statsStore=new Function('db','trainingCourses','trainingAssignments','trainingModules','sql','eq','trainingState',`${statsMethod};return new StatsStorage();`)(statsDb,courseTable,assignmentTable,moduleTable,()=> 'count',(...v:any[])=>v,trainingState);
Object.assign(statsStore,{getTrainingQuizByCourse:async()=>null,getTrainingProgress:async(_course:string,employee:string)=>employee==='complete'?[{moduleId:'read'}]:[]});
assert.deepEqual(await statsStore.getTrainingStats('company'),{totalCourses:1,totalAssigned:2,totalCompleted:1,totalPending:1});
console.log('PASS: lightweight live-summary aggregation reports completed/pending assignments from current learning state.');
