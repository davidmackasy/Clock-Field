export function completedChecklistSteps(steps: {id:string;isRequired:boolean}[], submissions: {stepId:string;submittedImageUrl?:string|null}[]) {
  const required = new Set(steps.filter(s => s.isRequired).map(s => s.id));
  const completed = new Set(submissions.filter(s => required.has(s.stepId) && !!s.submittedImageUrl).map(s => s.stepId));
  return {total:required.size,completed:completed.size,missing:required.size-completed.size};
}
export function canAccessWork(sub:any,user:any) {
  return !!sub && sub.companyId === user.companyId && (user.role === 'admin' || user.role === 'employee' && sub.employeeId === user.id);
}
export function canAccessReport(report:any,user:any,clientId?:string) {
  return !!report && report.companyId === user.companyId && (user.role === 'admin' || ['employee','client'].includes(user.role) && (report.createdByUserId === user.id || (user.role === 'employee' ? report.assignedEmployeeId === user.id && report.sentToEmployee : !!clientId && report.assignedClientId === clientId && report.sentToClient)));
}
export function scheduledAssignmentDue(assignment:any,schedule:any,date:string,shifts:any[]) {
  if (assignment.status !== 'active') return false;
  if (!assignment.scheduleId) return true;
  const dated=shifts.filter(s=>s.recurringScheduleId===assignment.scheduleId && s.shiftDate===date);
  if(dated.length) return dated.some(s=>s.status!=='cancelled');
  if(!schedule || schedule.status!=='active' || schedule.employeeId!==assignment.cleanerId || date<schedule.startDate || schedule.endDate && date>schedule.endDate) return false;
  const day=['sun','mon','tue','wed','thu','fri','sat'][new Date(date+'T12:00:00Z').getUTCDay()];
  if(!schedule.repeatDays?.some((d:string)=>d.toLowerCase().slice(0,3)===day))return false;
  if(schedule.repeatFrequency==='biweekly')return Math.floor((Date.parse(date)-Date.parse(schedule.startDate))/86400000/7)%2===0;
  return true;
}
export function isSupplyRequest(s:any) { return Number(s.requestedQuantity) > 0 || !s.inventoryItemId; }
export function openSupplyRequest(s:any) { return isSupplyRequest(s) && !['fulfilled','not_needed','resolved'].includes(s.status); }
export function reportNeedsSignature(report:any,role?:string) {
 if(['finalized','archived','closed'].includes(report.status))return false;
 const roles=role?[role]:['admin','employee','client'];
 return roles.some(r=>report[`requires${r[0].toUpperCase()+r.slice(1)}Signature`]&&!report.signatureRoles?.includes(r));
}
