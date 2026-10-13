import {checkGeofence} from '../shared/geofence';
import {dateInZone} from '../shared/time-report';
export async function clockInSite(storage:any,user:any,input:any) {
  const company=await storage.getCompany(user.companyId);
  const sites=await storage.getLocationsByCompany(user.companyId);
  let shift:any=null,site:any=null;
  if(input.shiftId) {
    shift=await storage.getShift(input.shiftId);
    if(!shift || shift.companyId!==user.companyId || shift.employeeId!==user.id || ['cancelled','completed','in_progress'].includes(shift.status)) throw new Error('This shift is not available for clock-in.');
    site=sites.find((s:any)=>s.id===shift.locationId);
    if(shift.locationId && !site)throw new Error('This shift’s work site is unavailable. Ask your admin to update it.');
    if(input.locationId && input.locationId!==shift.locationId) throw new Error('Use the work site assigned to this shift.');
  } else {
    if(!company?.allowUnscheduledClockIns) throw new Error('A scheduled shift is required to clock in.');
    if(input.locationId) {
      const today=dateInZone(new Date(),company?.timezone||'UTC');
      const [shifts,schedules]=await Promise.all([storage.getShiftsByEmployee(user.id),storage.getRecurringSchedulesByEmployee(user.id)]);
      const assigned=shifts.some((s:any)=>s.companyId===user.companyId && s.employeeId===user.id && s.shiftDate===today && s.locationId===input.locationId && !['cancelled','completed'].includes(s.status)) || schedules.some((s:any)=>s.companyId===user.companyId && s.employeeId===user.id && s.locationId===input.locationId && s.status==='active' && s.startDate<=today && (!s.endDate||s.endDate>=today));
      if(!assigned)throw new Error('Choose a work site assigned to you.');
      site=sites.find((s:any)=>s.id===input.locationId);
      if(!site)throw new Error('Work site not found.');
    }
  }
  // Once a business enables a boundary, an unlocated clock-in cannot bypass it.
  if(!site && sites.some((s:any)=>s.geofenceEnabled)) throw new Error('Your shift needs an assigned work site. Ask your admin to update the assignment before clocking in.');
  return {shift,site};
}
export async function verifyClockInLocation(storage:any,user:any,input:any) {
  const result=await clockInSite(storage,user,input);
  return {...result,check:result.site?checkGeofence(result.site,input.position):null};
}
