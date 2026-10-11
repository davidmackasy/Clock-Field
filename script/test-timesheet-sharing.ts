import assert from 'node:assert/strict';
import {timesheetLocation} from '../server/timesheet-location';
import {publicTimesheetSnapshot,renderPublicTimesheet} from '../server/public-timesheet';
const locations=[{id:'olympic',name:'Olympic'},{id:'celtic',name:'Celtic'}];
const schedules=[{employeeId:'a',locationId:'olympic',startDate:'2026-09-01',status:'active',repeatDays:['mon'],scheduledStartTime:'17:00',scheduledEndTime:'22:00'},{employeeId:'a',locationId:'celtic',startDate:'2026-09-01',status:'active',repeatDays:['sat'],scheduledStartTime:'10:00',scheduledEndTime:'14:00'}];
assert.equal(timesheetLocation({employeeId:'a'},'2026-09-21','17:01','22:10',locations,[],schedules,[]),'Olympic');
assert.equal(timesheetLocation({employeeId:'a'},'2026-09-26','10:29','14:07',locations,[],schedules,[]),'Celtic');
assert.equal(timesheetLocation({employeeId:'a',locationId:'celtic'},'2026-09-21','17:01','22:10',locations,[],schedules,[]),'Celtic');
assert.equal(timesheetLocation({employeeId:'other'},'2026-09-21','17:01','22:10',locations,[],schedules,[]),'No assigned location');
const snapshot={company:{name:'Company <safe>',timezone:'America/Winnipeg',contactEmail:'secret@example.com'},period:{start:'2026-09-21',end:'2026-10-04'},employees:[{name:'Employee <script>',employeeNumber:'private-id',hourlyRate:'22',payableMinutes:60,rows:[{id:'private-entry',date:'2026-09-21',day:'Monday',startTime:'17:59',endTime:'18:59',payableMinutes:60,location:'Olympic'}]},{name:'Other Employee'}]};
const shared=publicTimesheetSnapshot(snapshot);const html=renderPublicTimesheet(shared);
assert.ok(html.includes('17:59'));assert.ok(html.includes('Olympic'));assert.ok(html.includes('Employee &lt;script&gt;'));
for(const secret of ['private-entry','secret@example.com','Other Employee','hourlyRate'])assert.ok(!JSON.stringify(shared).includes(secret));
assert.equal(shared.rows.length,1);assert.equal(shared.start,'2026-09-21');assert.equal(shared.end,'2026-10-04');
console.log('PASS: dated employee locations, recorded-location precedence, public employee/period scope, HTML escaping and private field exclusion.');

const {registerPublicTimesheetRoutes}=await import('../server/public-timesheet');
const {pool}=await import('../server/db');const {storage}=await import('../server/storage');
const routes=new Map<string,any>();registerPublicTimesheetRoutes({post:(path:string,...handlers:any[])=>routes.set(path,handlers.at(-1)),get:(path:any,...handlers:any[])=>{for(const item of Array.isArray(path)?path:[path])routes.set(item,handlers.at(-1));}} as any);
for(const [method,value] of Object.entries({getCompany:{id:'company',name:'Company',timezone:'America/Winnipeg',payrollSummaryDays:[2,4]},getEmployeesByCompany:[{id:'employee',firstName:'Employee',lastName:'Test',employeeId:'EMP'}],getTimeEntriesByCompany:[],getAttendanceAdjustmentsByCompany:[],getLocationsByCompany:[],getShiftsByCompany:[],getRecurringSchedulesByCompany:[],getClientsByCompany:[]})) (storage as any)[method]=async()=>value;
let record:any,revoked=false; (pool as any).query=async(sql:string,args:any[])=>{if(sql.startsWith('INSERT')){record=args;return {rowCount:1};}if(sql.startsWith('UPDATE')){assert.equal(args[0],'company');revoked=true;return {rowCount:1};}return {rows:!revoked&&args[0]===record[0]?[{snapshot:JSON.parse(record[5])}]:[]};};
const response=()=>({statusCode:200,result:undefined as any,status(code:number){this.statusCode=code;return this;},json(value:any){this.result=value;return this;},send(value:any){this.result=value;return this;},set(){return this;},type(){return this;}});
const req={user:{companyId:'company',id:'admin'},body:{employeeId:'employee',start:'2026-09-21',end:'2026-10-04'}};
const created=response();await routes.get('/api/admin/attendance/timesheet-share')(req,created);assert.equal(created.statusCode,200);const token=created.result.url.split('/').at(-1);assert.match(token,/^[A-Za-z0-9_-]{22}$/);assert.notEqual(record[0],token);assert.equal(record[1],'company');
const viewed=response();await routes.get('/public/timesheet/:token')({params:{token}},viewed);assert.equal(viewed.statusCode,200);assert.ok(viewed.result.includes('Employee Test'));
await routes.get('/api/admin/attendance/timesheet-share/revoke')(req,response());const removed=response();await routes.get('/public/timesheet/:token')({params:{token}},removed);assert.equal(removed.statusCode,404);
console.log('PASS: share creation, hashed tokens, anonymous read-only access and company-scoped revocation with mocked storage.');

assert.ok(html.includes('data-label="Location"'));assert.ok(html.includes('class="total-label">Total Hours'));assert.ok(routes.has("/t/:token"));

assert.equal(shared.employeeNumber,"private-id");assert.ok(html.includes("Employee number:"));
