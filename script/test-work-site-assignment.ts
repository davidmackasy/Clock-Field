import assert from 'node:assert/strict';
import {clockInAssignedLocationIds,recurringAssignmentOnDate} from '../shared/work-site-assignment';
import {clockInSite,verifyClockInLocation} from '../server/clock-in-location';
import {timesheetLocationDetails} from '../server/timesheet-location';

const user={id:'cleaner-a',companyId:'company'},other={id:'cleaner-b',companyId:'company'};
const locations=[{id:'olympic',name:'Olympic',companyId:'company'},{id:'ash',name:'Ash Grove',companyId:'company'},{id:'warehouse',name:'Warehouse',companyId:'company'}];
const schedules=[
 {companyId:'company',employeeId:user.id,locationId:'olympic',status:'active',startDate:'2026-05-11',repeatDays:['mon','tue','wed','thu','fri'],scheduledStartTime:'17:00',scheduledEndTime:'22:15'},
 {companyId:'company',employeeId:user.id,locationId:'ash',status:'active',startDate:'2026-03-14',repeatDays:['sat'],scheduledStartTime:'09:30',scheduledEndTime:'12:00'},
 {companyId:'company',employeeId:other.id,locationId:'warehouse',status:'active',startDate:'2026-01-01',repeatDays:['mon'],scheduledStartTime:'08:00',scheduledEndTime:'16:00'},
];
assert.deepEqual([...clockInAssignedLocationIds([],schedules,user,'2026-10-19','17:00')],['olympic']);
assert.deepEqual([...clockInAssignedLocationIds([],schedules,user,'2026-10-24','10:00')],['ash']);
assert.deepEqual([...clockInAssignedLocationIds([],schedules,user,'2026-10-25','10:00')],[],'Saturday assignment must not silently become Sunday');
assert.deepEqual([...clockInAssignedLocationIds([],schedules,other,'2026-10-19','10:00')],['warehouse'],'Every employee uses their own assignments');
assert.deepEqual([...clockInAssignedLocationIds([],schedules,{...user,companyId:'foreign'},'2026-10-19','17:00')],[]);
assert.equal(recurringAssignmentOnDate({...schedules[0],repeatFrequency:'biweekly',startDate:'2026-10-19'},'2026-10-26'),false);
assert.equal(recurringAssignmentOnDate({...schedules[0],repeatFrequency:'biweekly',startDate:'2026-10-19'},'2026-11-02'),true);
assert.equal(recurringAssignmentOnDate({...schedules[0],endDate:'2026-10-18'},'2026-10-19'),false);
assert.equal(recurringAssignmentOnDate({...schedules[0],status:'inactive'},'2026-10-19'),false);
const overnight={...schedules[0],repeatDays:['mon'],scheduledStartTime:'22:00',scheduledEndTime:'06:00'};
assert.deepEqual([...clockInAssignedLocationIds([],[overnight],user,'2026-10-20','02:00')],['olympic']);
assert.deepEqual([...clockInAssignedLocationIds([],[overnight],user,'2026-10-20','07:00')],[]);
const storage:any={getCompany:async()=>({allowUnscheduledClockIns:true,timezone:'America/Winnipeg'}),getLocationsByCompany:async()=>locations,getShiftsByEmployee:async()=>[],getRecurringSchedulesByEmployee:async()=>schedules};
const monday=new Date('2026-10-19T22:00:00Z'),saturday=new Date('2026-10-24T15:00:00Z');
assert.equal((await clockInSite(storage,user,{},monday)).site.id,'olympic','A single assigned site is carried into attendance automatically');
await assert.rejects(clockInSite(storage,user,{locationId:'ash'},monday),/work day/,'Reject weekend site on weekday even when forged directly');
await assert.rejects(clockInSite(storage,user,{locationId:'olympic'},saturday),/work day/);
assert.equal((await clockInSite(storage,user,{locationId:'ash'},saturday)).site.id,'ash');
assert.equal((await clockInSite(storage,other,{},monday)).site.id,'warehouse');
storage.getShift=async()=>({id:'wrong-day',companyId:user.companyId,employeeId:user.id,locationId:'ash',status:'scheduled',shiftDate:'2026-10-24'});
await assert.rejects(clockInSite(storage,user,{shiftId:'wrong-day'},monday),/not scheduled for this work day/);
const entry={employeeId:user.id,locationId:'ash'};
const mondaySite=timesheetLocationDetails(entry,'2026-10-19','17:00','22:15',locations,[],schedules,[]);
assert.equal(mondaySite.location,'Olympic');assert.equal(mondaySite.recordedLocation,'Ash Grove');assert.equal(mondaySite.locationSource,'assignment');
assert.ok(mondaySite.locationWarning.includes('Clock-in selected Ash Grove'));
assert.equal(entry.locationId,'ash','Original historical attendance is never rewritten');
assert.equal(timesheetLocationDetails(entry,'2026-10-24','15:00','18:00',locations,[],schedules,[]).location,'Ash Grove');
assert.equal(timesheetLocationDetails({...entry,employeeId:other.id},'2026-10-19','08:00','16:00',locations,[],schedules,[]).location,'Warehouse');
const verified=timesheetLocationDetails({...entry,clockInLocationCheck:{checkedAt:'2026-10-19T22:00:00Z'}},'2026-10-19','17:00','22:15',locations,[],schedules,[]);
assert.equal(verified.location,'Ash Grove');assert.equal(verified.locationSource,'verified');assert.ok(verified.locationWarning.includes('location verified'));
const splitSchedules=[{...schedules[0],scheduledStartTime:'09:00',scheduledEndTime:'12:00'},{...schedules[0],locationId:'ash',scheduledStartTime:'13:00',scheduledEndTime:'17:00'}];
assert.equal(timesheetLocationDetails({employeeId:user.id},'2026-10-19','09:00','12:00',locations,[],splitSchedules,[]).location,'Olympic');
assert.equal(timesheetLocationDetails({employeeId:user.id},'2026-10-19','13:00','17:00',locations,[],splitSchedules,[]).location,'Ash Grove');
assert.ok(timesheetLocationDetails({employeeId:user.id},'2026-10-19','09:00','17:00',locations,[],splitSchedules,[]).locationWarning.includes('Multiple assigned sites'));
assert.equal(timesheetLocationDetails({employeeId:user.id},'2026-10-25','08:00','14:00',locations,[],schedules,[]).location,'No assigned location');

const nonGps=await verifyClockInLocation({...storage,getRecurringSchedulesByEmployee:async()=>[{...schedules[0],repeatDays:['mon','tue','wed','thu','fri','sat','sun']}]},user,{locationId:'olympic'});
assert.equal(nonGps.check.assignmentVerified,true);assert.equal(nonGps.check.assignedLocationId,'olympic');assert.equal(nonGps.check.assignedLocationName,'Olympic');assert.equal(nonGps.check.distanceMeters,undefined,'Assignment validation must not pretend to be GPS verification');
const frozen=timesheetLocationDetails({...entry,locationId:'olympic',clockInLocationCheck:nonGps.check},'2026-10-19','17:00','22:15',locations,[],[{...schedules[0],locationId:'ash'}],[]);
assert.equal(frozen.location,'Olympic','Later schedule edits cannot rewrite the site validated at clock-in');
assert.equal(frozen.locationSource,'clock_in_assignment');
storage.getShift=async()=>({companyId:user.companyId,employeeId:user.id,status:'scheduled',shiftDate:'2026-10-19',locationId:null});
assert.equal((await clockInSite({...storage,getLocationsByCompany:async()=>[]},user,{shiftId:'legacy'},monday)).site,undefined,'Tenants without configured work sites keep their dated shift workflow');
await assert.rejects(clockInSite(storage,user,{shiftId:'legacy'},monday),/needs an assigned work site/);
console.log('PASS: per-employee/company/day site allocation, weekday/weekend and biweekly rules, expired/inactive schedules, overnight clock-in, server rejection of wrong-day sites, automatic single-site allocation, assignment-based historical reports with original selections preserved, verified-site conflicts, and separate-site visits. No production attendance changes.');
