import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {payrollPeriod,dateShift} from "../shared/payroll-cycle";
import {createTimesheetWorkbook} from "../server/timesheet-workbook";

assert.deepEqual(payrollPeriod("2026-05-18","2026-09-21"),{start:"2026-09-21",end:"2026-10-04",payday:"2026-10-09",summaryDates:["2026-10-06","2026-10-08"]});
assert.deepEqual(payrollPeriod("2026-05-18","2026-10-10"),{start:"2026-10-05",end:"2026-10-18",payday:"2026-10-23",summaryDates:["2026-10-20","2026-10-22"]});
assert.equal(payrollPeriod("2026-05-18","2026-10-19").payday,"2026-11-06");
assert.equal(payrollPeriod("2026-05-18","2026-11-01").end,"2026-11-01");
assert.equal(payrollPeriod("2026-09-21","2026-09-20").start,"2026-09-07");
const start="2026-10-05";
const rows=Array.from({length:14},(_,day)=>({date:dateShift(start,day),day:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][day%7],id:day<2?`fixture-${day}`:null,startTime:day<2?"17:00":"",endTime:day===0?"23:00":day===1?"22:00":"",clockInAt:day<2?`${dateShift(start,day)}T22:00:00Z`:undefined,clockOutAt:day===0?"2026-10-06T04:00:00Z":day===1?"2026-10-07T03:00:00Z":undefined,endDate:dateShift(start,day),rawMinutes:day===0?360:day===1?300:0,payableMinutes:day===0?330:day===1?300:0,location:day<2?"Example grocery store":""}));
const snapshot={company:{name:"Test Company",timezone:"America/Winnipeg",companyLogoUrl:'data:image/png;base64,'+(await fs.readFile('config/timesheet-template/xl/media/image.png')).toString('base64')},period:payrollPeriod(start,start),employees:[{id:"fixture",name:"Test Employee",employeeNumber:"EMP-TEST",rows,rawMinutes:660,payableMinutes:630}]};
await fs.writeFile('/private/tmp/clockfield-timesheet-template/test-generated.xlsx',await createTimesheetWorkbook(snapshot));
await fs.writeFile('/private/tmp/clockfield-timesheet-template/test-all.xlsx',await createTimesheetWorkbook({...snapshot,employees:[...snapshot.employees,{...snapshot.employees[0],id:"fixture-2",employeeNumber:"EMP-TEST-2",name:"Second Employee"}]}));
console.log("PASS: biweekly periods, Friday paydays, Tuesday/Thursday summary dates, DST calendar boundaries, and single/all-employee workbook exports.");

const fourRows=rows.map((row,day)=>day<4?{...row,id:`four-${day}`,startTime:"17:00",endTime:day===2?"22:05":"22:15",rawMinutes:day===2?305:315,payableMinutes:day===2?305:315}:row);
await fs.writeFile("/private/tmp/clockfield-timesheet-template/test-four-days.xlsx",await createTimesheetWorkbook({...snapshot,employees:[{...snapshot.employees[0],rows:fourRows,rawMinutes:1250,payableMinutes:1250}]}));

for(const count of [7,21])await fs.writeFile(`/private/tmp/clockfield-timesheet-template/test-${count}-days.xlsx`,await createTimesheetWorkbook({...snapshot,period:{...snapshot.period,end:dateShift(start,count-1)}}));
