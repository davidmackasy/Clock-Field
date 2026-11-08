import {recurringAssignmentOnDate} from '../shared/work-site-assignment';
/** Preserve verified clock-in sites; resolve legacy selections against dated assignments with an audit note. */
export function timesheetLocationDetails(entry:any,date:string,startTime:string,endTime:string,locations:any[],shifts:any[],schedules:any[],clients:any[]) {
  const name=(assignment:any)=>locations.find(location=>location.id===assignment?.locationId)?.name || clients.find(client=>client.id===assignment?.clientId)?.name;
  const linked=shifts.find(shift=>shift.id===entry.shiftId && shift.employeeId===entry.employeeId);
  const frozenAssignment=entry.clockInLocationCheck?.assignmentVerified&&entry.clockInLocationCheck?.assignedLocationId===entry.locationId;
  const recorded=(frozenAssignment?entry.clockInLocationCheck.assignedLocationName:null)||name(entry)||name(linked);
  const dated=shifts.filter(shift=>shift.employeeId===entry.employeeId&&shift.shiftDate===date&&shift.status!=='cancelled');
  const recurring=schedules.filter(schedule=>schedule.employeeId===entry.employeeId&&recurringAssignmentOnDate(schedule,date));
  const minute=(time:string)=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time||'')?Number(time.slice(0,2))*60+Number(time.slice(3)):NaN;
  const from=minute(startTime),to=minute(endTime)+(endTime<startTime?1440:0);
  const candidates=dated.length?dated:recurring;
  const scored=candidates.map(assignment=>{
    const a=(assignment.scheduledStartAt?.slice(11,16)||assignment.scheduledStartTime),b=(assignment.scheduledEndAt?.slice(11,16)||assignment.scheduledEndTime);
    const start=minute(a),end=minute(b)+(b<a?1440:0);
    const overlap=Math.max(0,Math.min(to,end)-Math.max(from,start));
    return {name:name(assignment),overlap};
  }).filter(item=>item.name&&Number.isFinite(item.overlap)&&item.overlap>0);
  const matched=[...new Set<string>(scored.map(item=>item.name))];
  const allNames=[...new Set<string>(candidates.map(name).filter(Boolean))];
  const planned=name(linked)||(matched.length===1?matched[0]:allNames.length===1?allNames[0]:null);
  const missingRecorded=!!entry.locationId&&!locations.some(location=>location.id===entry.locationId);
  const verified=!!entry.clockInLocationCheck?.checkedAt||!!frozenAssignment;
  const location=(verified?recorded:null) || planned || recorded || 'No assigned location';
  const locationWarning=recorded&&planned&&recorded!==planned
    ?verified?`${recorded} (${frozenAssignment?"assignment recorded at clock-in":"location verified"}). Current schedule: ${planned}.`
      :`${planned} (assigned). Clock-in selected ${recorded}.`
    :!planned&&matched.length>1?'Multiple assigned sites overlap this visit. Confirm the work site.'
    :!planned?missingRecorded?'Recorded work site is unavailable. Confirm the assignment.'
      :recorded?`${recorded} (clock-in). No dated assignment found.`:'No dated work site matches this visit. Confirm the assignment.'
    :'';
  return {location,recordedLocation:recorded||null,scheduledLocation:planned,locationSource:frozenAssignment?'clock_in_assignment':verified&&recorded?'verified':planned?'assignment':recorded?'recorded':'unknown',locationNeedsReview:!!locationWarning,locationWarning};
}

export function timesheetLocation(...args:Parameters<typeof timesheetLocationDetails>) {
  return timesheetLocationDetails(...args).location;
}
