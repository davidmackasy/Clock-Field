import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {transform} from 'esbuild';
import {completedChecklistSteps,scheduledAssignmentDue,canAccessWork,canAccessReport,isSupplyRequest,openSupplyRequest} from '../shared/worklog-state';
import {registerWorkSubmissionAccess,registerReportAccess,registerFieldNoteAccess,registerScheduledNoteAccess} from '../server/worklog-access';
import {createAndSubmitReport} from '../client/src/lib/report-actions';
import {dateInZone} from '../shared/time-report';
const company='company',employee={id:'cleaner',companyId:company,role:'employee'},admin={id:'admin',companyId:company,role:'admin'},client={id:'client-user',companyId:company,role:'client'};
assert.equal(canAccessWork({companyId:company,employeeId:employee.id},employee),true);assert.equal(canAccessWork({companyId:'other',employeeId:employee.id},employee),false);assert.equal(canAccessWork({companyId:company,employeeId:employee.id},client),false);
const report={id:'report',companyId:company,createdByUserId:'admin',assignedEmployeeId:'cleaner',sentToEmployee:true,assignedClientId:'customer',sentToClient:true,status:'sent'};
assert.equal(canAccessReport(report,employee),true);assert.equal(canAccessReport(report,{...employee,id:'another'}),false);assert.equal(canAccessReport(report,client,'customer'),true);assert.equal(canAccessReport({...report,sentToClient:false},client,'customer'),false);
const required=[{id:'one',isRequired:true},{id:'two',isRequired:true},{id:'optional',isRequired:false}];
assert.deepEqual(completedChecklistSteps(required,[{stepId:'one',submittedImageUrl:'photo'},{stepId:'one',submittedImageUrl:'retake'},{stepId:'foreign',submittedImageUrl:'photo'},{stepId:'two',submittedImageUrl:''}]),{total:2,completed:1,missing:1});
assert.deepEqual(completedChecklistSteps(required,[{stepId:'one',submittedImageUrl:'photo'},{stepId:'two',submittedImageUrl:'photo'}]),{total:2,completed:2,missing:0});
const assignment={id:'assignment',companyId:company,cleanerId:'cleaner',scheduleId:'schedule',status:'active'},schedule={id:'schedule',employeeId:'cleaner',status:'active',startDate:'2026-09-21',repeatDays:['Monday'],repeatFrequency:'biweekly'};
assert.equal(scheduledAssignmentDue(assignment,schedule,'2026-10-05',[]),true);assert.equal(scheduledAssignmentDue(assignment,schedule,'2026-10-12',[]),false);assert.equal(scheduledAssignmentDue(assignment,schedule,'2026-10-05',[{recurringScheduleId:'schedule',shiftDate:'2026-10-05',status:'cancelled'}]),false);
assert.equal(dateInZone('2026-10-13T03:30:00Z','America/Winnipeg'),'2026-10-12');assert.equal(dateInZone('2026-11-02T05:30:00Z','America/Winnipeg'),'2026-11-01');
assert.equal(isSupplyRequest({requestedQuantity:2,inventoryItemId:'stock',status:'partially_fulfilled'}),true);assert.equal(openSupplyRequest({requestedQuantity:2,inventoryItemId:'stock',status:'fulfilled'}),false);assert.equal(openSupplyRequest({inventoryItemId:'stock',status:'in_stock'}),false);
const requests:any[]=[];const request:any=async(method:string,url:string,data:any)=>{requests.push({method,url,data});return Response.json(url.endsWith('/submit')?{id:'sample',status:'submitted'}:{id:'sample',status:'draft'});};
assert.equal((await createAndSubmitReport({title:'Sample cleaner report'},request)).status,'submitted');assert.deepEqual(requests.map(r=>r.url),['/api/reports','/api/reports/sample/submit']);
await assert.rejects(createAndSubmitReport({},async()=>Response.json({message:'invalid'})),/could not be created/);
console.log('PASS: company/role access, unique required photo counts, local/DST work dates, schedule due and cancellation rules, fulfilled supply history, actual create-and-submit report helper.');
let mounted:any[]=[];const app={use:(path:string,...handlers:any[])=>mounted.push({path,handler:handlers.at(-1)})};
let writes=0;const storage:any={getWorkSubmission:async(id:string)=>({id,companyId:id==='sub'?company:'foreign',employeeId:'cleaner'}),getWorkSubmissionItem:async()=>({id:'item',submissionId:'foreign'}),getWorkSubmissionPhoto:async()=>({submissionItemId:'item'}),getReport:async()=>report,getClientsByCompany:async()=>[{id:'customer',userId:client.id}],getFieldNotesTodo:async()=>({sessionId:'session'}),getFieldNotesSession:async()=>({companyId:company,createdByUserId:'another'}),getScheduledFieldNoteSection:async()=>({companyId:'foreign'})};
const auth=()=>{};registerWorkSubmissionAccess(app,storage,auth);registerReportAccess(app,storage,auth);registerFieldNoteAccess(app,storage,auth);registerScheduledNoteAccess(app,storage,()=>auth);
function response(){return {code:200,body:null as any,status(code:number){this.code=code;return this;},json(body:any){this.body=body;return this;}};}
async function gate(path:string,user:any,params:any,method='GET'){const res=response();let next=false;await mounted.find(m=>m.path===path).handler({user,params,method},res,()=>next=true);return{...res,next};}
assert.equal((await gate('/api/work-submissions/:id',client,{id:'sub'})).next,false);
assert.equal((await gate('/api/work-submissions/:id/items/:itemId',employee,{id:'sub',itemId:'item'})).next,false);
assert.equal((await gate('/api/work-submission-photos/:photoId/image',employee,{photoId:'photo'})).next,false);
assert.equal((await gate('/api/reports/:id',{...employee,id:'wrong'},{id:'report'},'PATCH')).next,false);
assert.equal((await gate('/api/reports/:id',client,{id:'report'})).next,true);
assert.equal((await gate('/api/field-notes/todos/:recordId',employee,{recordId:'todo'},'PATCH')).next,false);
assert.equal((await gate('/api/admin/scheduled-field-notes/sections/:recordId',admin,{recordId:'section'},'DELETE')).next,false);
console.log('PASS: actual middleware blocks unrelated photos/items, report writes, another cleaner’s notes, and cross-company scheduled records before route side effects.');
const source=await fs.readFile('server/routes.ts','utf8');
async function route(method:string,path:string,extra:any={}){
 const start=source.indexOf(`  app.${method}("${path}"`),end=source.indexOf('\n  app.',start+5);assert.ok(start>=0,path);
 let handler:any;const app:any={[method]:(_path:any,...args:any[])=>handler=args.at(-1)};
 const deps={app,storage,requireRole:()=>auth,requireAuth:auth,dateInZone,scheduledAssignmentDue,completedChecklistSteps,logReportActivity:async()=>{},...extra};
 const code=(await transform(source.slice(start,end),{loader:'ts'})).code;
 new Function(...Object.keys(deps),code)(...Object.values(deps));return handler;
}
Object.assign(storage,{getScheduledFieldNoteSubmission:async()=>({id:'sub',companyId:company,cleanerId:'cleaner',templateId:'template',status:'in_progress'}),getScheduledFieldNoteSections:async()=>[{id:'section'}],getScheduledFieldNoteStepById:async()=>({id:'foreign',companyId:company,sectionId:'another'}),saveScheduledFieldNotePhoto:async()=>{writes++;},getScheduledFieldNoteStepsBySection:async()=>required,getScheduledFieldNoteStepSubmissions:async()=>[{stepId:'one',submittedImageUrl:'photo'},{stepId:'one',submittedImageUrl:'duplicate'}],updateScheduledFieldNoteSubmission:async()=>{writes++;}});
let res=response();await(await route('post','/api/employee/scheduled-field-notes/submissions/:id/steps/:stepId'))({user:employee,params:{id:'sub',stepId:'foreign'},body:{imageUrl:'data:image/jpeg;base64,YWJj'}},res);assert.equal(res.code,404);assert.equal(writes,0);
res=response();await(await route('post','/api/employee/scheduled-field-notes/submissions/:id/complete'))({user:employee,params:{id:'sub'},body:{}},res);assert.equal(res.code,400);assert.equal(res.body.missing,1);assert.equal(writes,0);
Object.assign(storage,{getScheduledFieldNoteAssignmentsByCleaner:async()=>[{...assignment,scheduleId:null}],getCompany:async()=>({timezone:'America/Winnipeg'}),getActiveTimeEntry:async()=>({clockInAt:'2026-10-13T03:30:00Z'}),getShiftsByEmployee:async()=>[],getScheduledFieldNoteTemplate:async()=>({id:'template',companyId:company,status:'active'}),getScheduledFieldNoteSubmissionByAssignmentAndDate:async()=>null,getClientsByCompany:async()=>[]});
res=response();await(await route('get','/api/employee/scheduled-field-notes/today'))({user:employee,params:{},body:{}},res);assert.equal(res.code,200);assert.equal(res.body[0].today,'2026-10-12');assert.equal(res.body[0].template.requiredStepCount,2);
console.log('PASS: actual scheduled-photo route rejects a foreign step; completion cannot be bypassed with duplicate photos; today route uses the active work day in company time. No production records or messages were created.');
// Exercise the real allocation route with a serialized transaction fixture.
const inventoryTable:any={id:'id',companyId:'companyId'},supplyTable:any={id:'id',companyId:'companyId',inventoryItemId:'inventoryItemId',locationId:'locationId',isActive:'isActive',requestedQuantity:'requestedQuantity'},expenseTable={},movementTable={};
let stock=5,locks=0,commits=0,failMovement=false,sequence=Promise.resolve();
const transactionalDb={transaction:async(callback:any)=>{
 const previous=sequence;let release:any;sequence=new Promise<void>(r=>release=r);await previous;
 let localStock=stock;
 const tx={select:()=>({from:(table:any)=>({where:()=>({then:(resolve:any,reject:any)=>Promise.resolve(table===inventoryTable?[{id:'stock',companyId:company,name:'Soap',category:'Cleaning',currentQuantity:localStock,lowStockThreshold:1,unitPrice:'3.00'}]:[]).then(resolve,reject),for:async()=>{locks++;return[{id:'stock',companyId:company,name:'Soap',category:'Cleaning',currentQuantity:localStock,lowStockThreshold:1,unitPrice:'3.00'}];}})})}),update:(table:any)=>({set:(data:any)=>({where:async()=>{if(table===inventoryTable)localStock=data.currentQuantity;}})}),insert:(table:any)=>({values:(data:any)=>{if(table===movementTable&&failMovement)throw Error('Simulated movement write failure');return{returning:async()=>[{id:'expense',...data}]};}})};
 try{const result=await callback(tx);stock=localStock;commits++;return result;}finally{release();}
}};
storage.getLocation=async()=>({id:'location',companyId:company});
const allocation=await route('post','/api/supplies/inventory/:id/assign-location',{db:transactionalDb,inventoryItems:inventoryTable,supplies:supplyTable,locationSupplyExpenses:expenseTable,inventoryMovements:movementTable,supplyUpdates:{},eq:(...v:any[])=>v,and:(...v:any[])=>v,isNull:(v:any)=>v});
const allocationRequest:any={user:admin,params:{id:'stock'},body:{locationId:'location',quantity:'4'}};
const first=response(),second=response();await Promise.all([allocation(allocationRequest,first),allocation(allocationRequest,second)]);
assert.deepEqual([first.code,second.code].sort(),[200,400]);assert.equal(stock,1);assert.equal(commits,1);assert.equal(locks,2);
stock=5;failMovement=true;res=response();await allocation({...allocationRequest,body:{locationId:'location',quantity:'1'}},res);assert.equal(res.code,500);assert.equal(stock,5);assert.equal(commits,1);
failMovement=false;res=response();await allocation({...allocationRequest,body:{locationId:'location',quantity:'1.5'}},res);assert.equal(res.code,400);assert.equal(stock,5);
console.log('PASS: actual inventory route serializes competing allocations, prevents over-allocation, rejects fractional units, and rolls back stock when its movement record fails.');
const {reportNeedsSignature}=await import('../shared/worklog-state');
assert.equal(reportNeedsSignature({status:'in_review',requiresEmployeeSignature:true,signatureRoles:['employee']}),false);
assert.equal(reportNeedsSignature({status:'in_review',requiresEmployeeSignature:true,requiresAdminSignature:true,signatureRoles:['employee']}),true);
assert.equal(reportNeedsSignature({status:'in_review',requiresEmployeeSignature:true,requiresAdminSignature:true,signatureRoles:['employee']},'employee'),false);
assert.equal(reportNeedsSignature({status:'finalized',requiresEmployeeSignature:true,signatureRoles:[]}),false);
console.log('PASS: Needs Signature / Needs Action counts exclude signatures already supplied and locked reports.');
Object.assign(storage,{getScheduledFieldNoteSection:async()=>({id:'section',companyId:company,templateId:'template'}),getScheduledFieldNoteSubmissions:async()=>[{templateId:'template',assignmentId:'assignment'}]});
assert.equal((await gate('/api/admin/scheduled-field-notes/sections/:recordId',admin,{recordId:'section'},'DELETE')).code,409);
console.log('PASS: historical checklist steps cannot be deleted after a recorded submission.');
