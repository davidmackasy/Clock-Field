import { dateShift } from './payroll-cycle';

export function recurringAssignmentOnDate(schedule:any,date:string) {
  if(schedule.status!=='active'||schedule.startDate>date||(schedule.endDate&&schedule.endDate<date))return false;
  const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long'}).format(new Date(date+'T12:00:00Z')).toLowerCase();
  return (schedule.repeatDays||[]).some((day:string)=>day.toLowerCase()===weekday||day.toLowerCase()===weekday.slice(0,3))
    && (schedule.repeatFrequency!=='biweekly'||Math.floor((Date.parse(date)-Date.parse(schedule.startDate))/604800000)%2===0);
}

export function shiftAssignmentOnDate(shift:any,date:string,localTime:string) {
  const start=shift.scheduledStartAt?.slice(11,16),end=shift.scheduledEndAt?.slice(11,16);
  return !['cancelled','completed','in_progress'].includes(shift.status)
    &&(shift.shiftDate===date||(shift.shiftDate===dateShift(date,-1)&&!!start&&!!end&&end<start&&localTime<=end));
}

/** Used by both the clock-in picker and the server-side authorization check. */
export function clockInAssignedLocationIds(shifts:any[],schedules:any[],user:any,date:string,localTime:string) {
  const previous=dateShift(date,-1);
  const belongs=(row:any)=>row.companyId===user.companyId&&row.employeeId===user.id;
  const overnight=(start:string,end:string)=>!!start&&!!end&&end<start&&localTime<=end;
  const shiftMatches=shifts.filter(row=>belongs(row)&&shiftAssignmentOnDate(row,date,localTime));
  const recurringMatches=schedules.filter(row=>belongs(row)&&(recurringAssignmentOnDate(row,date)
    ||(recurringAssignmentOnDate(row,previous)&&overnight(row.scheduledStartTime,row.scheduledEndTime))));
  return new Set<string>([...shiftMatches,...recurringMatches].map(row=>row.locationId).filter(Boolean));
}
