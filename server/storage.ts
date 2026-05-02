import { db } from "./db";
import { eq, and, desc, sql, inArray, or, isNull, gte, asc } from "drizzle-orm";
import {
  companies, users, clients, locations, recurringSchedules, shifts, timeEntries, clientRequests, payrollDeductions,
  requestMessages, requestAttachments,
  timesheets,
  workSubmissions, workSubmissionItems, workSubmissionPhotos, workSubmissionReviews,
  priorityCleanAlerts, priorityCleanPhotos,
  platformMessages, broadcastEmailDeliveries, welcomeEmailDeliveries,
  payRuns, payStubs, payStubEarnings, payStubDeductions, payStubAuditLog,
  passwordResetTokens,
  reports, reportSignatures, reportActivityLog, reportAccessTokens,
  fieldNotesSessions, fieldNotesAssets, fieldNotesTranscriptChunks, fieldNotesEntries, fieldNotesEntryTags, fieldNotesTodos,
  attendanceAdjustments,
  type Report, type InsertReport,
  type ReportSignature, type InsertReportSignature,
  type ReportActivityLog,
  type ReportAccessToken, type InsertReportAccessToken,
  type Company, type InsertCompany,
  type User, type InsertUser,
  type Client, type InsertClient,
  type Location, type InsertLocation,
  type RecurringSchedule, type InsertRecurringSchedule,
  type Shift, type InsertShift,
  type TimeEntry, type InsertTimeEntry,
  type ClientRequest, type InsertClientRequest,
  type PayrollDeduction, type InsertPayrollDeduction,
  type RequestMessage, type InsertRequestMessage,
  type RequestAttachment, type InsertRequestAttachment,
  type Timesheet, type InsertTimesheet,
  type WorkSubmission, type InsertWorkSubmission,
  type WorkSubmissionItem, type InsertWorkSubmissionItem,
  type WorkSubmissionPhoto, type InsertWorkSubmissionPhoto,
  type WorkSubmissionReview, type InsertWorkSubmissionReview,
  type PlatformMessage, type InsertPlatformMessage,
  type BroadcastEmailDelivery, type WelcomeEmailDelivery,
  type PayRun, type InsertPayRun,
  type PayStub, type InsertPayStub,
  type PayStubEarning, type InsertPayStubEarning,
  type PayStubDeduction, type InsertPayStubDeduction,
  type PayStubAuditLog,
  type FieldNotesSession, type InsertFieldNotesSession,
  type FieldNotesAsset, type InsertFieldNotesAsset,
  type FieldNotesTranscriptChunk,
  type FieldNotesEntry, type InsertFieldNotesEntry,
  type FieldNotesEntryTag,
  type FieldNotesTodo, type InsertFieldNotesTodo,
  type AttendanceAdjustment, type InsertAttendanceAdjustment,
  type PriorityCleanAlert, type InsertPriorityCleanAlert,
  type PriorityCleanPhoto, type InsertPriorityCleanPhoto,
  publications, publicationSections, publicationMedia, publicationPricing, publicationVotes,
  type Publication, type InsertPublication,
  type PublicationSection, type InsertPublicationSection,
  type PublicationMedia, type InsertPublicationMedia,
  type PublicationPricing, type InsertPublicationPricing,
  type PublicationVote, type InsertPublicationVote,
  quoteForms, quoteFormSubmissions, aiEstimates, formQuotes, estimatorSettings, formEmailSettings, leadActivity,
  type QuoteForm, type InsertQuoteForm,
  type QuoteFormSubmission, type InsertQuoteFormSubmission,
  type AiEstimate, type InsertAiEstimate,
  type FormQuote, type InsertFormQuote,
  type EstimatorSettings, type InsertEstimatorSettings,
  type FormEmailSettings, type InsertFormEmailSettings,
  type LeadActivity, type InsertLeadActivity,
  proposals, proposalActivityLogs,
  type Proposal, type InsertProposal,
  type ProposalActivityLog, type InsertProposalActivityLog,
  agreementTemplates, agreements, agreementActivityLogs,
  type AgreementTemplate, type InsertAgreementTemplate,
  type Agreement, type InsertAgreement,
  type AgreementActivityLog, type InsertAgreementActivityLog,
  hiringPackages,
  type HiringPackage, type InsertHiringPackage,
  employeeHiringTemplates, employeeHiringPackages, employeeHiringSubmissions,
  employeeHiringPolicyAcceptances, employeeHiringDocuments,
  type EmployeeHiringTemplate, type InsertEmployeeHiringTemplate,
  type EmployeeHiringPackage, type InsertEmployeeHiringPackage,
  type EmployeeHiringSubmission, type InsertEmployeeHiringSubmission,
  type EmployeeHiringPolicyAcceptance, type InsertEmployeeHiringPolicyAcceptance,
  type EmployeeHiringDocument, type InsertEmployeeHiringDocument,
  trainingCourses, trainingModules, trainingModuleAssets, trainingAssignments,
  trainingProgress, trainingPublicLearners, trainingCertificates,
  type TrainingCourse, type InsertTrainingCourse,
  type TrainingModule, type InsertTrainingModule,
  type TrainingModuleAsset, type InsertTrainingModuleAsset,
  type TrainingAssignment, type InsertTrainingAssignment,
  type TrainingProgress, type InsertTrainingProgress,
  type TrainingPublicLearner, type InsertTrainingPublicLearner,
  type TrainingCertificate, type InsertTrainingCertificate,
  quoteRequestWalkthroughs, quoteRequestWalkthroughPhotos, quoteRequestWalkthroughSections,
  type QuoteRequestWalkthrough, type InsertQuoteRequestWalkthrough,
  type QuoteRequestWalkthroughPhoto, type InsertQuoteRequestWalkthroughPhoto,
  type QuoteRequestWalkthroughSection, type InsertQuoteRequestWalkthroughSection,
  scheduledFieldNoteTemplates, scheduledFieldNoteSections, scheduledFieldNoteSteps,
  scheduledFieldNoteAssignments, scheduledFieldNoteSubmissions, scheduledFieldNoteStepSubmissions,
  type ScheduledFieldNoteTemplate, type InsertScheduledFieldNoteTemplate,
  type ScheduledFieldNoteSection, type InsertScheduledFieldNoteSection,
  type ScheduledFieldNoteStep, type InsertScheduledFieldNoteStep,
  type ScheduledFieldNoteAssignment, type InsertScheduledFieldNoteAssignment,
  type ScheduledFieldNoteSubmission, type InsertScheduledFieldNoteSubmission,
  type ScheduledFieldNoteStepSubmission, type InsertScheduledFieldNoteStepSubmission,
  supplies, supplyUpdates,
  inventoryItems, inventoryPurchases, inventoryMovements, locationSupplyExpenses,
  type Supply, type InsertSupply,
  type SupplyUpdate, type InsertSupplyUpdate,
  type InventoryItem, type InsertInventoryItem,
  type InventoryPurchase, type InsertInventoryPurchase,
  type InventoryMovement, type InsertInventoryMovement,
  type LocationSupplyExpense, type InsertLocationSupplyExpense,
} from "@shared/schema";

export interface IStorage {
  createCompany(data: InsertCompany): Promise<Company>;
  getCompany(id: string): Promise<Company | undefined>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  incrementEmployeeIdCounter(companyId: string): Promise<number>;

  createUser(data: InsertUser): Promise<User>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmployeeId(employeeId: string): Promise<User | undefined>;
  getEmployeesByCompany(companyId: string): Promise<User[]>;
  getAdminsByCompany(companyId: string): Promise<User[]>;
  getAllCompanyAdmins(): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  createClient(data: InsertClient): Promise<Client>;
  getClient(id: string): Promise<Client | undefined>;
  getClientByUserId(userId: string): Promise<Client | undefined>;
  getClientsByCompany(companyId: string): Promise<Client[]>;
  updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined>;

  createLocation(data: InsertLocation): Promise<Location>;
  getLocation(id: string): Promise<Location | undefined>;
  getLocationsByCompany(companyId: string): Promise<Location[]>;
  updateLocation(id: string, data: Partial<InsertLocation>): Promise<Location | undefined>;

  createRecurringSchedule(data: InsertRecurringSchedule): Promise<RecurringSchedule>;
  getRecurringSchedule(id: string): Promise<RecurringSchedule | undefined>;
  getRecurringSchedulesByCompany(companyId: string): Promise<RecurringSchedule[]>;
  getRecurringSchedulesByEmployee(employeeId: string): Promise<RecurringSchedule[]>;
  updateRecurringSchedule(id: string, data: Partial<InsertRecurringSchedule>): Promise<RecurringSchedule | undefined>;
  deleteRecurringSchedule(id: string): Promise<void>;
  getShiftsByRecurringSchedule(recurringScheduleId: string): Promise<Shift[]>;

  createShift(data: InsertShift): Promise<Shift>;
  getShift(id: string): Promise<Shift | undefined>;
  getShiftsByCompany(companyId: string): Promise<Shift[]>;
  getShiftsByEmployee(employeeId: string): Promise<Shift[]>;
  getShiftsByDate(companyId: string, date: string): Promise<Shift[]>;
  updateShift(id: string, data: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: string): Promise<void>;

  createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry>;
  getTimeEntry(id: string): Promise<TimeEntry | undefined>;
  getActiveTimeEntry(employeeId: string): Promise<TimeEntry | undefined>;
  getTimeEntriesByCompany(companyId: string): Promise<TimeEntry[]>;
  getTimeEntriesByEmployee(employeeId: string): Promise<TimeEntry[]>;
  updateTimeEntry(id: string, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;

  createAttendanceAdjustment(data: InsertAttendanceAdjustment): Promise<AttendanceAdjustment>;
  getAttendanceAdjustmentsByEntry(timeEntryId: string): Promise<AttendanceAdjustment[]>;
  getAttendanceAdjustmentsByCompany(companyId: string): Promise<AttendanceAdjustment[]>;
  getAttendanceAdjustmentsByEmployee(employeeId: string): Promise<AttendanceAdjustment[]>;
  getAttendanceAdjustmentById(id: string): Promise<AttendanceAdjustment | undefined>;
  voidAttendanceAdjustment(id: string, voidedByUserId: string): Promise<AttendanceAdjustment | undefined>;

  createClientRequest(data: InsertClientRequest): Promise<ClientRequest>;
  getClientRequest(id: string): Promise<ClientRequest | undefined>;
  getClientRequestsByCompany(companyId: string): Promise<ClientRequest[]>;
  getClientRequestsByClient(clientId: string): Promise<ClientRequest[]>;
  getClientRequestsByEmployee(employeeId: string): Promise<ClientRequest[]>;
  updateClientRequest(id: string, data: Partial<InsertClientRequest>): Promise<ClientRequest | undefined>;

  createRequestMessage(data: InsertRequestMessage): Promise<RequestMessage>;
  getRequestMessage(id: string): Promise<RequestMessage | undefined>;
  getRequestMessages(requestId: string): Promise<RequestMessage[]>;
  createRequestAttachment(data: InsertRequestAttachment): Promise<RequestAttachment>;
  getRequestAttachment(id: string): Promise<RequestAttachment | undefined>;
  getRequestAttachmentsByMessage(messageId: string): Promise<RequestAttachment[]>;
  getRequestAttachmentsByMessageIds(messageIds: string[]): Promise<RequestAttachment[]>;

  createTimesheet(data: InsertTimesheet): Promise<Timesheet>;
  getTimesheet(id: string): Promise<Timesheet | undefined>;
  getTimesheetByEmployeeAndPeriod(employeeId: string, periodStart: string): Promise<Timesheet | undefined>;
  getTimesheetsByCompany(companyId: string): Promise<Timesheet[]>;
  getTimesheetsByEmployee(employeeId: string): Promise<Timesheet[]>;
  updateTimesheet(id: string, data: Partial<InsertTimesheet>): Promise<Timesheet | undefined>;

  getPayrollDeductionsByCompany(companyId: string): Promise<PayrollDeduction[]>;
  createPayrollDeduction(data: InsertPayrollDeduction): Promise<PayrollDeduction>;
  updatePayrollDeduction(id: string, data: Partial<InsertPayrollDeduction>): Promise<PayrollDeduction | undefined>;
  deletePayrollDeduction(id: string): Promise<void>;

  // Work Submissions
  createWorkSubmission(data: InsertWorkSubmission): Promise<WorkSubmission>;
  getWorkSubmission(id: string): Promise<WorkSubmission | undefined>;
  getWorkSubmissionsByEmployee(employeeId: string): Promise<WorkSubmission[]>;
  getWorkSubmissionsByCompany(companyId: string): Promise<WorkSubmission[]>;
  updateWorkSubmission(id: string, data: Partial<InsertWorkSubmission>): Promise<WorkSubmission | undefined>;
  deleteWorkSubmission(id: string): Promise<void>;
  generateWorkSubmissionShareToken(id: string): Promise<WorkSubmission | undefined>;
  getWorkSubmissionByToken(token: string): Promise<WorkSubmission | undefined>;

  createWorkSubmissionItem(data: InsertWorkSubmissionItem): Promise<WorkSubmissionItem>;
  getWorkSubmissionItem(id: string): Promise<WorkSubmissionItem | undefined>;
  getWorkSubmissionItems(submissionId: string): Promise<WorkSubmissionItem[]>;
  updateWorkSubmissionItem(id: string, data: Partial<InsertWorkSubmissionItem>): Promise<WorkSubmissionItem | undefined>;
  deleteWorkSubmissionItem(id: string): Promise<void>;

  createWorkSubmissionPhoto(data: InsertWorkSubmissionPhoto): Promise<WorkSubmissionPhoto>;
  getWorkSubmissionPhoto(id: string): Promise<WorkSubmissionPhoto | undefined>;
  getWorkSubmissionPhotosByItem(submissionItemId: string): Promise<WorkSubmissionPhoto[]>;
  getWorkSubmissionPhotosByItemIds(itemIds: string[]): Promise<WorkSubmissionPhoto[]>;
  deleteWorkSubmissionPhoto(id: string): Promise<void>;

  // Password Reset
  createPasswordResetToken(data: { userId: string; email: string; tokenHash: string; expiresAt: Date; ipAddress?: string; userAgent?: string }): Promise<void>;
  getPasswordResetTokenByHash(tokenHash: string): Promise<import("@shared/schema").PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<void>;
  invalidatePasswordResetTokensForUser(userId: string): Promise<void>;

  // Super Admin
  getAllCompanies(): Promise<Company[]>;
  getPlatformStats(): Promise<{
    totalBusinesses: number;
    activeBusinesses: number;
    suspendedBusinesses: number;
    pendingBusinesses: number;
    mrr: number;
    arr: number;
  }>;

  // Platform Messages
  createPlatformMessage(data: InsertPlatformMessage): Promise<PlatformMessage>;
  getPlatformMessagesByCompany(companyId: string): Promise<PlatformMessage[]>;
  getBroadcastMessages(): Promise<PlatformMessage[]>;
  getMessagesForCompany(companyId: string): Promise<PlatformMessage[]>;
  markPlatformMessageRead(id: string): Promise<void>;
  getAllPlatformMessages(): Promise<PlatformMessage[]>;
  getPlatformMessage(id: string): Promise<PlatformMessage | undefined>;
  updatePlatformMessage(id: string, data: Partial<InsertPlatformMessage>): Promise<void>;
  // Broadcast email deliveries
  createBroadcastEmailDelivery(data: Omit<BroadcastEmailDelivery, "id">): Promise<BroadcastEmailDelivery>;
  // Welcome email deliveries
  createWelcomeEmailDelivery(data: Omit<WelcomeEmailDelivery, "id">): Promise<WelcomeEmailDelivery>;
  getWelcomeEmailDeliveryByBusinessId(businessId: string): Promise<WelcomeEmailDelivery | undefined>;

  // Pay Runs
  createPayRun(data: InsertPayRun): Promise<PayRun>;
  getPayRun(id: string): Promise<PayRun | undefined>;
  getPayRunsByCompany(companyId: string): Promise<PayRun[]>;
  updatePayRun(id: string, data: Partial<InsertPayRun>): Promise<PayRun | undefined>;
  deletePayRun(id: string): Promise<void>;

  // Pay Stubs
  createPayStub(data: InsertPayStub): Promise<PayStub>;
  getPayStub(id: string): Promise<PayStub | undefined>;
  getPayStubsByCompany(companyId: string): Promise<PayStub[]>;
  getPayStubsByPayRun(payRunId: string): Promise<PayStub[]>;
  getPayStubsByEmployee(employeeId: string, companyId: string): Promise<PayStub[]>;
  getPublishedPayStubsByEmployee(employeeId: string, companyId: string): Promise<PayStub[]>;
  updatePayStub(id: string, data: Partial<InsertPayStub>): Promise<PayStub | undefined>;
  deletePayStub(id: string): Promise<void>;

  // Pay Stub Earnings
  createPayStubEarning(data: InsertPayStubEarning): Promise<PayStubEarning>;
  getPayStubEarnings(payStubId: string): Promise<PayStubEarning[]>;
  updatePayStubEarning(id: string, data: Partial<InsertPayStubEarning>): Promise<PayStubEarning | undefined>;
  deletePayStubEarning(id: string): Promise<void>;
  deletePayStubEarningsByStub(payStubId: string): Promise<void>;

  // Pay Stub Deductions
  createPayStubDeduction(data: InsertPayStubDeduction): Promise<PayStubDeduction>;
  getPayStubDeductions(payStubId: string): Promise<PayStubDeduction[]>;
  updatePayStubDeduction(id: string, data: Partial<InsertPayStubDeduction>): Promise<PayStubDeduction | undefined>;
  deletePayStubDeduction(id: string): Promise<void>;
  deletePayStubDeductionsByStub(payStubId: string): Promise<void>;

  // Pay Stub Audit Log
  createPayStubAuditLog(data: Omit<PayStubAuditLog, "id">): Promise<PayStubAuditLog>;
  getPayStubAuditLog(payStubId: string): Promise<PayStubAuditLog[]>;

  // Work Submission Reviews
  createWorkSubmissionReview(data: InsertWorkSubmissionReview): Promise<WorkSubmissionReview>;
  getWorkSubmissionReviewBySubmissionId(submissionId: string): Promise<WorkSubmissionReview | undefined>;
  getWorkSubmissionReviewsByCompany(companyId: string): Promise<WorkSubmissionReview[]>;
  getSubmissionIdsWithReviews(companyId: string): Promise<Set<string>>;

  // Priority Clean Alerts
  createPriorityCleanAlert(data: InsertPriorityCleanAlert): Promise<PriorityCleanAlert>;
  getPriorityCleanAlert(id: string): Promise<PriorityCleanAlert | undefined>;
  getPriorityCleanAlertsByCompany(companyId: string): Promise<PriorityCleanAlert[]>;
  getOpenPriorityCleanAlertsByLocation(locationId: string, companyId: string, employeeId?: string): Promise<PriorityCleanAlert[]>;
  getOpenPriorityCleanAlertsByEmployee(employeeId: string, companyId: string): Promise<PriorityCleanAlert[]>;
  updatePriorityCleanAlert(id: string, data: Partial<InsertPriorityCleanAlert>): Promise<PriorityCleanAlert | undefined>;
  deletePriorityCleanAlert(id: string): Promise<void>;
  resolveAlertsForLocation(locationId: string, companyId: string, submissionId: string): Promise<void>;
  createPriorityCleanPhoto(data: InsertPriorityCleanPhoto): Promise<PriorityCleanPhoto>;
  getPriorityCleanPhoto(id: string): Promise<PriorityCleanPhoto | undefined>;
  getPriorityCleanPhotosByAlertId(alertId: string): Promise<PriorityCleanPhoto[]>;
  deletePriorityCleanPhotosByAlertId(alertId: string): Promise<void>;
  getPriorityCleanAlertBySubmissionId(submissionId: string): Promise<PriorityCleanAlert | undefined>;

  // Reports
  createReport(data: InsertReport): Promise<Report>;
  getReport(id: string, companyId: string): Promise<Report | undefined>;
  getReportsByCompany(companyId: string): Promise<Report[]>;
  getReportsForEmployee(employeeId: string, companyId: string): Promise<Report[]>;
  getReportsForClient(clientId: string, companyId: string): Promise<Report[]>;
  getReportsCreatedBy(userId: string, companyId: string): Promise<Report[]>;
  updateReport(id: string, companyId: string, data: Partial<InsertReport>): Promise<Report | undefined>;
  deleteReport(id: string, companyId: string): Promise<void>;
  // Report Signatures
  createReportSignature(data: InsertReportSignature): Promise<ReportSignature>;
  getReportSignatures(reportId: string): Promise<ReportSignature[]>;
  getReportSignatureByUser(reportId: string, userId: string): Promise<ReportSignature | undefined>;
  getReportSignatureByToken(reportId: string, tokenId: string): Promise<ReportSignature | undefined>;
  // Report Activity Log
  createReportActivity(data: Omit<ReportActivityLog, "id">): Promise<ReportActivityLog>;
  getReportActivity(reportId: string): Promise<ReportActivityLog[]>;
  // Report Access Tokens
  createReportAccessToken(data: Omit<ReportAccessToken, "id">): Promise<ReportAccessToken>;
  getReportAccessTokenByHash(tokenHash: string): Promise<ReportAccessToken | undefined>;
  updateReportAccessToken(id: string, data: Partial<ReportAccessToken>): Promise<ReportAccessToken | undefined>;
  revokeReportAccessTokensByReport(reportId: string): Promise<void>;

  // Publications
  createPublication(data: InsertPublication): Promise<Publication>;
  getPublication(id: string): Promise<Publication | undefined>;
  getPublicationBySlug(slug: string): Promise<Publication | undefined>;
  getPublicationsByCompany(companyId: string): Promise<Publication[]>;
  updatePublication(id: string, data: Partial<InsertPublication>): Promise<Publication | undefined>;
  deletePublication(id: string): Promise<void>;
  isSlugTaken(slug: string, excludeId?: string): Promise<boolean>;

  createPublicationSection(data: InsertPublicationSection): Promise<PublicationSection>;
  getPublicationSections(publicationId: string): Promise<PublicationSection[]>;
  updatePublicationSection(id: string, data: Partial<InsertPublicationSection>): Promise<PublicationSection | undefined>;
  deletePublicationSection(id: string): Promise<void>;
  deletePublicationSectionsByPublication(publicationId: string): Promise<void>;

  createPublicationMedia(data: InsertPublicationMedia): Promise<PublicationMedia>;
  getPublicationMedia(publicationId: string): Promise<PublicationMedia[]>;
  getPublicationMediaBySection(sectionId: string): Promise<PublicationMedia[]>;
  updatePublicationMedia(id: string, data: Partial<InsertPublicationMedia>): Promise<PublicationMedia | undefined>;
  deletePublicationMedia(id: string): Promise<void>;
  deletePublicationMediaBySection(sectionId: string): Promise<void>;
  deletePublicationMediaByPublication(publicationId: string): Promise<void>;

  createPublicationPricing(data: InsertPublicationPricing): Promise<PublicationPricing>;
  getPublicationPricing(publicationId: string): Promise<PublicationPricing[]>;
  updatePublicationPricing(id: string, data: Partial<InsertPublicationPricing>): Promise<PublicationPricing | undefined>;
  deletePublicationPricing(id: string): Promise<void>;
  deletePublicationPricingByPublication(publicationId: string): Promise<void>;

  createPublicationVote(data: InsertPublicationVote): Promise<PublicationVote>;
  getPublicationVoteCounts(publicationId: string): Promise<{ yes: number; no: number }>;

  getQuoteFormsByCompany(companyId: string): Promise<QuoteForm[]>;
  getQuoteForm(id: string): Promise<QuoteForm | undefined>;
  getQuoteFormBySlug(companyId: string, slug: string): Promise<QuoteForm | undefined>;
  createQuoteForm(data: InsertQuoteForm): Promise<QuoteForm>;
  updateQuoteForm(id: string, data: Partial<InsertQuoteForm>): Promise<QuoteForm | undefined>;
  deleteQuoteForm(id: string): Promise<void>;
  getQuoteFormSubmissions(formId: string): Promise<QuoteFormSubmission[]>;
  getAllSubmissionsByCompany(companyId: string): Promise<QuoteFormSubmission[]>;
  getQuoteFormSubmission(id: string): Promise<QuoteFormSubmission | undefined>;
  createQuoteFormSubmission(data: InsertQuoteFormSubmission): Promise<QuoteFormSubmission>;
  updateQuoteFormSubmission(id: string, data: Partial<InsertQuoteFormSubmission>): Promise<QuoteFormSubmission | undefined>;
  // AI Estimates
  getAiEstimateBySubmission(submissionId: string): Promise<AiEstimate | undefined>;
  createAiEstimate(data: InsertAiEstimate): Promise<AiEstimate>;
  updateAiEstimate(id: string, data: Partial<InsertAiEstimate>): Promise<AiEstimate | undefined>;
  // Form Quotes
  getFormQuoteBySubmission(submissionId: string): Promise<FormQuote | undefined>;
  createFormQuote(data: InsertFormQuote): Promise<FormQuote>;
  updateFormQuote(id: string, data: Partial<InsertFormQuote>): Promise<FormQuote | undefined>;
  // Estimator Settings
  getEstimatorSettings(companyId: string): Promise<EstimatorSettings | undefined>;
  upsertEstimatorSettings(companyId: string, data: Partial<InsertEstimatorSettings>): Promise<EstimatorSettings>;
  // Form Email Settings
  getFormEmailSettings(companyId: string): Promise<FormEmailSettings | undefined>;
  upsertFormEmailSettings(companyId: string, data: Partial<InsertFormEmailSettings>): Promise<FormEmailSettings>;
  // Lead Activity
  getLeadActivity(submissionId: string): Promise<LeadActivity[]>;
  addLeadActivity(data: InsertLeadActivity): Promise<LeadActivity>;
  // Proposals
  getProposalsByCompany(companyId: string): Promise<Proposal[]>;
  getProposal(id: string): Promise<Proposal | undefined>;
  getProposalByToken(token: string): Promise<Proposal | undefined>;
  createProposal(data: InsertProposal): Promise<Proposal>;
  updateProposal(id: string, data: Partial<InsertProposal>): Promise<Proposal | undefined>;
  getNextProposalNumber(companyId: string): Promise<string>;
  // Proposal activity logs
  getProposalActivityLogs(proposalId: string): Promise<ProposalActivityLog[]>;
  addProposalActivity(data: InsertProposalActivityLog): Promise<ProposalActivityLog>;
  // Agreement Templates
  getAgreementTemplates(companyId: string): Promise<AgreementTemplate[]>;
  getAgreementTemplate(id: string): Promise<AgreementTemplate | undefined>;
  createAgreementTemplate(data: InsertAgreementTemplate): Promise<AgreementTemplate>;
  updateAgreementTemplate(id: string, data: Partial<InsertAgreementTemplate>): Promise<AgreementTemplate | undefined>;
  deleteAgreementTemplate(id: string): Promise<void>;
  // Agreements
  getAgreementsByCompany(companyId: string): Promise<Agreement[]>;
  getAgreement(id: string): Promise<Agreement | undefined>;
  getAgreementByToken(token: string): Promise<Agreement | undefined>;
  createAgreement(data: InsertAgreement): Promise<Agreement>;
  updateAgreement(id: string, data: Partial<InsertAgreement>): Promise<Agreement | undefined>;
  // Agreement Activity
  getAgreementActivity(agreementId: string): Promise<AgreementActivityLog[]>;
  addAgreementActivity(data: InsertAgreementActivityLog): Promise<AgreementActivityLog>;
  // Hiring Packages (legacy)
  getHiringPackagesByCompany(companyId: string): Promise<HiringPackage[]>;
  getHiringPackage(id: string): Promise<HiringPackage | undefined>;
  getHiringPackageByToken(token: string): Promise<HiringPackage | undefined>;
  createHiringPackage(data: InsertHiringPackage): Promise<HiringPackage>;
  updateHiringPackage(id: string, data: Partial<InsertHiringPackage>): Promise<HiringPackage | undefined>;
  deleteHiringPackage(id: string): Promise<void>;
  // Hiring Package Feature (Publications tab)
  getHPTemplatesByCompany(companyId: string): Promise<EmployeeHiringTemplate[]>;
  getHPTemplate(id: string): Promise<EmployeeHiringTemplate | undefined>;
  getHPDefaultTemplate(companyId: string): Promise<EmployeeHiringTemplate | undefined>;
  createHPTemplate(data: InsertEmployeeHiringTemplate): Promise<EmployeeHiringTemplate>;
  updateHPTemplate(id: string, data: Partial<InsertEmployeeHiringTemplate>): Promise<EmployeeHiringTemplate | undefined>;
  deleteHPTemplate(id: string): Promise<void>;
  getHPPackagesByCompany(companyId: string): Promise<EmployeeHiringPackage[]>;
  getHPPackage(id: string): Promise<EmployeeHiringPackage | undefined>;
  getHPPackageByToken(token: string): Promise<EmployeeHiringPackage | undefined>;
  createHPPackage(data: InsertEmployeeHiringPackage): Promise<EmployeeHiringPackage>;
  updateHPPackage(id: string, data: Partial<InsertEmployeeHiringPackage>): Promise<EmployeeHiringPackage | undefined>;
  deleteHPPackage(id: string): Promise<void>;
  getHPSubmissionsByCompany(companyId: string): Promise<EmployeeHiringSubmission[]>;
  getHPSubmission(id: string): Promise<EmployeeHiringSubmission | undefined>;
  getHPSubmissionByToken(token: string): Promise<EmployeeHiringSubmission | undefined>;
  getHPSubmissionByPackage(packageId: string): Promise<EmployeeHiringSubmission | undefined>;
  createHPSubmission(data: InsertEmployeeHiringSubmission): Promise<EmployeeHiringSubmission>;
  updateHPSubmission(id: string, data: Partial<InsertEmployeeHiringSubmission>): Promise<EmployeeHiringSubmission | undefined>;
  getHPPolicyAcceptances(submissionId: string): Promise<EmployeeHiringPolicyAcceptance[]>;
  createHPPolicyAcceptance(data: InsertEmployeeHiringPolicyAcceptance): Promise<EmployeeHiringPolicyAcceptance>;
  getHPDocuments(submissionId: string): Promise<EmployeeHiringDocument[]>;
  getHPDocument(id: string): Promise<EmployeeHiringDocument | undefined>;
  upsertHPDocument(submissionId: string, documentType: string, data: InsertEmployeeHiringDocument): Promise<EmployeeHiringDocument>;
  deleteHPDocument(submissionId: string, documentType: string): Promise<void>;

  // ── Training Hub ────────────────────────────────────────────────────────────
  createTrainingCourse(data: InsertTrainingCourse): Promise<TrainingCourse>;
  getTrainingCourses(companyId: string): Promise<(TrainingCourse & { moduleCount: number; assignedCount: number; completedCount: number })[]>;
  getTrainingCourse(id: string): Promise<TrainingCourse | undefined>;
  getTrainingCourseByPublicId(publicId: string): Promise<TrainingCourse | undefined>;
  updateTrainingCourse(id: string, data: Partial<InsertTrainingCourse>): Promise<TrainingCourse | undefined>;
  deleteTrainingCourse(id: string): Promise<void>;
  getTrainingStats(companyId: string): Promise<{ totalCourses: number; totalAssigned: number; totalCompleted: number; totalPending: number }>;

  createTrainingModule(data: InsertTrainingModule): Promise<TrainingModule>;
  getTrainingModules(courseId: string): Promise<(TrainingModule & { assets: TrainingModuleAsset[] })[]>;
  getTrainingModule(id: string): Promise<TrainingModule | undefined>;
  updateTrainingModule(id: string, data: Partial<InsertTrainingModule>): Promise<TrainingModule | undefined>;
  deleteTrainingModule(id: string): Promise<void>;

  createTrainingModuleAsset(data: InsertTrainingModuleAsset): Promise<TrainingModuleAsset>;
  deleteTrainingModuleAssets(moduleId: string): Promise<void>;

  assignTrainingCourse(courseId: string, companyId: string, employeeIds: string[], assignedBy: string): Promise<void>;
  getTrainingAssignments(courseId: string): Promise<(TrainingAssignment & { employeeName: string })[]>;
  getMyTrainingCourses(employeeId: string, companyId: string): Promise<any[]>;
  getMyTrainingCourse(courseId: string, employeeId: string): Promise<any>;

  markModuleComplete(courseId: string, moduleId: string, companyId: string, employeeId?: string, publicLearnerId?: string): Promise<void>;
  getTrainingProgress(courseId: string, employeeId?: string, publicLearnerId?: string): Promise<TrainingProgress[]>;
  getTrainingCompletions(courseId: string): Promise<TrainingProgress[]>;

  createPublicLearner(data: InsertTrainingPublicLearner): Promise<TrainingPublicLearner>;
  getPublicLearner(id: string): Promise<TrainingPublicLearner | undefined>;
  updatePublicLearner(id: string, data: Partial<InsertTrainingPublicLearner>): Promise<TrainingPublicLearner | undefined>;

  createTrainingCertificate(data: InsertTrainingCertificate): Promise<TrainingCertificate>;
  getTrainingCertificate(courseId: string, employeeId?: string, publicLearnerId?: string): Promise<TrainingCertificate | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createCompany(data: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(data).returning();
    return company;
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db.update(companies).set(data).where(eq(companies.id, id)).returning();
    return company;
  }

  async incrementEmployeeIdCounter(companyId: string): Promise<number> {
    const [updated] = await db
      .update(companies)
      .set({ employeeIdCounter: sql`${companies.employeeIdCounter} + 1` })
      .where(eq(companies.id, companyId))
      .returning({ counter: companies.employeeIdCounter });
    return updated.counter;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByEmployeeId(employeeId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.employeeId, employeeId));
    return user;
  }

  async getEmployeesByCompany(companyId: string): Promise<User[]> {
    return db.select().from(users).where(
      and(eq(users.companyId, companyId), eq(users.role, "employee"))
    );
  }

  async getAdminsByCompany(companyId: string): Promise<User[]> {
    return db.select().from(users).where(
      and(eq(users.companyId, companyId), eq(users.role, "admin"))
    );
  }

  async getAllCompanyAdmins(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "admin"));
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async createClient(data: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(data).returning();
    return client;
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByUserId(userId: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.userId, userId));
    return client;
  }

  async getClientsByCompany(companyId: string): Promise<Client[]> {
    return db.select().from(clients).where(eq(clients.companyId, companyId));
  }

  async updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
    return client;
  }

  async createLocation(data: InsertLocation): Promise<Location> {
    const [location] = await db.insert(locations).values(data).returning();
    return location;
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location;
  }

  async getLocationsByCompany(companyId: string): Promise<Location[]> {
    return db.select().from(locations).where(eq(locations.companyId, companyId));
  }

  async updateLocation(id: string, data: Partial<InsertLocation>): Promise<Location | undefined> {
    const [location] = await db.update(locations).set(data).where(eq(locations.id, id)).returning();
    return location;
  }

  async createRecurringSchedule(data: InsertRecurringSchedule): Promise<RecurringSchedule> {
    const [schedule] = await db.insert(recurringSchedules).values(data).returning();
    return schedule;
  }

  async getRecurringSchedule(id: string): Promise<RecurringSchedule | undefined> {
    const [schedule] = await db.select().from(recurringSchedules).where(eq(recurringSchedules.id, id));
    return schedule;
  }

  async getRecurringSchedulesByCompany(companyId: string): Promise<RecurringSchedule[]> {
    return db.select().from(recurringSchedules).where(eq(recurringSchedules.companyId, companyId));
  }

  async getRecurringSchedulesByEmployee(employeeId: string): Promise<RecurringSchedule[]> {
    return db.select().from(recurringSchedules).where(eq(recurringSchedules.employeeId, employeeId));
  }

  async updateRecurringSchedule(id: string, data: Partial<InsertRecurringSchedule>): Promise<RecurringSchedule | undefined> {
    const [schedule] = await db.update(recurringSchedules).set(data).where(eq(recurringSchedules.id, id)).returning();
    return schedule;
  }

  async deleteRecurringSchedule(id: string): Promise<void> {
    await db.delete(recurringSchedules).where(eq(recurringSchedules.id, id));
  }

  async getShiftsByRecurringSchedule(recurringScheduleId: string): Promise<Shift[]> {
    return db.select().from(shifts).where(eq(shifts.recurringScheduleId, recurringScheduleId));
  }

  async createShift(data: InsertShift): Promise<Shift> {
    const [shift] = await db.insert(shifts).values(data).returning();
    return shift;
  }

  async getShift(id: string): Promise<Shift | undefined> {
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, id));
    return shift;
  }

  async getShiftsByCompany(companyId: string): Promise<Shift[]> {
    return db.select().from(shifts).where(eq(shifts.companyId, companyId));
  }

  async getShiftsByEmployee(employeeId: string): Promise<Shift[]> {
    return db.select().from(shifts).where(eq(shifts.employeeId, employeeId));
  }

  async getShiftsByDate(companyId: string, date: string): Promise<Shift[]> {
    return db.select().from(shifts).where(
      and(eq(shifts.companyId, companyId), eq(shifts.shiftDate, date))
    );
  }

  async updateShift(id: string, data: Partial<InsertShift>): Promise<Shift | undefined> {
    const [shift] = await db.update(shifts).set(data).where(eq(shifts.id, id)).returning();
    return shift;
  }

  async deleteShift(id: string): Promise<void> {
    await db.delete(shifts).where(eq(shifts.id, id));
  }

  async createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry> {
    const [entry] = await db.insert(timeEntries).values(data).returning();
    return entry;
  }

  async getTimeEntry(id: string): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    return entry;
  }

  async getActiveTimeEntry(employeeId: string): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries).where(
      and(eq(timeEntries.employeeId, employeeId), eq(timeEntries.status, "active"))
    );
    return entry;
  }

  async getTimeEntriesByCompany(companyId: string): Promise<TimeEntry[]> {
    return db.select().from(timeEntries).where(eq(timeEntries.companyId, companyId));
  }

  async getTimeEntriesByEmployee(employeeId: string): Promise<TimeEntry[]> {
    return db.select().from(timeEntries).where(eq(timeEntries.employeeId, employeeId));
  }

  async updateTimeEntry(id: string, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const [entry] = await db.update(timeEntries).set(data).where(eq(timeEntries.id, id)).returning();
    return entry;
  }

  async createAttendanceAdjustment(data: InsertAttendanceAdjustment): Promise<AttendanceAdjustment> {
    const [row] = await db.insert(attendanceAdjustments).values(data as any).returning();
    return row;
  }

  async getAttendanceAdjustmentsByEntry(timeEntryId: string): Promise<AttendanceAdjustment[]> {
    return db.select().from(attendanceAdjustments)
      .where(eq(attendanceAdjustments.timeEntryId, timeEntryId))
      .orderBy(desc(attendanceAdjustments.createdAt));
  }

  async getAttendanceAdjustmentsByCompany(companyId: string): Promise<AttendanceAdjustment[]> {
    return db.select().from(attendanceAdjustments)
      .where(and(eq(attendanceAdjustments.companyId, companyId), eq(attendanceAdjustments.isVoided, false)));
  }

  async getAttendanceAdjustmentsByEmployee(employeeId: string): Promise<AttendanceAdjustment[]> {
    return db.select().from(attendanceAdjustments)
      .where(and(eq(attendanceAdjustments.employeeId, employeeId), eq(attendanceAdjustments.isVoided, false)));
  }

  async getAttendanceAdjustmentById(id: string): Promise<AttendanceAdjustment | undefined> {
    const [row] = await db.select().from(attendanceAdjustments).where(eq(attendanceAdjustments.id, id));
    return row;
  }

  async voidAttendanceAdjustment(id: string, voidedByUserId: string): Promise<AttendanceAdjustment | undefined> {
    const [row] = await db.update(attendanceAdjustments)
      .set({ isVoided: true, voidedByUserId, voidedAt: new Date().toISOString() })
      .where(eq(attendanceAdjustments.id, id))
      .returning();
    return row;
  }

  async createClientRequest(data: InsertClientRequest): Promise<ClientRequest> {
    const [request] = await db.insert(clientRequests).values(data).returning();
    return request;
  }

  async getClientRequest(id: string): Promise<ClientRequest | undefined> {
    const [request] = await db.select().from(clientRequests).where(eq(clientRequests.id, id));
    return request;
  }

  async getClientRequestsByCompany(companyId: string): Promise<ClientRequest[]> {
    return db.select().from(clientRequests).where(eq(clientRequests.companyId, companyId));
  }

  async getClientRequestsByClient(clientId: string): Promise<ClientRequest[]> {
    return db.select().from(clientRequests).where(eq(clientRequests.clientId, clientId));
  }

  async getClientRequestsByEmployee(employeeId: string): Promise<ClientRequest[]> {
    return db.select().from(clientRequests).where(eq(clientRequests.employeeId, employeeId));
  }

  async updateClientRequest(id: string, data: Partial<InsertClientRequest>): Promise<ClientRequest | undefined> {
    const [request] = await db.update(clientRequests).set(data).where(eq(clientRequests.id, id)).returning();
    return request;
  }

  async createRequestMessage(data: InsertRequestMessage): Promise<RequestMessage> {
    const [msg] = await db.insert(requestMessages).values(data).returning();
    return msg;
  }

  async getRequestMessage(id: string): Promise<RequestMessage | undefined> {
    const [msg] = await db.select().from(requestMessages).where(eq(requestMessages.id, id));
    return msg;
  }

  async getRequestMessages(requestId: string): Promise<RequestMessage[]> {
    return db.select().from(requestMessages)
      .where(eq(requestMessages.requestId, requestId))
      .orderBy(requestMessages.createdAt);
  }

  async createRequestAttachment(data: InsertRequestAttachment): Promise<RequestAttachment> {
    const [att] = await db.insert(requestAttachments).values(data).returning();
    return att;
  }

  async getRequestAttachmentsByMessage(messageId: string): Promise<RequestAttachment[]> {
    return db.select().from(requestAttachments).where(eq(requestAttachments.requestMessageId, messageId));
  }

  async getRequestAttachmentsByMessageIds(messageIds: string[]): Promise<RequestAttachment[]> {
    if (!messageIds.length) return [];
    const rows = await Promise.all(messageIds.map(id => this.getRequestAttachmentsByMessage(id)));
    return rows.flat();
  }

  async getRequestAttachment(id: string): Promise<RequestAttachment | undefined> {
    const [att] = await db.select().from(requestAttachments).where(eq(requestAttachments.id, id));
    return att;
  }

  async createTimesheet(data: InsertTimesheet): Promise<Timesheet> {
    const [row] = await db.insert(timesheets).values(data).returning();
    return row;
  }
  async getTimesheet(id: string): Promise<Timesheet | undefined> {
    const [row] = await db.select().from(timesheets).where(eq(timesheets.id, id));
    return row;
  }
  async getTimesheetByEmployeeAndPeriod(employeeId: string, periodStart: string): Promise<Timesheet | undefined> {
    const [row] = await db.select().from(timesheets).where(
      and(eq(timesheets.employeeId, employeeId), eq(timesheets.payPeriodStart, periodStart))
    );
    return row;
  }
  async getTimesheetsByCompany(companyId: string): Promise<Timesheet[]> {
    return db.select().from(timesheets).where(eq(timesheets.companyId, companyId)).orderBy(desc(timesheets.payPeriodStart));
  }
  async getTimesheetsByEmployee(employeeId: string): Promise<Timesheet[]> {
    return db.select().from(timesheets).where(eq(timesheets.employeeId, employeeId)).orderBy(desc(timesheets.payPeriodStart));
  }
  async updateTimesheet(id: string, data: Partial<InsertTimesheet>): Promise<Timesheet | undefined> {
    const [row] = await db.update(timesheets).set(data).where(eq(timesheets.id, id)).returning();
    return row;
  }

  async getPayrollDeductionsByCompany(companyId: string): Promise<PayrollDeduction[]> {
    return db.select().from(payrollDeductions).where(eq(payrollDeductions.companyId, companyId));
  }

  async createPayrollDeduction(data: InsertPayrollDeduction): Promise<PayrollDeduction> {
    const [deduction] = await db.insert(payrollDeductions).values(data).returning();
    return deduction;
  }

  async updatePayrollDeduction(id: string, data: Partial<InsertPayrollDeduction>): Promise<PayrollDeduction | undefined> {
    const [deduction] = await db.update(payrollDeductions).set(data).where(eq(payrollDeductions.id, id)).returning();
    return deduction;
  }

  async deletePayrollDeduction(id: string): Promise<void> {
    await db.delete(payrollDeductions).where(eq(payrollDeductions.id, id));
  }

  // ── Work Submissions ────────────────────────────────────────────────────────
  async createWorkSubmission(data: InsertWorkSubmission): Promise<WorkSubmission> {
    const [row] = await db.insert(workSubmissions).values(data).returning();
    return row;
  }
  async getWorkSubmission(id: string): Promise<WorkSubmission | undefined> {
    const [row] = await db.select().from(workSubmissions).where(eq(workSubmissions.id, id));
    return row;
  }
  async getWorkSubmissionsByEmployee(employeeId: string): Promise<WorkSubmission[]> {
    return db.select().from(workSubmissions).where(eq(workSubmissions.employeeId, employeeId)).orderBy(desc(workSubmissions.createdAt));
  }
  async getWorkSubmissionsByCompany(companyId: string): Promise<WorkSubmission[]> {
    return db.select().from(workSubmissions).where(eq(workSubmissions.companyId, companyId)).orderBy(desc(workSubmissions.createdAt));
  }
  async updateWorkSubmission(id: string, data: Partial<InsertWorkSubmission>): Promise<WorkSubmission | undefined> {
    const [row] = await db.update(workSubmissions).set(data).where(eq(workSubmissions.id, id)).returning();
    return row;
  }
  async deleteWorkSubmission(id: string): Promise<void> {
    await db.delete(workSubmissions).where(eq(workSubmissions.id, id));
  }
  async generateShortCode(checkFn: (code: string) => Promise<boolean>): Promise<string> {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 20; attempt++) {
      let code = "";
      const { randomBytes } = await import("crypto");
      const bytes = randomBytes(7);
      for (let i = 0; i < 7; i++) code += chars[bytes[i] % chars.length];
      const taken = await checkFn(code);
      if (!taken) return code;
    }
    throw new Error("Could not generate unique short code after 20 attempts");
  }
  async generateWorkSubmissionShareToken(id: string): Promise<WorkSubmission | undefined> {
    const { randomBytes } = await import("crypto");
    const token = randomBytes(32).toString("hex");
    const shortCode = await this.generateShortCode(async (c) => {
      const [existing] = await db.select({ id: workSubmissions.id })
        .from(workSubmissions).where(eq(workSubmissions.reportShortCode, c));
      return !!existing;
    });
    const [row] = await db.update(workSubmissions)
      .set({ publicShareToken: token, publicShareEnabled: true, reportShortCode: shortCode })
      .where(eq(workSubmissions.id, id))
      .returning();
    return row;
  }
  async getWorkSubmissionByToken(token: string): Promise<WorkSubmission | undefined> {
    const [row] = await db.select().from(workSubmissions)
      .where(eq(workSubmissions.publicShareToken, token));
    return row;
  }
  async getWorkSubmissionByShortCode(code: string): Promise<WorkSubmission | undefined> {
    const [row] = await db.select().from(workSubmissions)
      .where(eq(workSubmissions.reportShortCode, code));
    return row;
  }
  async generateReportShortCodeOnly(id: string): Promise<WorkSubmission | undefined> {
    const shortCode = await this.generateShortCode(async (c) => {
      const [existing] = await db.select({ id: workSubmissions.id })
        .from(workSubmissions).where(eq(workSubmissions.reportShortCode, c));
      return !!existing;
    });
    const [row] = await db.update(workSubmissions)
      .set({ reportShortCode: shortCode })
      .where(eq(workSubmissions.id, id))
      .returning();
    return row;
  }

  async createWorkSubmissionItem(data: InsertWorkSubmissionItem): Promise<WorkSubmissionItem> {
    const [row] = await db.insert(workSubmissionItems).values(data).returning();
    return row;
  }
  async getWorkSubmissionItem(id: string): Promise<WorkSubmissionItem | undefined> {
    const [row] = await db.select().from(workSubmissionItems).where(eq(workSubmissionItems.id, id));
    return row;
  }
  async getWorkSubmissionItems(submissionId: string): Promise<WorkSubmissionItem[]> {
    return db.select().from(workSubmissionItems).where(eq(workSubmissionItems.submissionId, submissionId)).orderBy(workSubmissionItems.sortOrder);
  }
  async updateWorkSubmissionItem(id: string, data: Partial<InsertWorkSubmissionItem>): Promise<WorkSubmissionItem | undefined> {
    const [row] = await db.update(workSubmissionItems).set(data).where(eq(workSubmissionItems.id, id)).returning();
    return row;
  }
  async deleteWorkSubmissionItem(id: string): Promise<void> {
    await db.delete(workSubmissionItems).where(eq(workSubmissionItems.id, id));
  }

  async createWorkSubmissionPhoto(data: InsertWorkSubmissionPhoto): Promise<WorkSubmissionPhoto> {
    const [row] = await db.insert(workSubmissionPhotos).values(data).returning();
    return row;
  }
  async getWorkSubmissionPhoto(id: string): Promise<WorkSubmissionPhoto | undefined> {
    const [row] = await db.select().from(workSubmissionPhotos).where(eq(workSubmissionPhotos.id, id));
    return row;
  }
  async getWorkSubmissionPhotosByItem(submissionItemId: string): Promise<WorkSubmissionPhoto[]> {
    return db.select().from(workSubmissionPhotos).where(eq(workSubmissionPhotos.submissionItemId, submissionItemId));
  }
  async getWorkSubmissionPhotosByItemIds(itemIds: string[]): Promise<WorkSubmissionPhoto[]> {
    if (!itemIds.length) return [];
    return db.select().from(workSubmissionPhotos).where(inArray(workSubmissionPhotos.submissionItemId, itemIds));
  }
  async deleteWorkSubmissionPhoto(id: string): Promise<void> {
    await db.delete(workSubmissionPhotos).where(eq(workSubmissionPhotos.id, id));
  }

  // ── Super Admin ──────────────────────────────────────────────────────────────
  async getAllCompanies(): Promise<Company[]> {
    return db.select().from(companies).orderBy(companies.name);
  }

  async getPlatformStats(): Promise<{
    totalBusinesses: number;
    activeBusinesses: number;
    suspendedBusinesses: number;
    pendingBusinesses: number;
    mrr: number;
    arr: number;
  }> {
    const allCompanies = await db.select().from(companies);
    const totalBusinesses = allCompanies.length;
    const activeBusinesses = allCompanies.filter(c => c.accountStatus === "active").length;
    const suspendedBusinesses = allCompanies.filter(c => c.accountStatus === "suspended").length;
    const pendingBusinesses = allCompanies.filter(c => c.accountStatus === "pending_activation").length;

    const planPrices: Record<string, number> = {
      starter: 29,
      growth: 79,
      pro: 129,
      legacy: 0,
    };

    let mrr = 0;
    for (const c of allCompanies) {
      if (c.subscriptionStatus === "active" && c.planCode !== "legacy") {
        const monthly = planPrices[c.planCode] ?? 0;
        mrr += c.billingCycle === "yearly" ? Math.round(monthly * 12 * 0.9) / 12 : monthly;
      }
    }

    return {
      totalBusinesses,
      activeBusinesses,
      suspendedBusinesses,
      pendingBusinesses,
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
    };
  }

  // ── Platform Messages ────────────────────────────────────────────────────────
  async createPlatformMessage(data: InsertPlatformMessage): Promise<PlatformMessage> {
    const [msg] = await db.insert(platformMessages).values(data).returning();
    return msg;
  }

  async getPlatformMessagesByCompany(companyId: string): Promise<PlatformMessage[]> {
    return db.select().from(platformMessages)
      .where(eq(platformMessages.companyId, companyId))
      .orderBy(desc(platformMessages.createdAt));
  }

  async getBroadcastMessages(): Promise<PlatformMessage[]> {
    return db.select().from(platformMessages)
      .where(eq(platformMessages.isBroadcast, true))
      .orderBy(desc(platformMessages.createdAt));
  }

  async getMessagesForCompany(companyId: string): Promise<PlatformMessage[]> {
    // Look up the company's creation date so we can filter out broadcasts
    // that were sent before this company existed
    const [company] = await db.select({ createdAt: companies.createdAt })
      .from(companies)
      .where(eq(companies.id, companyId));
    const companyCreatedAt = company?.createdAt ?? null;

    const broadcastCondition = companyCreatedAt
      // New companies: only broadcasts created at or after this company signed up
      ? and(eq(platformMessages.isBroadcast, true), gte(platformMessages.createdAt, companyCreatedAt))
      // Legacy companies without a createdAt: include all broadcasts (backward compatible)
      : eq(platformMessages.isBroadcast, true);

    return db.select().from(platformMessages)
      .where(
        or(
          eq(platformMessages.companyId, companyId),
          broadcastCondition
        )
      )
      .orderBy(desc(platformMessages.createdAt));
  }

  async markPlatformMessageRead(id: string): Promise<void> {
    await db.update(platformMessages).set({ isRead: true }).where(eq(platformMessages.id, id));
  }

  async getAllPlatformMessages(): Promise<PlatformMessage[]> {
    return db.select().from(platformMessages).orderBy(desc(platformMessages.createdAt));
  }

  async getPlatformMessage(id: string): Promise<PlatformMessage | undefined> {
    const [msg] = await db.select().from(platformMessages).where(eq(platformMessages.id, id));
    return msg;
  }

  async updatePlatformMessage(id: string, data: Partial<InsertPlatformMessage>): Promise<void> {
    await db.update(platformMessages).set(data).where(eq(platformMessages.id, id));
  }

  async createBroadcastEmailDelivery(data: Omit<BroadcastEmailDelivery, "id">): Promise<BroadcastEmailDelivery> {
    const [row] = await db.insert(broadcastEmailDeliveries).values(data as any).returning();
    return row;
  }

  async createWelcomeEmailDelivery(data: Omit<WelcomeEmailDelivery, "id">): Promise<WelcomeEmailDelivery> {
    const [row] = await db.insert(welcomeEmailDeliveries).values(data as any).returning();
    return row;
  }

  async getWelcomeEmailDeliveryByBusinessId(businessId: string): Promise<WelcomeEmailDelivery | undefined> {
    const [row] = await db.select().from(welcomeEmailDeliveries).where(eq(welcomeEmailDeliveries.businessId, businessId));
    return row;
  }

  // ── Pay Runs ─────────────────────────────────────────────────────────────────
  async createPayRun(data: InsertPayRun): Promise<PayRun> {
    const [run] = await db.insert(payRuns).values(data).returning();
    return run;
  }

  async getPayRun(id: string): Promise<PayRun | undefined> {
    const [run] = await db.select().from(payRuns).where(eq(payRuns.id, id));
    return run;
  }

  async getPayRunsByCompany(companyId: string): Promise<PayRun[]> {
    return db.select().from(payRuns).where(eq(payRuns.companyId, companyId)).orderBy(desc(payRuns.periodStart));
  }

  async updatePayRun(id: string, data: Partial<InsertPayRun>): Promise<PayRun | undefined> {
    const [run] = await db.update(payRuns).set(data).where(eq(payRuns.id, id)).returning();
    return run;
  }

  async deletePayRun(id: string): Promise<void> {
    await db.delete(payRuns).where(eq(payRuns.id, id));
  }

  // ── Pay Stubs ─────────────────────────────────────────────────────────────────
  async createPayStub(data: InsertPayStub): Promise<PayStub> {
    const [stub] = await db.insert(payStubs).values(data).returning();
    return stub;
  }

  async getPayStub(id: string): Promise<PayStub | undefined> {
    const [stub] = await db.select().from(payStubs).where(eq(payStubs.id, id));
    return stub;
  }

  async getPayStubsByCompany(companyId: string): Promise<PayStub[]> {
    return db.select().from(payStubs).where(eq(payStubs.companyId, companyId)).orderBy(desc(payStubs.createdAt));
  }

  async getPayStubsByPayRun(payRunId: string): Promise<PayStub[]> {
    return db.select().from(payStubs).where(eq(payStubs.payRunId, payRunId)).orderBy(desc(payStubs.createdAt));
  }

  async getPayStubsByEmployee(employeeId: string, companyId: string): Promise<PayStub[]> {
    return db.select().from(payStubs)
      .where(and(eq(payStubs.employeeId, employeeId), eq(payStubs.companyId, companyId)))
      .orderBy(desc(payStubs.periodStart));
  }

  async getPublishedPayStubsByEmployee(employeeId: string, companyId: string): Promise<PayStub[]> {
    return db.select().from(payStubs)
      .where(and(
        eq(payStubs.employeeId, employeeId),
        eq(payStubs.companyId, companyId),
        sql`${payStubs.status} IN ('confirmed_paid', 'published')`,
        sql`${payStubs.employeeVisibleAt} IS NOT NULL`
      ))
      .orderBy(desc(payStubs.periodStart));
  }

  async updatePayStub(id: string, data: Partial<InsertPayStub>): Promise<PayStub | undefined> {
    const [stub] = await db.update(payStubs).set(data).where(eq(payStubs.id, id)).returning();
    return stub;
  }

  async deletePayStub(id: string): Promise<void> {
    await db.delete(payStubs).where(eq(payStubs.id, id));
  }

  // ── Pay Stub Earnings ─────────────────────────────────────────────────────────
  async createPayStubEarning(data: InsertPayStubEarning): Promise<PayStubEarning> {
    const [earning] = await db.insert(payStubEarnings).values(data).returning();
    return earning;
  }

  async getPayStubEarnings(payStubId: string): Promise<PayStubEarning[]> {
    return db.select().from(payStubEarnings).where(eq(payStubEarnings.payStubId, payStubId)).orderBy(payStubEarnings.displayOrder);
  }

  async updatePayStubEarning(id: string, data: Partial<InsertPayStubEarning>): Promise<PayStubEarning | undefined> {
    const [earning] = await db.update(payStubEarnings).set(data).where(eq(payStubEarnings.id, id)).returning();
    return earning;
  }

  async deletePayStubEarning(id: string): Promise<void> {
    await db.delete(payStubEarnings).where(eq(payStubEarnings.id, id));
  }

  async deletePayStubEarningsByStub(payStubId: string): Promise<void> {
    await db.delete(payStubEarnings).where(eq(payStubEarnings.payStubId, payStubId));
  }

  // ── Pay Stub Deductions ───────────────────────────────────────────────────────
  async createPayStubDeduction(data: InsertPayStubDeduction): Promise<PayStubDeduction> {
    const [deduction] = await db.insert(payStubDeductions).values(data).returning();
    return deduction;
  }

  async getPayStubDeductions(payStubId: string): Promise<PayStubDeduction[]> {
    return db.select().from(payStubDeductions).where(eq(payStubDeductions.payStubId, payStubId)).orderBy(payStubDeductions.displayOrder);
  }

  async updatePayStubDeduction(id: string, data: Partial<InsertPayStubDeduction>): Promise<PayStubDeduction | undefined> {
    const [deduction] = await db.update(payStubDeductions).set(data).where(eq(payStubDeductions.id, id)).returning();
    return deduction;
  }

  async deletePayStubDeduction(id: string): Promise<void> {
    await db.delete(payStubDeductions).where(eq(payStubDeductions.id, id));
  }

  async deletePayStubDeductionsByStub(payStubId: string): Promise<void> {
    await db.delete(payStubDeductions).where(eq(payStubDeductions.payStubId, payStubId));
  }

  // ── Pay Stub Audit Log ────────────────────────────────────────────────────────
  async createPayStubAuditLog(data: Omit<PayStubAuditLog, "id">): Promise<PayStubAuditLog> {
    const [entry] = await db.insert(payStubAuditLog).values(data).returning();
    return entry;
  }

  async getPayStubAuditLog(payStubId: string): Promise<PayStubAuditLog[]> {
    return db.select().from(payStubAuditLog)
      .where(eq(payStubAuditLog.payStubId, payStubId))
      .orderBy(desc(payStubAuditLog.createdAt));
  }

  // ── Work Submission Reviews ────────────────────────────────────────────────────
  async createWorkSubmissionReview(data: InsertWorkSubmissionReview): Promise<WorkSubmissionReview> {
    const reviewShortCode = await this.generateShortCode(async (c) => {
      const [existing] = await db.select({ id: workSubmissionReviews.id })
        .from(workSubmissionReviews).where(eq(workSubmissionReviews.reviewShortCode, c));
      return !!existing;
    });
    const withToken = { ...data, reviewShareToken: crypto.randomUUID(), reviewShortCode };
    const [review] = await db.insert(workSubmissionReviews).values(withToken).returning();
    return review;
  }

  async getWorkSubmissionReviewBySubmissionId(submissionId: string): Promise<WorkSubmissionReview | undefined> {
    const [review] = await db.select().from(workSubmissionReviews)
      .where(eq(workSubmissionReviews.submissionId, submissionId))
      .orderBy(desc(workSubmissionReviews.createdAt))
      .limit(1);
    return review;
  }

  async getWorkSubmissionReviewByShareToken(reviewShareToken: string): Promise<WorkSubmissionReview | undefined> {
    const [review] = await db.select().from(workSubmissionReviews)
      .where(eq(workSubmissionReviews.reviewShareToken, reviewShareToken))
      .limit(1);
    return review;
  }

  async getWorkSubmissionReviewByShortCode(code: string): Promise<WorkSubmissionReview | undefined> {
    const [review] = await db.select().from(workSubmissionReviews)
      .where(eq(workSubmissionReviews.reviewShortCode, code))
      .limit(1);
    return review;
  }

  async generateReviewShortCodeOnly(id: string): Promise<WorkSubmissionReview | undefined> {
    const reviewShortCode = await this.generateShortCode(async (c) => {
      const [existing] = await db.select({ id: workSubmissionReviews.id })
        .from(workSubmissionReviews).where(eq(workSubmissionReviews.reviewShortCode, c));
      return !!existing;
    });
    const [row] = await db.update(workSubmissionReviews)
      .set({ reviewShortCode })
      .where(eq(workSubmissionReviews.id, id))
      .returning();
    return row;
  }

  async getWorkSubmissionReviewsByCompany(companyId: string): Promise<WorkSubmissionReview[]> {
    return db.select().from(workSubmissionReviews)
      .where(eq(workSubmissionReviews.companyId, companyId))
      .orderBy(desc(workSubmissionReviews.createdAt));
  }

  async getSubmissionIdsWithReviews(companyId: string): Promise<Set<string>> {
    const rows = await db.select({ submissionId: workSubmissionReviews.submissionId })
      .from(workSubmissionReviews)
      .where(eq(workSubmissionReviews.companyId, companyId));
    return new Set(rows.map(r => r.submissionId));
  }

  async createPasswordResetToken(data: { userId: string; email: string; tokenHash: string; expiresAt: Date; ipAddress?: string; userAgent?: string }): Promise<void> {
    await db.insert(passwordResetTokens).values({
      userId: data.userId,
      email: data.email,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });
  }

  async getPasswordResetTokenByHash(tokenHash: string): Promise<import("@shared/schema").PasswordResetToken | undefined> {
    const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash));
    return rows[0];
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
  }

  async invalidatePasswordResetTokensForUser(userId: string): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
  }

  // ─── Reports ───────────────────────────────────────────────────────────────
  async createReport(data: InsertReport): Promise<Report> {
    const [row] = await db.insert(reports).values(data).returning();
    return row;
  }

  async getReport(id: string, companyId: string): Promise<Report | undefined> {
    const [row] = await db.select().from(reports)
      .where(and(eq(reports.id, id), eq(reports.companyId, companyId)));
    return row;
  }

  async getReportsByCompany(companyId: string): Promise<Report[]> {
    return db.select().from(reports)
      .where(eq(reports.companyId, companyId))
      .orderBy(desc(reports.createdAt));
  }

  async getReportsForEmployee(employeeId: string, companyId: string): Promise<Report[]> {
    return db.select().from(reports)
      .where(and(
        eq(reports.companyId, companyId),
        eq(reports.assignedEmployeeId, employeeId),
        eq(reports.sentToEmployee, true),
      ))
      .orderBy(desc(reports.createdAt));
  }

  async getReportsForClient(clientId: string, companyId: string): Promise<Report[]> {
    return db.select().from(reports)
      .where(and(
        eq(reports.companyId, companyId),
        eq(reports.assignedClientId, clientId),
        eq(reports.sentToClient, true),
      ))
      .orderBy(desc(reports.createdAt));
  }

  async getReportsCreatedBy(userId: string, companyId: string): Promise<Report[]> {
    return db.select().from(reports)
      .where(and(eq(reports.companyId, companyId), eq(reports.createdByUserId, userId)))
      .orderBy(desc(reports.createdAt));
  }

  async updateReport(id: string, companyId: string, data: Partial<InsertReport>): Promise<Report | undefined> {
    const [row] = await db.update(reports)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(reports.id, id), eq(reports.companyId, companyId)))
      .returning();
    return row;
  }

  async deleteReport(id: string, companyId: string): Promise<void> {
    await db.delete(reports).where(and(eq(reports.id, id), eq(reports.companyId, companyId)));
  }

  async createReportSignature(data: InsertReportSignature): Promise<ReportSignature> {
    const [row] = await db.insert(reportSignatures).values(data).returning();
    return row;
  }

  async getReportSignatures(reportId: string): Promise<ReportSignature[]> {
    return db.select().from(reportSignatures).where(eq(reportSignatures.reportId, reportId));
  }

  async getReportSignatureByUser(reportId: string, userId: string): Promise<ReportSignature | undefined> {
    const [row] = await db.select().from(reportSignatures)
      .where(and(eq(reportSignatures.reportId, reportId), eq(reportSignatures.signerUserId, userId)));
    return row;
  }

  async getReportSignatureByToken(reportId: string, tokenId: string): Promise<ReportSignature | undefined> {
    const [row] = await db.select().from(reportSignatures)
      .where(and(eq(reportSignatures.reportId, reportId), eq(reportSignatures.publicAccessTokenId, tokenId)));
    return row;
  }

  async createReportActivity(data: Omit<ReportActivityLog, "id">): Promise<ReportActivityLog> {
    const [row] = await db.insert(reportActivityLog).values(data as any).returning();
    return row;
  }

  async getReportActivity(reportId: string): Promise<ReportActivityLog[]> {
    return db.select().from(reportActivityLog)
      .where(eq(reportActivityLog.reportId, reportId))
      .orderBy(desc(reportActivityLog.createdAt));
  }

  // Report Access Tokens
  async createReportAccessToken(data: Omit<ReportAccessToken, "id">): Promise<ReportAccessToken> {
    const [row] = await db.insert(reportAccessTokens).values(data as any).returning();
    return row;
  }

  async getReportAccessTokenByHash(tokenHash: string): Promise<ReportAccessToken | undefined> {
    const [row] = await db.select().from(reportAccessTokens)
      .where(eq(reportAccessTokens.tokenHash, tokenHash));
    return row;
  }

  async updateReportAccessToken(id: string, data: Partial<ReportAccessToken>): Promise<ReportAccessToken | undefined> {
    const [row] = await db.update(reportAccessTokens).set(data as any)
      .where(eq(reportAccessTokens.id, id)).returning();
    return row;
  }

  async revokeReportAccessTokensByReport(reportId: string): Promise<void> {
    await db.update(reportAccessTokens)
      .set({ revokedAt: new Date().toISOString() } as any)
      .where(and(
        eq(reportAccessTokens.reportId, reportId),
        isNull(reportAccessTokens.revokedAt),
      ));
  }

  // ── Field Notes ─────────────────────────────────────────────────────────────
  async createFieldNotesSession(data: InsertFieldNotesSession): Promise<FieldNotesSession> {
    const [row] = await db.insert(fieldNotesSessions).values(data as any).returning();
    return row;
  }

  async getFieldNotesSession(id: string): Promise<FieldNotesSession | undefined> {
    const [row] = await db.select().from(fieldNotesSessions).where(eq(fieldNotesSessions.id, id));
    return row;
  }

  async getFieldNotesSessions(companyId: string, filters?: { locationId?: string; userId?: string; status?: string }): Promise<FieldNotesSession[]> {
    const conditions = [
      eq(fieldNotesSessions.companyId, companyId),
      isNull(fieldNotesSessions.deletedAt),
    ];
    if (filters?.locationId) conditions.push(eq(fieldNotesSessions.locationId, filters.locationId));
    if (filters?.userId) conditions.push(eq(fieldNotesSessions.createdByUserId, filters.userId));
    if (filters?.status) conditions.push(eq(fieldNotesSessions.status, filters.status));
    return db.select().from(fieldNotesSessions)
      .where(and(...conditions))
      .orderBy(desc(fieldNotesSessions.startedAt));
  }

  async updateFieldNotesSession(id: string, data: Partial<FieldNotesSession>): Promise<FieldNotesSession | undefined> {
    const [row] = await db.update(fieldNotesSessions)
      .set({ ...data, updatedAt: new Date().toISOString() } as any)
      .where(eq(fieldNotesSessions.id, id)).returning();
    return row;
  }

  async addFieldNotesAsset(data: InsertFieldNotesAsset): Promise<FieldNotesAsset> {
    const [row] = await db.insert(fieldNotesAssets).values(data as any).returning();
    return row;
  }

  async getFieldNotesAssets(sessionId: string): Promise<FieldNotesAsset[]> {
    return db.select().from(fieldNotesAssets)
      .where(eq(fieldNotesAssets.sessionId, sessionId))
      .orderBy(asc(fieldNotesAssets.sequenceIndex));
  }

  async addFieldNotesTranscriptChunk(data: Omit<FieldNotesTranscriptChunk, "id">): Promise<FieldNotesTranscriptChunk> {
    const [row] = await db.insert(fieldNotesTranscriptChunks).values(data as any).returning();
    return row;
  }

  async getFieldNotesTranscriptChunks(sessionId: string): Promise<FieldNotesTranscriptChunk[]> {
    return db.select().from(fieldNotesTranscriptChunks)
      .where(eq(fieldNotesTranscriptChunks.sessionId, sessionId))
      .orderBy(asc(fieldNotesTranscriptChunks.chunkIndex));
  }

  async createFieldNotesEntry(data: InsertFieldNotesEntry): Promise<FieldNotesEntry> {
    const [row] = await db.insert(fieldNotesEntries).values(data as any).returning();
    return row;
  }

  async getFieldNotesEntries(sessionId: string): Promise<FieldNotesEntry[]> {
    return db.select().from(fieldNotesEntries)
      .where(eq(fieldNotesEntries.sessionId, sessionId))
      .orderBy(asc(fieldNotesEntries.sortOrder));
  }

  async updateFieldNotesEntry(id: string, data: Partial<FieldNotesEntry>): Promise<FieldNotesEntry | undefined> {
    const [row] = await db.update(fieldNotesEntries)
      .set({ ...data, updatedAt: new Date().toISOString() } as any)
      .where(eq(fieldNotesEntries.id, id)).returning();
    return row;
  }

  async getFieldNotesEntryTags(sessionId: string): Promise<FieldNotesEntryTag[]> {
    return db.select().from(fieldNotesEntryTags)
      .where(eq(fieldNotesEntryTags.sessionId, sessionId));
  }

  async updateFieldNotesAsset(id: string, data: Partial<Pick<FieldNotesAsset, "caption" | "phase" | "areaLabel" | "isHiddenFromPublic">>): Promise<FieldNotesAsset | undefined> {
    const [row] = await db.update(fieldNotesAssets).set(data as any).where(eq(fieldNotesAssets.id, id)).returning();
    return row;
  }

  async getFieldNotesTodos(sessionId: string): Promise<FieldNotesTodo[]> {
    return db.select().from(fieldNotesTodos)
      .where(eq(fieldNotesTodos.sessionId, sessionId))
      .orderBy(asc(fieldNotesTodos.sortOrder));
  }

  async createFieldNotesTodo(data: InsertFieldNotesTodo): Promise<FieldNotesTodo> {
    const [row] = await db.insert(fieldNotesTodos).values(data as any).returning();
    return row;
  }

  async updateFieldNotesTodo(id: string, data: Partial<Pick<FieldNotesTodo, "text" | "isComplete" | "sortOrder">>): Promise<FieldNotesTodo | undefined> {
    const [row] = await db.update(fieldNotesTodos).set(data as any).where(eq(fieldNotesTodos.id, id)).returning();
    return row;
  }

  async deleteFieldNotesTodo(id: string): Promise<void> {
    await db.delete(fieldNotesTodos).where(eq(fieldNotesTodos.id, id));
  }

  // ── Priority Clean Alerts ─────────────────────────────────────────────────
  async createPriorityCleanAlert(data: InsertPriorityCleanAlert): Promise<PriorityCleanAlert> {
    const [row] = await db.insert(priorityCleanAlerts).values(data as any).returning();
    return row;
  }

  async getPriorityCleanAlert(id: string): Promise<PriorityCleanAlert | undefined> {
    const [row] = await db.select().from(priorityCleanAlerts).where(eq(priorityCleanAlerts.id, id));
    return row;
  }

  async getPriorityCleanAlertsByCompany(companyId: string): Promise<PriorityCleanAlert[]> {
    return db.select().from(priorityCleanAlerts)
      .where(eq(priorityCleanAlerts.companyId, companyId))
      .orderBy(desc(priorityCleanAlerts.createdAt));
  }

  async getOpenPriorityCleanAlertsByEmployee(employeeId: string, companyId: string): Promise<PriorityCleanAlert[]> {
    return db.select().from(priorityCleanAlerts)
      .where(and(
        eq(priorityCleanAlerts.companyId, companyId),
        eq(priorityCleanAlerts.status, "open"),
        eq(priorityCleanAlerts.assignedEmployeeId, employeeId),
      ))
      .orderBy(desc(priorityCleanAlerts.createdAt));
  }

  async getOpenPriorityCleanAlertsByLocation(locationId: string, companyId: string, employeeId?: string): Promise<PriorityCleanAlert[]> {
    return db.select().from(priorityCleanAlerts)
      .where(and(
        eq(priorityCleanAlerts.locationId, locationId),
        eq(priorityCleanAlerts.companyId, companyId),
        eq(priorityCleanAlerts.status, "open"),
        employeeId
          ? or(isNull(priorityCleanAlerts.assignedEmployeeId), eq(priorityCleanAlerts.assignedEmployeeId, employeeId))
          : undefined,
      ))
      .orderBy(desc(priorityCleanAlerts.createdAt));
  }

  async updatePriorityCleanAlert(id: string, data: Partial<InsertPriorityCleanAlert>): Promise<PriorityCleanAlert | undefined> {
    const [row] = await db.update(priorityCleanAlerts)
      .set({ ...data, updatedAt: new Date().toISOString() } as any)
      .where(eq(priorityCleanAlerts.id, id)).returning();
    return row;
  }

  async deletePriorityCleanAlert(id: string): Promise<void> {
    await db.delete(priorityCleanPhotos).where(eq(priorityCleanPhotos.alertId, id));
    await db.delete(priorityCleanAlerts).where(eq(priorityCleanAlerts.id, id));
  }

  async resolveAlertsForLocation(locationId: string, companyId: string, submissionId: string): Promise<void> {
    const now = new Date().toISOString();
    await db.update(priorityCleanAlerts)
      .set({ status: "resolved", submissionId, resolvedAt: now, updatedAt: now } as any)
      .where(and(
        eq(priorityCleanAlerts.locationId, locationId),
        eq(priorityCleanAlerts.companyId, companyId),
        eq(priorityCleanAlerts.status, "open"),
      ));
  }

  async createPriorityCleanPhoto(data: InsertPriorityCleanPhoto): Promise<PriorityCleanPhoto> {
    const [row] = await db.insert(priorityCleanPhotos).values(data as any).returning();
    return row;
  }

  async getPriorityCleanPhoto(id: string): Promise<PriorityCleanPhoto | undefined> {
    const [row] = await db.select().from(priorityCleanPhotos).where(eq(priorityCleanPhotos.id, id));
    return row;
  }

  async getPriorityCleanPhotosByAlertId(alertId: string): Promise<PriorityCleanPhoto[]> {
    return db.select().from(priorityCleanPhotos)
      .where(eq(priorityCleanPhotos.alertId, alertId))
      .orderBy(asc(priorityCleanPhotos.createdAt));
  }

  async deletePriorityCleanPhotosByAlertId(alertId: string): Promise<void> {
    await db.delete(priorityCleanPhotos).where(eq(priorityCleanPhotos.alertId, alertId));
  }

  async getPriorityCleanAlertBySubmissionId(submissionId: string): Promise<PriorityCleanAlert | undefined> {
    const [row] = await db.select().from(priorityCleanAlerts)
      .where(eq(priorityCleanAlerts.submissionId, submissionId));
    return row;
  }

  // ── Publications ──────────────────────────────────────────────────────────
  async createPublication(data: InsertPublication): Promise<Publication> {
    const [row] = await db.insert(publications).values(data as any).returning();
    return row;
  }

  async getPublication(id: string): Promise<Publication | undefined> {
    const [row] = await db.select().from(publications).where(eq(publications.id, id));
    return row;
  }

  async getPublicationBySlug(slug: string): Promise<Publication | undefined> {
    const [row] = await db.select().from(publications).where(eq(publications.slug, slug));
    return row;
  }

  async getPublicationsByCompany(companyId: string): Promise<Publication[]> {
    return db.select().from(publications)
      .where(eq(publications.companyId, companyId))
      .orderBy(desc(publications.createdAt));
  }

  async updatePublication(id: string, data: Partial<InsertPublication>): Promise<Publication | undefined> {
    const [row] = await db.update(publications).set(data as any).where(eq(publications.id, id)).returning();
    return row;
  }

  async deletePublication(id: string): Promise<void> {
    await db.delete(publicationVotes).where(eq(publicationVotes.publicationId, id));
    await db.delete(publicationPricing).where(eq(publicationPricing.publicationId, id));
    await db.delete(publicationMedia).where(eq(publicationMedia.publicationId, id));
    await db.delete(publicationSections).where(eq(publicationSections.publicationId, id));
    await db.delete(publications).where(eq(publications.id, id));
  }

  async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const rows = await db.select({ id: publications.id }).from(publications).where(eq(publications.slug, slug));
    if (excludeId) return rows.some(r => r.id !== excludeId);
    return rows.length > 0;
  }

  async createPublicationSection(data: InsertPublicationSection): Promise<PublicationSection> {
    const [row] = await db.insert(publicationSections).values(data as any).returning();
    return row;
  }

  async getPublicationSections(publicationId: string): Promise<PublicationSection[]> {
    return db.select().from(publicationSections)
      .where(eq(publicationSections.publicationId, publicationId))
      .orderBy(asc(publicationSections.sortOrder));
  }

  async updatePublicationSection(id: string, data: Partial<InsertPublicationSection>): Promise<PublicationSection | undefined> {
    const [row] = await db.update(publicationSections).set(data as any).where(eq(publicationSections.id, id)).returning();
    return row;
  }

  async deletePublicationSection(id: string): Promise<void> {
    await db.delete(publicationMedia).where(eq(publicationMedia.sectionId, id));
    await db.delete(publicationSections).where(eq(publicationSections.id, id));
  }

  async deletePublicationSectionsByPublication(publicationId: string): Promise<void> {
    await db.delete(publicationSections).where(eq(publicationSections.publicationId, publicationId));
  }

  async createPublicationMedia(data: InsertPublicationMedia): Promise<PublicationMedia> {
    const [row] = await db.insert(publicationMedia).values(data as any).returning();
    return row;
  }

  async getPublicationMedia(publicationId: string): Promise<PublicationMedia[]> {
    return db.select().from(publicationMedia)
      .where(eq(publicationMedia.publicationId, publicationId))
      .orderBy(asc(publicationMedia.sortOrder));
  }

  async getPublicationMediaBySection(sectionId: string): Promise<PublicationMedia[]> {
    return db.select().from(publicationMedia)
      .where(eq(publicationMedia.sectionId, sectionId))
      .orderBy(asc(publicationMedia.sortOrder));
  }

  async updatePublicationMedia(id: string, data: Partial<InsertPublicationMedia>): Promise<PublicationMedia | undefined> {
    const [row] = await db.update(publicationMedia).set(data as any).where(eq(publicationMedia.id, id)).returning();
    return row;
  }

  async deletePublicationMedia(id: string): Promise<void> {
    await db.delete(publicationMedia).where(eq(publicationMedia.id, id));
  }

  async deletePublicationMediaBySection(sectionId: string): Promise<void> {
    await db.delete(publicationMedia).where(eq(publicationMedia.sectionId, sectionId));
  }

  async deletePublicationMediaByPublication(publicationId: string): Promise<void> {
    await db.delete(publicationMedia).where(eq(publicationMedia.publicationId, publicationId));
  }

  async createPublicationPricing(data: InsertPublicationPricing): Promise<PublicationPricing> {
    const [row] = await db.insert(publicationPricing).values(data as any).returning();
    return row;
  }

  async getPublicationPricing(publicationId: string): Promise<PublicationPricing[]> {
    return db.select().from(publicationPricing)
      .where(eq(publicationPricing.publicationId, publicationId))
      .orderBy(asc(publicationPricing.sortOrder));
  }

  async updatePublicationPricing(id: string, data: Partial<InsertPublicationPricing>): Promise<PublicationPricing | undefined> {
    const [row] = await db.update(publicationPricing).set(data as any).where(eq(publicationPricing.id, id)).returning();
    return row;
  }

  async deletePublicationPricing(id: string): Promise<void> {
    await db.delete(publicationPricing).where(eq(publicationPricing.id, id));
  }

  async deletePublicationPricingByPublication(publicationId: string): Promise<void> {
    await db.delete(publicationPricing).where(eq(publicationPricing.publicationId, publicationId));
  }

  async createPublicationVote(data: InsertPublicationVote): Promise<PublicationVote> {
    const [row] = await db.insert(publicationVotes).values(data as any).returning();
    return row;
  }

  async getPublicationVoteCounts(publicationId: string): Promise<{ yes: number; no: number }> {
    const rows = await db.select().from(publicationVotes).where(eq(publicationVotes.publicationId, publicationId));
    const yes = rows.filter(r => r.vote === "yes").length;
    const no = rows.filter(r => r.vote === "no").length;
    return { yes, no };
  }

  async getQuoteFormsByCompany(companyId: string): Promise<QuoteForm[]> {
    return db.select().from(quoteForms).where(eq(quoteForms.companyId, companyId)).orderBy(desc(quoteForms.createdAt));
  }

  async getQuoteForm(id: string): Promise<QuoteForm | undefined> {
    const [row] = await db.select().from(quoteForms).where(eq(quoteForms.id, id));
    return row;
  }

  async getQuoteFormBySlug(companyId: string, slug: string): Promise<QuoteForm | undefined> {
    const [row] = await db.select().from(quoteForms).where(and(eq(quoteForms.companyId, companyId), eq(quoteForms.slug, slug)));
    return row;
  }

  async createQuoteForm(data: InsertQuoteForm): Promise<QuoteForm> {
    const [row] = await db.insert(quoteForms).values(data as any).returning();
    return row;
  }

  async updateQuoteForm(id: string, data: Partial<InsertQuoteForm>): Promise<QuoteForm | undefined> {
    const [row] = await db.update(quoteForms).set(data as any).where(eq(quoteForms.id, id)).returning();
    return row;
  }

  async deleteQuoteForm(id: string): Promise<void> {
    await db.delete(quoteFormSubmissions).where(eq(quoteFormSubmissions.formId, id));
    await db.delete(quoteForms).where(eq(quoteForms.id, id));
  }

  async getQuoteFormSubmissions(formId: string): Promise<QuoteFormSubmission[]> {
    return db.select().from(quoteFormSubmissions).where(eq(quoteFormSubmissions.formId, formId)).orderBy(desc(quoteFormSubmissions.submittedAt));
  }

  async createQuoteFormSubmission(data: InsertQuoteFormSubmission): Promise<QuoteFormSubmission> {
    const [row] = await db.insert(quoteFormSubmissions).values(data as any).returning();
    return row;
  }

  async updateQuoteFormSubmission(id: string, data: Partial<InsertQuoteFormSubmission>): Promise<QuoteFormSubmission | undefined> {
    const [row] = await db.update(quoteFormSubmissions).set(data as any).where(eq(quoteFormSubmissions.id, id)).returning();
    return row;
  }

  async getAllSubmissionsByCompany(companyId: string): Promise<QuoteFormSubmission[]> {
    return db.select().from(quoteFormSubmissions).where(eq(quoteFormSubmissions.companyId, companyId)).orderBy(desc(quoteFormSubmissions.submittedAt));
  }

  async getQuoteFormSubmission(id: string): Promise<QuoteFormSubmission | undefined> {
    const [row] = await db.select().from(quoteFormSubmissions).where(eq(quoteFormSubmissions.id, id));
    return row;
  }

  // ── AI Estimates ──────────────────────────────────────────────────────────
  async getAiEstimateBySubmission(submissionId: string): Promise<AiEstimate | undefined> {
    const [row] = await db.select().from(aiEstimates).where(eq(aiEstimates.submissionId, submissionId)).orderBy(desc(aiEstimates.createdAt));
    return row;
  }

  async createAiEstimate(data: InsertAiEstimate): Promise<AiEstimate> {
    const [row] = await db.insert(aiEstimates).values(data as any).returning();
    return row;
  }

  async updateAiEstimate(id: string, data: Partial<InsertAiEstimate>): Promise<AiEstimate | undefined> {
    const [row] = await db.update(aiEstimates).set(data as any).where(eq(aiEstimates.id, id)).returning();
    return row;
  }

  // ── Form Quotes ───────────────────────────────────────────────────────────
  async getFormQuoteBySubmission(submissionId: string): Promise<FormQuote | undefined> {
    const [row] = await db.select().from(formQuotes).where(eq(formQuotes.submissionId, submissionId)).orderBy(desc(formQuotes.createdAt));
    return row;
  }

  async createFormQuote(data: InsertFormQuote): Promise<FormQuote> {
    const [row] = await db.insert(formQuotes).values(data as any).returning();
    return row;
  }

  async updateFormQuote(id: string, data: Partial<InsertFormQuote>): Promise<FormQuote | undefined> {
    const [row] = await db.update(formQuotes).set(data as any).where(eq(formQuotes.id, id)).returning();
    return row;
  }

  // ── Estimator Settings ────────────────────────────────────────────────────
  async getEstimatorSettings(companyId: string): Promise<EstimatorSettings | undefined> {
    const [row] = await db.select().from(estimatorSettings).where(eq(estimatorSettings.companyId, companyId));
    return row;
  }

  async upsertEstimatorSettings(companyId: string, data: Partial<InsertEstimatorSettings>): Promise<EstimatorSettings> {
    const now = new Date().toISOString();
    const existing = await this.getEstimatorSettings(companyId);
    if (existing) {
      const [row] = await db.update(estimatorSettings).set({ ...data, updatedAt: now } as any).where(eq(estimatorSettings.companyId, companyId)).returning();
      return row;
    }
    const [row] = await db.insert(estimatorSettings).values({ companyId, ...data, updatedAt: now } as any).returning();
    return row;
  }

  // ── Form Email Settings ───────────────────────────────────────────────────
  async getFormEmailSettings(companyId: string): Promise<FormEmailSettings | undefined> {
    const [row] = await db.select().from(formEmailSettings).where(eq(formEmailSettings.companyId, companyId));
    return row;
  }

  async upsertFormEmailSettings(companyId: string, data: Partial<InsertFormEmailSettings>): Promise<FormEmailSettings> {
    const now = new Date().toISOString();
    const existing = await this.getFormEmailSettings(companyId);
    if (existing) {
      const [row] = await db.update(formEmailSettings).set({ ...data, updatedAt: now } as any).where(eq(formEmailSettings.companyId, companyId)).returning();
      return row;
    }
    const [row] = await db.insert(formEmailSettings).values({ companyId, ...data, updatedAt: now } as any).returning();
    return row;
  }

  // ── Lead Activity ─────────────────────────────────────────────────────────
  async getLeadActivity(submissionId: string): Promise<LeadActivity[]> {
    return db.select().from(leadActivity).where(eq(leadActivity.submissionId, submissionId)).orderBy(asc(leadActivity.createdAt));
  }

  async addLeadActivity(data: InsertLeadActivity): Promise<LeadActivity> {
    const [row] = await db.insert(leadActivity).values(data as any).returning();
    return row;
  }

  // ── Proposals ────────────────────────────────────────────────────────────
  async getProposalsByCompany(companyId: string): Promise<Proposal[]> {
    return db.select().from(proposals).where(eq(proposals.companyId, companyId)).orderBy(desc(proposals.createdAt));
  }

  async getProposal(id: string): Promise<Proposal | undefined> {
    const [row] = await db.select().from(proposals).where(eq(proposals.id, id));
    return row;
  }

  async getProposalByToken(token: string): Promise<Proposal | undefined> {
    const [row] = await db.select().from(proposals).where(eq(proposals.publicToken, token));
    return row;
  }

  async createProposal(data: InsertProposal): Promise<Proposal> {
    const [row] = await db.insert(proposals).values(data as any).returning();
    return row;
  }

  async updateProposal(id: string, data: Partial<InsertProposal>): Promise<Proposal | undefined> {
    const [row] = await db.update(proposals).set(data as any).where(eq(proposals.id, id)).returning();
    return row;
  }

  async getNextProposalNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const rows = await db.select().from(proposals).where(eq(proposals.companyId, companyId));
    const seq = String(rows.length + 1).padStart(4, "0");
    return `Q-${year}-${seq}`;
  }

  async getProposalActivityLogs(proposalId: string): Promise<ProposalActivityLog[]> {
    return db.select().from(proposalActivityLogs).where(eq(proposalActivityLogs.proposalId, proposalId)).orderBy(proposalActivityLogs.createdAt);
  }

  async addProposalActivity(data: InsertProposalActivityLog): Promise<ProposalActivityLog> {
    const [row] = await db.insert(proposalActivityLogs).values(data as any).returning();
    return row;
  }

  // ── Agreement Templates ───────────────────────────────────────────────────
  async getAgreementTemplates(companyId: string): Promise<AgreementTemplate[]> {
    return db.select().from(agreementTemplates).where(eq(agreementTemplates.companyId, companyId)).orderBy(desc(agreementTemplates.createdAt));
  }
  async getAgreementTemplate(id: string): Promise<AgreementTemplate | undefined> {
    const [row] = await db.select().from(agreementTemplates).where(eq(agreementTemplates.id, id));
    return row;
  }
  async createAgreementTemplate(data: InsertAgreementTemplate): Promise<AgreementTemplate> {
    const [row] = await db.insert(agreementTemplates).values(data as any).returning();
    return row;
  }
  async updateAgreementTemplate(id: string, data: Partial<InsertAgreementTemplate>): Promise<AgreementTemplate | undefined> {
    const [row] = await db.update(agreementTemplates).set(data as any).where(eq(agreementTemplates.id, id)).returning();
    return row;
  }
  async deleteAgreementTemplate(id: string): Promise<void> {
    await db.delete(agreementTemplates).where(eq(agreementTemplates.id, id));
  }

  // ── Agreements ────────────────────────────────────────────────────────────
  async getAgreementsByCompany(companyId: string): Promise<Agreement[]> {
    return db.select().from(agreements).where(eq(agreements.companyId, companyId)).orderBy(desc(agreements.createdAt));
  }
  async getAgreement(id: string): Promise<Agreement | undefined> {
    const [row] = await db.select().from(agreements).where(eq(agreements.id, id));
    return row;
  }
  async getAgreementByToken(token: string): Promise<Agreement | undefined> {
    const [row] = await db.select().from(agreements).where(eq(agreements.publicToken, token));
    return row;
  }
  async createAgreement(data: InsertAgreement): Promise<Agreement> {
    const [row] = await db.insert(agreements).values(data as any).returning();
    return row;
  }
  async updateAgreement(id: string, data: Partial<InsertAgreement>): Promise<Agreement | undefined> {
    const [row] = await db.update(agreements).set(data as any).where(eq(agreements.id, id)).returning();
    return row;
  }

  // ── Agreement Activity ────────────────────────────────────────────────────
  async getAgreementActivity(agreementId: string): Promise<AgreementActivityLog[]> {
    return db.select().from(agreementActivityLogs).where(eq(agreementActivityLogs.agreementId, agreementId)).orderBy(desc(agreementActivityLogs.createdAt));
  }
  async addAgreementActivity(data: InsertAgreementActivityLog): Promise<AgreementActivityLog> {
    const [row] = await db.insert(agreementActivityLogs).values(data as any).returning();
    return row;
  }

  // ── Quote Request Walkthroughs ─────────────────────────────────────────────
  async createQuoteRequestWalkthrough(data: InsertQuoteRequestWalkthrough): Promise<QuoteRequestWalkthrough> {
    const [row] = await db.insert(quoteRequestWalkthroughs).values(data as any).returning();
    return row;
  }
  async getQuoteRequestWalkthrough(id: string): Promise<QuoteRequestWalkthrough | undefined> {
    const [row] = await db.select().from(quoteRequestWalkthroughs).where(eq(quoteRequestWalkthroughs.id, id));
    return row;
  }
  async getQuoteRequestWalkthroughBySubmission(submissionId: string): Promise<QuoteRequestWalkthrough | undefined> {
    const [row] = await db.select().from(quoteRequestWalkthroughs).where(eq(quoteRequestWalkthroughs.submissionId, submissionId));
    return row;
  }
  async getWalkthroughSubmissionIdsByCompany(companyId: string): Promise<string[]> {
    const rows = await db.select({ submissionId: quoteRequestWalkthroughs.submissionId }).from(quoteRequestWalkthroughs)
      .where(eq(quoteRequestWalkthroughs.companyId, companyId));
    return rows.map(r => r.submissionId).filter(Boolean) as string[];
  }
  async updateQuoteRequestWalkthrough(id: string, data: Partial<InsertQuoteRequestWalkthrough>): Promise<QuoteRequestWalkthrough | undefined> {
    const [row] = await db.update(quoteRequestWalkthroughs).set(data as any).where(eq(quoteRequestWalkthroughs.id, id)).returning();
    return row;
  }
  async addQuoteRequestWalkthroughPhoto(data: InsertQuoteRequestWalkthroughPhoto): Promise<QuoteRequestWalkthroughPhoto> {
    const [row] = await db.insert(quoteRequestWalkthroughPhotos).values(data as any).returning();
    return row;
  }
  async getQuoteRequestWalkthroughPhotos(walkthroughId: string): Promise<QuoteRequestWalkthroughPhoto[]> {
    return db.select().from(quoteRequestWalkthroughPhotos)
      .where(eq(quoteRequestWalkthroughPhotos.walkthroughId, walkthroughId))
      .orderBy(asc(quoteRequestWalkthroughPhotos.orderIndex));
  }
  async updateQuoteRequestWalkthroughPhoto(id: string, data: Partial<InsertQuoteRequestWalkthroughPhoto>): Promise<QuoteRequestWalkthroughPhoto | undefined> {
    const [row] = await db.update(quoteRequestWalkthroughPhotos).set(data as any).where(eq(quoteRequestWalkthroughPhotos.id, id)).returning();
    return row;
  }
  async deleteQuoteRequestWalkthroughPhoto(id: string): Promise<void> {
    await db.delete(quoteRequestWalkthroughPhotos).where(eq(quoteRequestWalkthroughPhotos.id, id));
  }
  async createQuoteRequestWalkthroughSection(data: InsertQuoteRequestWalkthroughSection): Promise<QuoteRequestWalkthroughSection> {
    const [row] = await db.insert(quoteRequestWalkthroughSections).values(data as any).returning();
    return row;
  }
  async getQuoteRequestWalkthroughSections(walkthroughId: string): Promise<QuoteRequestWalkthroughSection[]> {
    return db.select().from(quoteRequestWalkthroughSections)
      .where(eq(quoteRequestWalkthroughSections.walkthroughId, walkthroughId))
      .orderBy(asc(quoteRequestWalkthroughSections.orderIndex));
  }
  async updateQuoteRequestWalkthroughSection(id: string, data: Partial<InsertQuoteRequestWalkthroughSection>): Promise<QuoteRequestWalkthroughSection | undefined> {
    const [row] = await db.update(quoteRequestWalkthroughSections).set(data as any).where(eq(quoteRequestWalkthroughSections.id, id)).returning();
    return row;
  }

  // ── Scheduled Field Notes ────────────────────────────────────────────────
  async createScheduledFieldNoteTemplate(data: InsertScheduledFieldNoteTemplate): Promise<ScheduledFieldNoteTemplate> {
    const [row] = await db.insert(scheduledFieldNoteTemplates).values(data as any).returning();
    return row;
  }
  async getScheduledFieldNoteTemplates(companyId: string): Promise<ScheduledFieldNoteTemplate[]> {
    return db.select().from(scheduledFieldNoteTemplates).where(eq(scheduledFieldNoteTemplates.companyId, companyId)).orderBy(desc(scheduledFieldNoteTemplates.createdAt));
  }
  async getScheduledFieldNoteTemplate(id: string): Promise<ScheduledFieldNoteTemplate | undefined> {
    const [row] = await db.select().from(scheduledFieldNoteTemplates).where(eq(scheduledFieldNoteTemplates.id, id));
    return row;
  }
  async updateScheduledFieldNoteTemplate(id: string, data: Partial<InsertScheduledFieldNoteTemplate>): Promise<ScheduledFieldNoteTemplate | undefined> {
    const [row] = await db.update(scheduledFieldNoteTemplates).set(data as any).where(eq(scheduledFieldNoteTemplates.id, id)).returning();
    return row;
  }
  async deleteScheduledFieldNoteTemplate(id: string): Promise<void> {
    await db.delete(scheduledFieldNoteTemplates).where(eq(scheduledFieldNoteTemplates.id, id));
  }

  async createScheduledFieldNoteSection(data: InsertScheduledFieldNoteSection): Promise<ScheduledFieldNoteSection> {
    const [row] = await db.insert(scheduledFieldNoteSections).values(data as any).returning();
    return row;
  }
  async getScheduledFieldNoteSections(templateId: string): Promise<ScheduledFieldNoteSection[]> {
    return db.select().from(scheduledFieldNoteSections).where(eq(scheduledFieldNoteSections.templateId, templateId)).orderBy(asc(scheduledFieldNoteSections.sortOrder));
  }
  async updateScheduledFieldNoteSection(id: string, data: Partial<InsertScheduledFieldNoteSection>): Promise<ScheduledFieldNoteSection | undefined> {
    const [row] = await db.update(scheduledFieldNoteSections).set(data as any).where(eq(scheduledFieldNoteSections.id, id)).returning();
    return row;
  }
  async deleteScheduledFieldNoteSection(id: string): Promise<void> {
    await db.delete(scheduledFieldNoteSections).where(eq(scheduledFieldNoteSections.id, id));
  }

  async createScheduledFieldNoteStep(data: InsertScheduledFieldNoteStep): Promise<ScheduledFieldNoteStep> {
    const [row] = await db.insert(scheduledFieldNoteSteps).values(data as any).returning();
    return row;
  }
  async getScheduledFieldNoteSteps(templateId: string): Promise<ScheduledFieldNoteStep[]> {
    return db.select().from(scheduledFieldNoteSteps).where(eq(scheduledFieldNoteSteps.templateId, templateId)).orderBy(asc(scheduledFieldNoteSteps.sortOrder));
  }
  async getScheduledFieldNoteStepsBySection(sectionId: string): Promise<ScheduledFieldNoteStep[]> {
    return db.select().from(scheduledFieldNoteSteps).where(eq(scheduledFieldNoteSteps.sectionId, sectionId)).orderBy(asc(scheduledFieldNoteSteps.sortOrder));
  }
  async getScheduledFieldNoteStepById(id: string): Promise<ScheduledFieldNoteStep | undefined> {
    const [row] = await db.select().from(scheduledFieldNoteSteps).where(eq(scheduledFieldNoteSteps.id, id));
    return row;
  }
  async updateScheduledFieldNoteStep(id: string, data: Partial<InsertScheduledFieldNoteStep>): Promise<ScheduledFieldNoteStep | undefined> {
    const [row] = await db.update(scheduledFieldNoteSteps).set(data as any).where(eq(scheduledFieldNoteSteps.id, id)).returning();
    return row;
  }
  async deleteScheduledFieldNoteStep(id: string): Promise<void> {
    await db.delete(scheduledFieldNoteSteps).where(eq(scheduledFieldNoteSteps.id, id));
  }

  async createScheduledFieldNoteAssignment(data: InsertScheduledFieldNoteAssignment): Promise<ScheduledFieldNoteAssignment> {
    const [row] = await db.insert(scheduledFieldNoteAssignments).values(data as any).returning();
    return row;
  }
  async getScheduledFieldNoteAssignments(companyId: string): Promise<ScheduledFieldNoteAssignment[]> {
    return db.select().from(scheduledFieldNoteAssignments).where(eq(scheduledFieldNoteAssignments.companyId, companyId));
  }
  async getScheduledFieldNoteAssignmentsByTemplate(templateId: string): Promise<ScheduledFieldNoteAssignment[]> {
    return db.select().from(scheduledFieldNoteAssignments).where(eq(scheduledFieldNoteAssignments.templateId, templateId));
  }
  async getScheduledFieldNoteAssignmentsByCleaner(cleanerId: string): Promise<ScheduledFieldNoteAssignment[]> {
    return db.select().from(scheduledFieldNoteAssignments)
      .where(and(eq(scheduledFieldNoteAssignments.cleanerId, cleanerId), eq(scheduledFieldNoteAssignments.status, "active")));
  }
  async updateScheduledFieldNoteAssignment(id: string, data: Partial<InsertScheduledFieldNoteAssignment>): Promise<ScheduledFieldNoteAssignment | undefined> {
    const [row] = await db.update(scheduledFieldNoteAssignments).set(data as any).where(eq(scheduledFieldNoteAssignments.id, id)).returning();
    return row;
  }
  async deleteScheduledFieldNoteAssignment(id: string): Promise<void> {
    await db.delete(scheduledFieldNoteAssignments).where(eq(scheduledFieldNoteAssignments.id, id));
  }

  async createScheduledFieldNoteSubmission(data: InsertScheduledFieldNoteSubmission): Promise<ScheduledFieldNoteSubmission> {
    const [row] = await db.insert(scheduledFieldNoteSubmissions).values(data as any).returning();
    return row;
  }
  async getScheduledFieldNoteSubmissions(companyId: string): Promise<ScheduledFieldNoteSubmission[]> {
    return db.select().from(scheduledFieldNoteSubmissions).where(eq(scheduledFieldNoteSubmissions.companyId, companyId)).orderBy(desc(scheduledFieldNoteSubmissions.createdAt));
  }
  async getScheduledFieldNoteSubmission(id: string): Promise<ScheduledFieldNoteSubmission | undefined> {
    const [row] = await db.select().from(scheduledFieldNoteSubmissions).where(eq(scheduledFieldNoteSubmissions.id, id));
    return row;
  }
  async getScheduledFieldNoteSubmissionByPublicId(publicId: string): Promise<ScheduledFieldNoteSubmission | undefined> {
    const [row] = await db.select().from(scheduledFieldNoteSubmissions).where(eq(scheduledFieldNoteSubmissions.publicId, publicId));
    return row;
  }
  async getScheduledFieldNoteSubmissionByAssignmentAndDate(assignmentId: string, submissionDate: string): Promise<ScheduledFieldNoteSubmission | undefined> {
    const [row] = await db.select().from(scheduledFieldNoteSubmissions)
      .where(and(eq(scheduledFieldNoteSubmissions.assignmentId, assignmentId), eq(scheduledFieldNoteSubmissions.submissionDate, submissionDate)));
    return row;
  }
  async getScheduledFieldNoteSubmissionsByCleaner(cleanerId: string): Promise<ScheduledFieldNoteSubmission[]> {
    return db.select().from(scheduledFieldNoteSubmissions).where(eq(scheduledFieldNoteSubmissions.cleanerId, cleanerId)).orderBy(desc(scheduledFieldNoteSubmissions.createdAt));
  }
  async updateScheduledFieldNoteSubmission(id: string, data: Partial<InsertScheduledFieldNoteSubmission>): Promise<ScheduledFieldNoteSubmission | undefined> {
    const [row] = await db.update(scheduledFieldNoteSubmissions).set(data as any).where(eq(scheduledFieldNoteSubmissions.id, id)).returning();
    return row;
  }

  async createScheduledFieldNoteStepSubmission(data: InsertScheduledFieldNoteStepSubmission): Promise<ScheduledFieldNoteStepSubmission> {
    const [row] = await db.insert(scheduledFieldNoteStepSubmissions).values(data as any).returning();
    return row;
  }
  async getScheduledFieldNoteStepSubmissions(submissionId: string): Promise<ScheduledFieldNoteStepSubmission[]> {
    return db.select().from(scheduledFieldNoteStepSubmissions).where(eq(scheduledFieldNoteStepSubmissions.submissionId, submissionId)).orderBy(asc(scheduledFieldNoteStepSubmissions.createdAt));
  }
  async getScheduledFieldNoteStepSubmissionByStep(submissionId: string, stepId: string): Promise<ScheduledFieldNoteStepSubmission | undefined> {
    const [row] = await db.select().from(scheduledFieldNoteStepSubmissions)
      .where(and(eq(scheduledFieldNoteStepSubmissions.submissionId, submissionId), eq(scheduledFieldNoteStepSubmissions.stepId, stepId)));
    return row;
  }
  async updateScheduledFieldNoteStepSubmission(id: string, data: Partial<InsertScheduledFieldNoteStepSubmission>): Promise<ScheduledFieldNoteStepSubmission | undefined> {
    const [row] = await db.update(scheduledFieldNoteStepSubmissions).set(data as any).where(eq(scheduledFieldNoteStepSubmissions.id, id)).returning();
    return row;
  }
  async deleteScheduledFieldNoteStepSubmission(id: string): Promise<void> {
    await db.delete(scheduledFieldNoteStepSubmissions).where(eq(scheduledFieldNoteStepSubmissions.id, id));
  }

  // ── Hiring Packages ───────────────────────────────────────────────────────
  async getHiringPackagesByCompany(companyId: string): Promise<HiringPackage[]> {
    return db.select().from(hiringPackages).where(eq(hiringPackages.companyId, companyId)).orderBy(desc(hiringPackages.createdAt));
  }
  async getHiringPackage(id: string): Promise<HiringPackage | undefined> {
    const [row] = await db.select().from(hiringPackages).where(eq(hiringPackages.id, id));
    return row;
  }
  async getHiringPackageByToken(token: string): Promise<HiringPackage | undefined> {
    const [row] = await db.select().from(hiringPackages).where(eq(hiringPackages.publicToken, token));
    return row;
  }
  async createHiringPackage(data: InsertHiringPackage): Promise<HiringPackage> {
    const [row] = await db.insert(hiringPackages).values(data as any).returning();
    return row;
  }
  async updateHiringPackage(id: string, data: Partial<InsertHiringPackage>): Promise<HiringPackage | undefined> {
    const [row] = await db.update(hiringPackages).set(data as any).where(eq(hiringPackages.id, id)).returning();
    return row;
  }
  async deleteHiringPackage(id: string): Promise<void> {
    await db.delete(hiringPackages).where(eq(hiringPackages.id, id));
  }

  // ── Hiring Package Feature (Publications tab) ──────────────────────────────
  async getHPTemplatesByCompany(companyId: string): Promise<EmployeeHiringTemplate[]> {
    return db.select().from(employeeHiringTemplates).where(eq(employeeHiringTemplates.companyId, companyId)).orderBy(desc(employeeHiringTemplates.createdAt));
  }
  async getHPTemplate(id: string): Promise<EmployeeHiringTemplate | undefined> {
    const [row] = await db.select().from(employeeHiringTemplates).where(eq(employeeHiringTemplates.id, id));
    return row;
  }
  async getHPDefaultTemplate(companyId: string): Promise<EmployeeHiringTemplate | undefined> {
    const [row] = await db.select().from(employeeHiringTemplates).where(and(eq(employeeHiringTemplates.companyId, companyId), eq(employeeHiringTemplates.isDefault, true)));
    return row;
  }
  async createHPTemplate(data: InsertEmployeeHiringTemplate): Promise<EmployeeHiringTemplate> {
    const [row] = await db.insert(employeeHiringTemplates).values(data as any).returning();
    return row;
  }
  async updateHPTemplate(id: string, data: Partial<InsertEmployeeHiringTemplate>): Promise<EmployeeHiringTemplate | undefined> {
    const [row] = await db.update(employeeHiringTemplates).set(data as any).where(eq(employeeHiringTemplates.id, id)).returning();
    return row;
  }
  async deleteHPTemplate(id: string): Promise<void> {
    await db.delete(employeeHiringTemplates).where(eq(employeeHiringTemplates.id, id));
  }
  async getHPPackagesByCompany(companyId: string): Promise<EmployeeHiringPackage[]> {
    return db.select().from(employeeHiringPackages).where(eq(employeeHiringPackages.companyId, companyId)).orderBy(desc(employeeHiringPackages.createdAt));
  }
  async getHPPackage(id: string): Promise<EmployeeHiringPackage | undefined> {
    const [row] = await db.select().from(employeeHiringPackages).where(eq(employeeHiringPackages.id, id));
    return row;
  }
  async getHPPackageByToken(token: string): Promise<EmployeeHiringPackage | undefined> {
    const [row] = await db.select().from(employeeHiringPackages).where(eq(employeeHiringPackages.publicToken, token));
    return row;
  }
  async createHPPackage(data: InsertEmployeeHiringPackage): Promise<EmployeeHiringPackage> {
    const [row] = await db.insert(employeeHiringPackages).values(data as any).returning();
    return row;
  }
  async updateHPPackage(id: string, data: Partial<InsertEmployeeHiringPackage>): Promise<EmployeeHiringPackage | undefined> {
    const [row] = await db.update(employeeHiringPackages).set(data as any).where(eq(employeeHiringPackages.id, id)).returning();
    return row;
  }
  async deleteHPPackage(id: string): Promise<void> {
    await db.delete(employeeHiringPackages).where(eq(employeeHiringPackages.id, id));
  }
  async getHPSubmissionsByCompany(companyId: string): Promise<EmployeeHiringSubmission[]> {
    return db.select().from(employeeHiringSubmissions).where(eq(employeeHiringSubmissions.companyId, companyId)).orderBy(desc(employeeHiringSubmissions.createdAt));
  }
  async getHPSubmission(id: string): Promise<EmployeeHiringSubmission | undefined> {
    const [row] = await db.select().from(employeeHiringSubmissions).where(eq(employeeHiringSubmissions.id, id));
    return row;
  }
  async getHPSubmissionByToken(token: string): Promise<EmployeeHiringSubmission | undefined> {
    const [row] = await db.select().from(employeeHiringSubmissions).where(eq(employeeHiringSubmissions.publicToken, token));
    return row;
  }
  async getHPSubmissionByPackage(packageId: string): Promise<EmployeeHiringSubmission | undefined> {
    const [row] = await db.select().from(employeeHiringSubmissions).where(eq(employeeHiringSubmissions.packageId, packageId));
    return row;
  }
  async createHPSubmission(data: InsertEmployeeHiringSubmission): Promise<EmployeeHiringSubmission> {
    const [row] = await db.insert(employeeHiringSubmissions).values(data as any).returning();
    return row;
  }
  async updateHPSubmission(id: string, data: Partial<InsertEmployeeHiringSubmission>): Promise<EmployeeHiringSubmission | undefined> {
    const [row] = await db.update(employeeHiringSubmissions).set(data as any).where(eq(employeeHiringSubmissions.id, id)).returning();
    return row;
  }
  async getHPPolicyAcceptances(submissionId: string): Promise<EmployeeHiringPolicyAcceptance[]> {
    return db.select().from(employeeHiringPolicyAcceptances).where(eq(employeeHiringPolicyAcceptances.submissionId, submissionId)).orderBy(asc(employeeHiringPolicyAcceptances.acceptedAt));
  }
  async createHPPolicyAcceptance(data: InsertEmployeeHiringPolicyAcceptance): Promise<EmployeeHiringPolicyAcceptance> {
    const [row] = await db.insert(employeeHiringPolicyAcceptances).values(data as any).returning();
    return row;
  }
  async getHPDocuments(submissionId: string): Promise<EmployeeHiringDocument[]> {
    return db.select().from(employeeHiringDocuments).where(eq(employeeHiringDocuments.submissionId, submissionId)).orderBy(asc(employeeHiringDocuments.uploadedAt));
  }
  async getHPDocument(id: string): Promise<EmployeeHiringDocument | undefined> {
    const [row] = await db.select().from(employeeHiringDocuments).where(eq(employeeHiringDocuments.id, id));
    return row;
  }
  async upsertHPDocument(submissionId: string, documentType: string, data: InsertEmployeeHiringDocument): Promise<EmployeeHiringDocument> {
    const existing = await db.select().from(employeeHiringDocuments).where(and(eq(employeeHiringDocuments.submissionId, submissionId), eq(employeeHiringDocuments.documentType, documentType)));
    if (existing.length > 0) {
      const [row] = await db.update(employeeHiringDocuments).set(data as any).where(eq(employeeHiringDocuments.id, existing[0].id)).returning();
      return row;
    }
    const [row] = await db.insert(employeeHiringDocuments).values(data as any).returning();
    return row;
  }
  async deleteHPDocument(submissionId: string, documentType: string): Promise<void> {
    await db.delete(employeeHiringDocuments).where(and(eq(employeeHiringDocuments.submissionId, submissionId), eq(employeeHiringDocuments.documentType, documentType)));
  }

  // ── Training Hub ─────────────────────────────────────────────────────────────

  async createTrainingCourse(data: InsertTrainingCourse): Promise<TrainingCourse> {
    const [row] = await db.insert(trainingCourses).values(data as any).returning();
    return row;
  }

  async getTrainingCourses(companyId: string): Promise<(TrainingCourse & { moduleCount: number; assignedCount: number; completedCount: number })[]> {
    const courses = await db.select().from(trainingCourses).where(eq(trainingCourses.companyId, companyId)).orderBy(desc(trainingCourses.createdAt));
    const result = await Promise.all(courses.map(async c => {
      const [{ count: modCount }] = await db.select({ count: sql<number>`count(*)::int` }).from(trainingModules).where(eq(trainingModules.courseId, c.id));
      const [{ count: assignCount }] = await db.select({ count: sql<number>`count(*)::int` }).from(trainingAssignments).where(eq(trainingAssignments.courseId, c.id));
      const completedEmployees = await db.selectDistinct({ employeeId: trainingProgress.employeeId }).from(trainingProgress).where(and(eq(trainingProgress.courseId, c.id), sql`${trainingProgress.employeeId} is not null`));
      const reqModules = await db.select({ id: trainingModules.id }).from(trainingModules).where(and(eq(trainingModules.courseId, c.id), eq(trainingModules.isRequired, true)));
      let completedCount = 0;
      for (const emp of completedEmployees) {
        if (!emp.employeeId) continue;
        if (reqModules.length === 0) { completedCount++; continue; }
        const done = await db.select({ count: sql<number>`count(*)::int` }).from(trainingProgress).where(and(eq(trainingProgress.courseId, c.id), eq(trainingProgress.employeeId, emp.employeeId)));
        if ((done[0]?.count ?? 0) >= reqModules.length) completedCount++;
      }
      return { ...c, moduleCount: modCount ?? 0, assignedCount: assignCount ?? 0, completedCount };
    }));
    return result;
  }

  async getTrainingCourse(id: string): Promise<TrainingCourse | undefined> {
    const [row] = await db.select().from(trainingCourses).where(eq(trainingCourses.id, id));
    return row;
  }

  async getTrainingCourseByPublicId(publicId: string): Promise<TrainingCourse | undefined> {
    const [row] = await db.select().from(trainingCourses).where(eq(trainingCourses.publicId, publicId));
    return row;
  }

  async updateTrainingCourse(id: string, data: Partial<InsertTrainingCourse>): Promise<TrainingCourse | undefined> {
    const [row] = await db.update(trainingCourses).set(data as any).where(eq(trainingCourses.id, id)).returning();
    return row;
  }

  async deleteTrainingCourse(id: string): Promise<void> {
    const modules = await db.select({ id: trainingModules.id }).from(trainingModules).where(eq(trainingModules.courseId, id));
    for (const m of modules) {
      await db.delete(trainingModuleAssets).where(eq(trainingModuleAssets.moduleId, m.id));
    }
    await db.delete(trainingModules).where(eq(trainingModules.courseId, id));
    await db.delete(trainingAssignments).where(eq(trainingAssignments.courseId, id));
    await db.delete(trainingProgress).where(eq(trainingProgress.courseId, id));
    await db.delete(trainingPublicLearners).where(eq(trainingPublicLearners.courseId, id));
    await db.delete(trainingCertificates).where(eq(trainingCertificates.courseId, id));
    await db.delete(trainingCourses).where(eq(trainingCourses.id, id));
  }

  async getTrainingStats(companyId: string): Promise<{ totalCourses: number; totalAssigned: number; totalCompleted: number; totalPending: number }> {
    const [{ count: totalCourses }] = await db.select({ count: sql<number>`count(*)::int` }).from(trainingCourses).where(eq(trainingCourses.companyId, companyId));
    const [{ count: totalAssigned }] = await db.select({ count: sql<number>`count(*)::int` }).from(trainingAssignments).where(eq(trainingAssignments.companyId, companyId));
    const completedAssignments = await db.select({ employeeId: trainingAssignments.employeeId, courseId: trainingAssignments.courseId }).from(trainingAssignments).where(and(eq(trainingAssignments.companyId, companyId), eq(trainingAssignments.status, "completed")));
    const totalCompleted = completedAssignments.length;
    const totalPending = Math.max(0, (totalAssigned ?? 0) - totalCompleted);
    return { totalCourses: totalCourses ?? 0, totalAssigned: totalAssigned ?? 0, totalCompleted, totalPending };
  }

  async createTrainingModule(data: InsertTrainingModule): Promise<TrainingModule> {
    const [row] = await db.insert(trainingModules).values(data as any).returning();
    return row;
  }

  async getTrainingModules(courseId: string): Promise<(TrainingModule & { assets: TrainingModuleAsset[] })[]> {
    const mods = await db.select().from(trainingModules).where(eq(trainingModules.courseId, courseId)).orderBy(asc(trainingModules.sortOrder));
    return Promise.all(mods.map(async m => {
      const assets = await db.select().from(trainingModuleAssets).where(eq(trainingModuleAssets.moduleId, m.id)).orderBy(asc(trainingModuleAssets.sortOrder));
      return { ...m, assets };
    }));
  }

  async getTrainingModule(id: string): Promise<TrainingModule | undefined> {
    const [row] = await db.select().from(trainingModules).where(eq(trainingModules.id, id));
    return row;
  }

  async updateTrainingModule(id: string, data: Partial<InsertTrainingModule>): Promise<TrainingModule | undefined> {
    const [row] = await db.update(trainingModules).set(data as any).where(eq(trainingModules.id, id)).returning();
    return row;
  }

  async deleteTrainingModule(id: string): Promise<void> {
    await db.delete(trainingModuleAssets).where(eq(trainingModuleAssets.moduleId, id));
    await db.delete(trainingProgress).where(eq(trainingProgress.moduleId, id));
    await db.delete(trainingModules).where(eq(trainingModules.id, id));
  }

  async createTrainingModuleAsset(data: InsertTrainingModuleAsset): Promise<TrainingModuleAsset> {
    const [row] = await db.insert(trainingModuleAssets).values(data as any).returning();
    return row;
  }

  async deleteTrainingModuleAssets(moduleId: string): Promise<void> {
    await db.delete(trainingModuleAssets).where(eq(trainingModuleAssets.moduleId, moduleId));
  }

  async assignTrainingCourse(courseId: string, companyId: string, employeeIds: string[], assignedBy: string): Promise<void> {
    const now = new Date().toISOString();
    for (const employeeId of employeeIds) {
      const existing = await db.select().from(trainingAssignments).where(and(eq(trainingAssignments.courseId, courseId), eq(trainingAssignments.employeeId, employeeId)));
      if (existing.length === 0) {
        await db.insert(trainingAssignments).values({ courseId, companyId, employeeId, assignedBy, status: "assigned", createdAt: now });
      }
    }
  }

  async getTrainingAssignments(courseId: string): Promise<(TrainingAssignment & { employeeName: string })[]> {
    const assignments = await db.select().from(trainingAssignments).where(eq(trainingAssignments.courseId, courseId)).orderBy(asc(trainingAssignments.createdAt));
    return Promise.all(assignments.map(async a => {
      const emp = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, a.employeeId));
      const name = emp[0] ? `${emp[0].firstName} ${emp[0].lastName}` : "Unknown";
      return { ...a, employeeName: name };
    }));
  }

  async getMyTrainingCourses(employeeId: string, companyId: string): Promise<any[]> {
    const assignments = await db.select({ courseId: trainingAssignments.courseId }).from(trainingAssignments).where(and(eq(trainingAssignments.employeeId, employeeId), eq(trainingAssignments.companyId, companyId)));
    const publicCourses = await db.select().from(trainingCourses).where(and(eq(trainingCourses.companyId, companyId), eq(trainingCourses.isPublished, true)));
    const assignedIds = new Set(assignments.map(a => a.courseId));
    const courseIds = [...new Set([...assignments.map(a => a.courseId), ...publicCourses.map(c => c.id)])];
    if (courseIds.length === 0) return [];
    const courses = await db.select().from(trainingCourses).where(inArray(trainingCourses.id, courseIds));
    return Promise.all(courses.map(async c => {
      const modules = await db.select().from(trainingModules).where(eq(trainingModules.courseId, c.id));
      const progress = await db.select().from(trainingProgress).where(and(eq(trainingProgress.courseId, c.id), eq(trainingProgress.employeeId, employeeId)));
      const completedIds = new Set(progress.map(p => p.moduleId));
      const totalModules = modules.length;
      const completedModules = modules.filter(m => completedIds.has(m.id)).length;
      const progressPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
      const isCompleted = totalModules > 0 && completedModules >= modules.filter(m => m.isRequired).length && modules.filter(m => m.isRequired).every(m => completedIds.has(m.id));
      const status = completedModules === 0 ? "not_started" : isCompleted ? "completed" : "in_progress";
      const cert = await this.getTrainingCertificate(c.id, employeeId, undefined);
      return { ...c, totalModules, completedModules, progressPct, isCompleted, status, certificate: cert ? { certificateCode: cert.certificateCode, issuedAt: cert.issuedAt } : null };
    }));
  }

  async getMyTrainingCourse(courseId: string, employeeId: string): Promise<any> {
    const course = await this.getTrainingCourse(courseId);
    if (!course) return null;
    const modules = await this.getTrainingModules(courseId);
    const progress = await db.select().from(trainingProgress).where(and(eq(trainingProgress.courseId, courseId), eq(trainingProgress.employeeId, employeeId)));
    const completedIds = new Set(progress.map(p => p.moduleId));
    const modulesWithCompletion = modules.map(m => ({ ...m, completed: completedIds.has(m.id) }));
    const totalModules = modules.length;
    const completedModules = modules.filter(m => completedIds.has(m.id)).length;
    const progressPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
    const reqModules = modules.filter(m => m.isRequired);
    const isCompleted = reqModules.length > 0 ? reqModules.every(m => completedIds.has(m.id)) : completedModules === totalModules && totalModules > 0;
    const status = completedModules === 0 ? "not_started" : isCompleted ? "completed" : "in_progress";
    const cert = await this.getTrainingCertificate(courseId, employeeId, undefined);
    const courseWithMeta = { ...course, totalModules, completedModules, progressPct, isCompleted, status, certificate: cert ? { certificateCode: cert.certificateCode, issuedAt: cert.issuedAt } : null };
    return { course: courseWithMeta, modules: modulesWithCompletion };
  }

  async markModuleComplete(courseId: string, moduleId: string, companyId: string, employeeId?: string, publicLearnerId?: string): Promise<void> {
    const existing = await db.select().from(trainingProgress).where(and(
      eq(trainingProgress.courseId, courseId),
      eq(trainingProgress.moduleId, moduleId),
      employeeId ? eq(trainingProgress.employeeId, employeeId) : isNull(trainingProgress.employeeId),
      publicLearnerId ? eq(trainingProgress.publicLearnerId, publicLearnerId) : isNull(trainingProgress.publicLearnerId),
    ));
    if (existing.length > 0) return;
    const now = new Date().toISOString();
    await db.insert(trainingProgress).values({ courseId, moduleId, companyId, employeeId: employeeId ?? null, publicLearnerId: publicLearnerId ?? null, completedAt: now, createdAt: now } as any);
    if (employeeId) {
      await db.update(trainingAssignments).set({ status: "started" }).where(and(eq(trainingAssignments.courseId, courseId), eq(trainingAssignments.employeeId, employeeId), eq(trainingAssignments.status, "assigned")));
    }
  }

  async getTrainingProgress(courseId: string, employeeId?: string, publicLearnerId?: string): Promise<TrainingProgress[]> {
    const conditions = [eq(trainingProgress.courseId, courseId)];
    if (employeeId) conditions.push(eq(trainingProgress.employeeId, employeeId));
    if (publicLearnerId) conditions.push(eq(trainingProgress.publicLearnerId, publicLearnerId));
    return db.select().from(trainingProgress).where(and(...conditions));
  }

  async getTrainingCompletions(courseId: string): Promise<TrainingProgress[]> {
    return db.select().from(trainingProgress).where(eq(trainingProgress.courseId, courseId));
  }

  async createPublicLearner(data: InsertTrainingPublicLearner): Promise<TrainingPublicLearner> {
    const [row] = await db.insert(trainingPublicLearners).values(data as any).returning();
    return row;
  }

  async getPublicLearner(id: string): Promise<TrainingPublicLearner | undefined> {
    const [row] = await db.select().from(trainingPublicLearners).where(eq(trainingPublicLearners.id, id));
    return row;
  }

  async updatePublicLearner(id: string, data: Partial<InsertTrainingPublicLearner>): Promise<TrainingPublicLearner | undefined> {
    const [row] = await db.update(trainingPublicLearners).set(data as any).where(eq(trainingPublicLearners.id, id)).returning();
    return row;
  }

  async createTrainingCertificate(data: InsertTrainingCertificate): Promise<TrainingCertificate> {
    const [row] = await db.insert(trainingCertificates).values(data as any).returning();
    return row;
  }

  async getTrainingCertificate(courseId: string, employeeId?: string, publicLearnerId?: string): Promise<TrainingCertificate | undefined> {
    const conditions: any[] = [eq(trainingCertificates.courseId, courseId)];
    if (employeeId) conditions.push(eq(trainingCertificates.employeeId, employeeId));
    if (publicLearnerId) conditions.push(eq(trainingCertificates.publicLearnerId, publicLearnerId));
    const [row] = await db.select().from(trainingCertificates).where(and(...conditions));
    return row;
  }
}

export const storage = new DatabaseStorage();
