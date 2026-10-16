// Contractor tables match migrations/20261016-contractors.sql; root entities are reused.
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, unique, primaryKey, foreignKey, check, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export function createContractorTables(root: {
    companies: any;
    users: any;
    locations: any;
}) {
    const contractorBusinesses = pgTable('contractor_businesses', {
        id: text('id').primaryKey(),
        companyId: varchar('company_id').notNull().references(() => root.companies.id),
        name: text('name').notNull(),
        contactName: text('contact_name').notNull().default(sql `''`),
        email: text('email').notNull().default(sql `''`),
        phone: text('phone').notNull().default(sql `''`),
        agreementStart: text('agreement_start'),
        agreementEnd: text('agreement_end'),
        requiredDocuments: jsonb('required_documents').notNull().default(sql `'[]'`),
        approvalStatus: text('approval_status').notNull().default(sql `'pending'`),
        status: text('status').notNull().default(sql `'active'`),
        version: integer('version').notNull().default(sql `1`),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().default(sql `now()`)
    }, t => [check('contractor_businesses_approval_status_check', sql `approval_status IN ('pending','approved','rejected')`), check('contractor_businesses_status_check', sql `status IN ('active','suspended','archived')`), unique().on(t.companyId, t.id)]).enableRLS();
    const contractorMemberships = pgTable('contractor_memberships', {
        id: text('id').primaryKey(),
        companyId: varchar('company_id').notNull(),
        businessId: text('business_id').notNull(),
        userId: varchar('user_id').notNull().references(() => root.users.id),
        role: text('role').notNull(),
        status: text('status').notNull().default(sql `'active'`),
        startsAt: timestamp('starts_at', { withTimezone: true, mode: 'string' }).notNull().default(sql `now()`),
        endsAt: timestamp('ends_at', { withTimezone: true, mode: 'string' })
    }, t => [check('contractor_memberships_role_check', sql `role IN ('manager','lead')`), check('contractor_memberships_status_check', sql `status IN ('active','revoked')`), foreignKey({ columns: [t.companyId, t.businessId], foreignColumns: [contractorBusinesses.companyId, contractorBusinesses.id] }), unique().on(t.userId), unique().on(t.businessId, t.id)]).enableRLS();
    const contractorInvitations = pgTable('contractor_invitations', {
        id: text('id').primaryKey(),
        companyId: varchar('company_id').notNull(),
        businessId: text('business_id').notNull(),
        email: text('email').notNull(),
        role: text('role').notNull(),
        tokenHash: text('token_hash').notNull().unique(),
        expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
        revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
        acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'string' }),
        createdBy: varchar('created_by').notNull().references(() => root.users.id)
    }, t => [check('contractor_invitations_role_check', sql `role IN ('manager','lead')`), foreignKey({ columns: [t.companyId, t.businessId], foreignColumns: [contractorBusinesses.companyId, contractorBusinesses.id] })]).enableRLS();
    const contractorAssignments = pgTable('contractor_assignments', {
        id: text('id').primaryKey(),
        companyId: varchar('company_id').notNull(),
        businessId: text('business_id').notNull(),
        locationId: varchar('location_id').notNull().references(() => root.locations.id),
        startsOn: text('starts_on').notNull(),
        endsOn: text('ends_on').notNull(),
        timezone: text('timezone').notNull(),
        weekdays: integer('weekdays').array().notNull(),
        startTime: text('start_time').notNull(),
        endTime: text('end_time').notNull(),
        scope: text('scope').notNull(),
        frequency: text('frequency').notNull().default(sql `'weekly'`),
        checklist: jsonb('checklist').notNull().default(sql `'[]'`),
        supplies: text('supplies').notNull().default(sql `''`),
        equipment: text('equipment').notNull().default(sql `''`),
        adminContact: text('admin_contact').notNull().default(sql `''`),
        state: text('state').notNull().default(sql `'proposed'`),
        decisionReason: text('decision_reason'),
        leadMemberId: text('lead_member_id').references(() => contractorMemberships.id),
        version: integer('version').notNull().default(sql `1`)
    }, t => [check('contractor_assignments_weekdays_check', sql `cardinality(weekdays)>0`), check('contractor_assignments_state_check', sql `state IN ('proposed','accepted','declined','ended')`), foreignKey({ columns: [t.companyId, t.businessId], foreignColumns: [contractorBusinesses.companyId, contractorBusinesses.id] }), unique().on(t.companyId, t.businessId, t.id)]).enableRLS();
    const contractorInstructions = pgTable('contractor_instructions', {
        id: text('id').primaryKey(),
        assignmentId: text('assignment_id').notNull().references(() => contractorAssignments.id),
        version: integer('version').notNull(),
        content: text('content').notNull(),
        accessDetails: text('access_details').notNull().default(sql `''`),
        accessMemberIds: text('access_member_ids').array().notNull().default(sql `'{}'`),
        important: boolean('important').notNull().default(sql `true`),
        createdBy: varchar('created_by').notNull().references(() => root.users.id),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().default(sql `now()`)
    }, t => [unique().on(t.assignmentId, t.version)]).enableRLS();
    const contractorAcknowledgements = pgTable('contractor_acknowledgements', {
        instructionId: text('instruction_id').notNull().references(() => contractorInstructions.id),
        memberId: text('member_id').notNull().references(() => contractorMemberships.id),
        acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true, mode: 'string' }).notNull().default(sql `now()`)
    }, t => [primaryKey({ columns: [t.instructionId, t.memberId] })]).enableRLS();
    const contractorVisits = pgTable('contractor_visits', {
        id: text('id').primaryKey(),
        companyId: varchar('company_id').notNull(),
        businessId: text('business_id').notNull(),
        assignmentId: text('assignment_id').notNull(),
        serviceDate: text('service_date').notNull(),
        status: text('status').notNull().default(sql `'scheduled'`),
        version: integer('version').notNull().default(sql `1`),
        deadline: timestamp('deadline', { withTimezone: true, mode: 'string' }),
        reviewFindings: text('review_findings'),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().default(sql `now()`)
    }, t => [check('contractor_visits_status_check', sql `status IN ('scheduled','submitted','approved','blocked','missed','cancelled','correction_required')`), foreignKey({ columns: [t.companyId, t.businessId, t.assignmentId], foreignColumns: [contractorAssignments.companyId, contractorAssignments.businessId, contractorAssignments.id] }), unique().on(t.assignmentId, t.serviceDate), index('contractor_visit_company_date').on(t.companyId, t.serviceDate)]).enableRLS();
    const contractorSubmissions = pgTable('contractor_submissions', {
        id: text('id').primaryKey(),
        visitId: text('visit_id').notNull().references(() => contractorVisits.id),
        revision: integer('revision').notNull(),
        submittedBy: varchar('submitted_by').notNull().references(() => root.users.id),
        checklist: jsonb('checklist').notNull(),
        notes: text('notes').notNull().default(sql `''`),
        fileIds: text('file_ids').array().notNull().default(sql `'{}'`),
        submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'string' }).notNull().default(sql `now()`),
        requestKey: text('request_key').notNull()
    }, t => [unique().on(t.visitId, t.revision), unique().on(t.visitId, t.requestKey)]).enableRLS();
    const contractorInspections = pgTable('contractor_inspections', {
        id: text('id').primaryKey(),
        visitId: text('visit_id').notNull().references(() => contractorVisits.id),
        revision: integer('revision').notNull(),
        reviewerId: varchar('reviewer_id').notNull().references(() => root.users.id),
        decision: text('decision').notNull(),
        findings: text('findings').notNull().default(sql `''`),
        deadline: timestamp('deadline', { withTimezone: true, mode: 'string' }),
        score: integer('score'),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().default(sql `now()`)
    }, t => [check('contractor_inspections_decision_check', sql `decision IN ('approved','correction_required')`), check('contractor_inspections_score_check', sql `score BETWEEN 0 AND 100`), unique().on(t.visitId, t.revision)]).enableRLS();
    const contractorIssues = pgTable('contractor_issues', {
        id: text('id').primaryKey(),
        companyId: varchar('company_id').notNull(),
        businessId: text('business_id').notNull(),
        assignmentId: text('assignment_id').notNull(),
        visitId: text('visit_id').references(() => contractorVisits.id),
        category: text('category').notNull(),
        severity: text('severity').notNull(),
        description: text('description').notNull(),
        ownerId: varchar('owner_id').references(() => root.users.id),
        responseTarget: timestamp('response_target', { withTimezone: true, mode: 'string' }).notNull(),
        resolutionTarget: timestamp('resolution_target', { withTimezone: true, mode: 'string' }).notNull(),
        respondedAt: timestamp('responded_at', { withTimezone: true, mode: 'string' }),
        resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
        status: text('status').notNull().default(sql `'open'`),
        raisedBy: varchar('raised_by').notNull().references(() => root.users.id),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().default(sql `now()`),
        version: integer('version').notNull().default(sql `1`)
    }, t => [check('contractor_issues_severity_check', sql `severity IN ('low','medium','high','urgent')`), check('contractor_issues_status_check', sql `status IN ('open','in_progress','resolved','closed')`), foreignKey({ columns: [t.companyId, t.businessId, t.assignmentId], foreignColumns: [contractorAssignments.companyId, contractorAssignments.businessId, contractorAssignments.id] }), index('contractor_issues_targets').on(t.status, t.resolutionTarget)]).enableRLS();
    const contractorComments = pgTable('contractor_comments', {
        id: text('id').primaryKey(),
        issueId: text('issue_id').notNull().references(() => contractorIssues.id),
        authorId: varchar('author_id').notNull().references(() => root.users.id),
        body: text('body').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().default(sql `now()`),
        requestKey: text('request_key').notNull()
    }, t => [unique().on(t.issueId, t.authorId, t.requestKey)]).enableRLS();
    const contractorFiles = pgTable('contractor_files', {
        id: text('id').primaryKey(),
        companyId: varchar('company_id').notNull(),
        businessId: text('business_id').notNull(),
        kind: text('kind').notNull(),
        entityId: text('entity_id').notNull(),
        name: text('name').notNull(),
        storageName: text('storage_name').notNull().unique(),
        mime: text('mime').notNull(),
        size: integer('size').notNull(),
        documentType: text('document_type').notNull().default(sql `''`),
        expiresOn: text('expires_on'),
        approvalStatus: text('approval_status').notNull().default(sql `'pending'`),
        uploadedBy: varchar('uploaded_by').notNull().references(() => root.users.id),
        version: integer('version').notNull().default(sql `1`),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().default(sql `now()`)
    }, t => [check('contractor_files_kind_check', sql `kind IN ('business','visit','issue')`), check('contractor_files_approval_status_check', sql `approval_status IN ('pending','approved','rejected')`), foreignKey({ columns: [t.companyId, t.businessId], foreignColumns: [contractorBusinesses.companyId, contractorBusinesses.id] }), index('contractor_file_entity').on(t.companyId, t.businessId, t.kind, t.entityId)]).enableRLS();
    const contractorAudit = pgTable('contractor_audit', {
        id: text('id').primaryKey(),
        companyId: varchar('company_id').notNull(),
        businessId: text('business_id').notNull(),
        entityType: text('entity_type').notNull(),
        entityId: text('entity_id').notNull(),
        actorId: varchar('actor_id').references(() => root.users.id),
        action: text('action').notNull(),
        details: jsonb('details').notNull().default(sql `'{}'`),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().default(sql `now()`)
    }, t => [foreignKey({ columns: [t.companyId, t.businessId], foreignColumns: [contractorBusinesses.companyId, contractorBusinesses.id] })]).enableRLS();
    const contractorNotifications = pgTable('contractor_notifications', {
        id: text('id').primaryKey(),
        companyId: varchar('company_id').notNull(),
        businessId: text('business_id').notNull(),
        recipientId: varchar('recipient_id').notNull().references(() => root.users.id),
        eventKey: text('event_key').notNull(),
        body: text('body').notNull(),
        href: text('href').notNull(),
        readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }),
        emailState: text('email_state').notNull().default(sql `'pending'`),
        attempts: integer('attempts').notNull().default(sql `0`),
        nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, mode: 'string' }).notNull().default(sql `now()`),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().default(sql `now()`)
    }, t => [unique().on(t.eventKey, t.recipientId), foreignKey({ columns: [t.companyId, t.businessId], foreignColumns: [contractorBusinesses.companyId, contractorBusinesses.id] })]).enableRLS();
    return { contractorBusinesses, contractorMemberships, contractorInvitations, contractorAssignments, contractorInstructions, contractorAcknowledgements, contractorVisits, contractorSubmissions, contractorInspections, contractorIssues, contractorComments, contractorFiles, contractorAudit, contractorNotifications };
}
