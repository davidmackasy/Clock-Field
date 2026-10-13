import { canAccessWork, canAccessReport } from '../shared/worklog-state';
export function registerWorkSubmissionAccess(app:any, storage:any, requireAuth:any) {
  const check=async(req:any,res:any,next:any)=>{
    try {
      const sub=await storage.getWorkSubmission(req.params.id);
      if(!canAccessWork(sub,req.user))return res.status(404).json({message:'Work submission not found'});
      if(req.params.itemId){const item=await storage.getWorkSubmissionItem(req.params.itemId);if(!item||item.submissionId!==sub.id)return res.status(404).json({message:'Work item not found'});}
      next();
    }catch{res.status(500).json({message:'Unable to load work submission'});}
  };
  for(const root of ['/api/work-submissions','/api/admin/work-submissions']) {
    app.use(root+'/:id',requireAuth,check);
    app.use(root+'/:id/items/:itemId',requireAuth,check);
  }
  app.use('/api/work-submission-photos/:photoId/image',requireAuth,async(req:any,res:any,next:any)=>{
    try{const photo=await storage.getWorkSubmissionPhoto(req.params.photoId),item=photo&&await storage.getWorkSubmissionItem(photo.submissionItemId),sub=item&&await storage.getWorkSubmission(item.submissionId);
      if(!canAccessWork(sub,req.user))return res.status(404).json({message:'Photo not found'});next();
    }catch{res.status(500).json({message:'Unable to load photo'});}
  });
}
export function registerReportAccess(app:any,storage:any,requireAuth:any){
 app.use('/api/reports/:id',requireAuth,async(req:any,res:any,next:any)=>{
  try{const report=await storage.getReport(req.params.id,req.user.companyId);
    const client=req.user.role==='client'?(await storage.getClientsByCompany(req.user.companyId)).find((c:any)=>c.userId===req.user.id):null;
    if(!canAccessReport(report,req.user,client?.id))return res.status(404).json({message:'Report not found'});
    if(req.method!=='GET'&&['finalized','archived'].includes(report.status)&&req.user.role!=='admin')return res.status(409).json({message:'This report is locked'});next();
  }catch{res.status(500).json({message:'Unable to load report'});}
 });
}
export function registerFieldNoteAccess(app:any,storage:any,fnAuth:any){
 for(const [route,get] of [['assets','getFieldNotesAsset'],['todos','getFieldNotesTodo'],['entries','getFieldNotesEntry']])app.use(`/api/field-notes/${route}/:recordId`,fnAuth,async(req:any,res:any,next:any)=>{
   try{const record=await storage[get](req.params.recordId),session=record&&await storage.getFieldNotesSession(record.sessionId);
     if(!session||session.companyId!==req.user.companyId||req.user.role==='employee'&&session.createdByUserId!==req.user.id)return res.status(404).json({message:'Field note not found'});next();
   }catch{res.status(500).json({message:'Unable to load field note'});}
 });
 // Applies the same owner rule to session todos, capture and sharing as the detail screen.
 for(const name of ['sessions/:sessionId'])app.use('/api/field-notes/'+name,fnAuth,async(req:any,res:any,next:any)=>{
   try{const session=await storage.getFieldNotesSession(req.params.sessionId||req.params.id);
     if(!session||session.companyId!==req.user.companyId||req.user.role==='employee'&&session.createdByUserId!==req.user.id)return res.status(404).json({message:'Field note not found'});next();
   }catch{res.status(500).json({message:'Unable to load field note'});}
 });
}
export function registerScheduledNoteAccess(app:any,storage:any,requireRole:any){
 for(const [route,get] of [['sections','getScheduledFieldNoteSection'],['steps','getScheduledFieldNoteStepById'],['assignments','getScheduledFieldNoteAssignment']])app.use(`/api/admin/scheduled-field-notes/${route}/:recordId`,requireRole('admin'),async(req:any,res:any,next:any)=>{
  try{const record=await storage[get](req.params.recordId);if(!record||record.companyId!==req.user.companyId)return res.status(404).json({message:'Checklist record not found'});if (req.method !== 'GET' && route !== 'assignments') { const templateId = route === 'sections' ? record.templateId : (await storage.getScheduledFieldNoteSection(record.sectionId))?.templateId; if ((await storage.getScheduledFieldNoteSubmissions(req.user.companyId)).some((sub:any)=>sub.templateId===templateId)) return res.status(409).json({message:'This checklist has recorded submissions. Duplicate the template to change its steps and preserve the history.'}); }
    if(req.method==='DELETE' && route==='assignments' && (await storage.getScheduledFieldNoteSubmissions(req.user.companyId)).some((sub:any)=>sub.assignmentId===record.id))return res.status(409).json({message:'This assignment has submissions. Pause it to preserve its history.'});
    req.checklistRecord=record;next();}
  catch{res.status(500).json({message:'Unable to load checklist record'});}
 });
}
