import {checkGeofence} from '../shared/geofence';
import {dateInZone} from '../shared/time-report';
import {clockInAssignedLocationIds,shiftAssignmentOnDate} from '../shared/work-site-assignment';
export async function clockInSite(storage:any,user:any,input:any,now=new Date()) {
  const company=await storage.getCompany(user.companyId);
  const sites=await storage.getLocationsByCompany(user.companyId);
  const today=dateInZone(now,company?.timezone||'UTC');
  const localTime=new Intl.DateTimeFormat('en-GB',{timeZone:company?.timezone||'UTC',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
  let shift:any=null,site:any=null;
  if(input.shiftId) {
    shift=await storage.getShift(input.shiftId);
    if(!shift || shift.companyId!==user.companyId || shift.employeeId!==user.id || ['cancelled','completed','in_progress'].includes(shift.status)) throw new Error('This shift is not available for clock-in.');
    if(!shiftAssignmentOnDate(shift,today,localTime))throw new Error('This shift is not scheduled for this work day. Choose your assigned shift for today.');
    site=sites.find((s:any)=>s.id===shift.locationId);
    if(shift.locationId && !site)throw new Error('This shift’s work site is unavailable. Ask your admin to update it.');
    if(input.locationId && input.locationId!==shift.locationId) throw new Error('Use the work site assigned to this shift.');
  } else {
    if(!company?.allowUnscheduledClockIns) throw new Error('A scheduled shift is required to clock in.');
    const [shifts,schedules]=await Promise.all([storage.getShiftsByEmployee(user.id),storage.getRecurringSchedulesByEmployee(user.id)]);
    const assigned=clockInAssignedLocationIds(shifts,schedules,user,today,localTime);
    const locationId=input.locationId||(assigned.size===1?[...assigned][0]:undefined);
    if(locationId) {
      if(!assigned.has(locationId))throw new Error('Choose a work site assigned to you for this work day.');
      site=sites.find((s:any)=>s.id===locationId);
      if(!site)throw new Error('Your assigned work site is unavailable. Ask your admin to update the assignment.');
    } else if(sites.length) {
      throw new Error(assigned.size?'Choose a work site assigned to you for this work day.':'No work site is assigned to you for today. Ask your admin to update your schedule.');
    }
  }
  // A configured business work site must be carried through to the attendance record.
  if(!site && sites.length) throw new Error('Your shift needs an assigned work site. Ask your admin to update the assignment before clocking in.');
  return {shift,site};
}
export async function verifyClockInLocation(storage:any,user:any,input:any) {
  const result=await clockInSite(storage,user,input);
  const boundaryCheck=result.site?checkGeofence(result.site,input.position):null;
  return {...result,check:result.site?{...boundaryCheck,assignmentVerified:true,assignedLocationId:result.site.id,assignedLocationName:result.site.name,assignmentVerifiedAt:new Date().toISOString()}:null};
}
