/** Prefer recorded locations, then match the employee's dated assignments. */
export function timesheetLocation(entry:any,date:string,startTime:string,endTime:string,locations:any[],shifts:any[],schedules:any[],clients:any[]) {
  const name=(assignment:any)=>locations.find(location=>location.id===assignment?.locationId)?.name || clients.find(client=>client.id===assignment?.clientId)?.name;
  const linked=shifts.find(shift=>shift.id===entry.shiftId);
  const recorded=name(entry)||name(linked);if(recorded)return recorded;
  const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long'}).format(new Date(date+'T12:00:00Z')).toLowerCase();
  const dated=shifts.filter(shift=>shift.employeeId===entry.employeeId&&shift.shiftDate===date&&shift.status!=='cancelled');
  const recurring=schedules.filter(schedule=>schedule.employeeId===entry.employeeId&&schedule.startDate<=date&&(!schedule.endDate||schedule.endDate>=date)&&(schedule.repeatDays||[]).some((day:string)=>day.toLowerCase()===weekday||day.toLowerCase()===weekday.slice(0,3))&&(schedule.repeatFrequency!=='biweekly'||Math.floor((Date.parse(date)-Date.parse(schedule.startDate))/604800000)%2===0));
  const candidates=dated.length?dated:recurring;
  const minute=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3,5));
  const from=minute(startTime),to=minute(endTime)+(endTime<startTime?1440:0);
  const scored=candidates.map(assignment=>{const a=(assignment.scheduledStartAt?.slice(11,16)||assignment.scheduledStartTime),b=(assignment.scheduledEndAt?.slice(11,16)||assignment.scheduledEndTime);return {name:name(assignment),overlap:Math.max(0,Math.min(to,minute(b)+(b<a?1440:0))-Math.max(from,minute(a)))};}).filter(item=>item.name);
  const best=Math.max(0,...scored.map(item=>item.overlap));
  const matched=[...new Set(scored.filter(item=>best===0||item.overlap===best).map(item=>item.name))];
  if(matched.length)return matched.join('; ');
  const assigned=[...new Set(schedules.filter(schedule=>schedule.employeeId===entry.employeeId&&schedule.status==='active').map(name).filter(Boolean))];
  return assigned.length?assigned.join('; ')+' (assigned)':'No assigned location';
}
