import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { hasAccess } from '../shared/people';
import { businessInput, assignmentInput, issueInput, submissionInput, serviceDates, localDate, canTransition, isActiveMembership, assignmentActive } from '../shared/contractor';
export const fail = (status: number, message: string) => { throw Object.assign(new Error(message), { status }); };
export const tokenHash = (s: string) => createHash('sha256').update(s).digest('hex');
export type Actor = {
    id: string;
    companyId: string;
    role: string;
    isActive: boolean;
    adminPermissions?: string[] | null;
};
type DB = {
    query: (sql: string, values?: any[]) => Promise<any>;
};
export class ContractorService {
    constructor(public pool: any) { }
    async run(user: Actor, fn: (db: DB, ctx: any) => Promise<any>) {
        const db = await this.pool.connect();
        try {
            await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
            if (!user?.isActive || !user.companyId)
                fail(401, 'Sign in with an active account');
            let ctx: any = { ...user, admin: user.role === 'admin' };
            if (ctx.admin) {
                if (!hasAccess(user, 'contractors'))
                    fail(403, 'Contractor access is restricted');
            }
            else {
                if (user.role !== 'contractor')
                    fail(403, 'Contractor access is restricted');
                const { rows: [m] } = await db.query(`SELECT m.*,b.status business_status FROM contractor_memberships m JOIN contractor_businesses b ON b.id=m.business_id AND b.company_id=m.company_id WHERE m.user_id=$1 AND m.company_id=$2 FOR SHARE OF m,b`, [user.id, user.companyId]);
                if (!isActiveMembership(m))
                    fail(403, 'Contractor access has ended or is suspended');
                ctx = { ...ctx, member: m, businessId: m.business_id };
            }
            const result = await fn(db, ctx);
            await db.query('COMMIT');
            return result;
        }
        catch (e) {
            await db.query('ROLLBACK');
            throw e;
        }
        finally {
            db.release();
        }
    }
    admin(c: any) {
        if (!c.admin)
            fail(403, 'Only an authorized company admin can do this');
    }
    manager(c: any) {
        if (!c.admin && c.member.role !== 'manager')
            fail(403, 'Only a contractor manager can do this');
    }
    async business(db: DB, c: any, id: string) {
        const { rows: [b] } = await db.query(`SELECT * FROM contractor_businesses WHERE id=$1 AND company_id=$2 ${c.admin ? 'FOR UPDATE' : 'FOR SHARE'}`, [id, c.companyId]);
        if (!b || !c.admin && b.id !== c.businessId)
            fail(404, 'Contractor not found');
        return b;
    }
    async assignment(db: DB, c: any, id: string, live = false) {
        const { rows: [a] } = await db.query(`SELECT a.*,l.name location_name FROM contractor_assignments a JOIN locations l ON l.id=a.location_id AND l.company_id=a.company_id WHERE a.id=$1 AND a.company_id=$2 FOR UPDATE OF a`, [id, c.companyId]);
        if (!a || !c.admin && (a.business_id !== c.businessId || c.member.role === 'lead' && a.lead_member_id !== c.member.id))
            fail(404, 'Assignment not found');
        if (live) {
            if (!assignmentActive(a))
                fail(403, 'Assignment is not currently active');
        }
        return a;
    }
    async visit(db: DB, c: any, id: string, live = false) {
        const { rows: [v] } = await db.query('SELECT * FROM contractor_visits WHERE id=$1 AND company_id=$2', [id, c.companyId]);
        if (!v)
            fail(404, 'Visit not found');
        const a = await this.assignment(db, c, v.assignment_id, live);
        const { rows: [locked] } = await db.query('SELECT * FROM contractor_visits WHERE id=$1 AND company_id=$2 FOR UPDATE', [id, c.companyId]);
        return { v: locked, a };
    }
    async audit(db: DB, c: any, business: string, type: string, id: string, action: string, details: any = {}) { await db.query('INSERT INTO contractor_audit(id,company_id,business_id,entity_type,entity_id,actor_id,action,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), c.companyId, business, type, id, c.id, action, JSON.stringify(details)]); }
    async notify(db: DB, c: any, business: string, event: string, body: string, to: 'admin' | 'contractor' | 'both' = 'both') {
        const { rows: admins } = to === 'contractor' ? { rows: [] } : await db.query(`SELECT id,role,admin_permissions "adminPermissions" FROM users WHERE company_id=$1 AND role='admin' AND is_active=true`, [c.companyId]);
        const { rows: members } = to === 'admin' ? { rows: [] } : await db.query(`SELECT u.id FROM users u JOIN contractor_memberships m ON m.user_id=u.id JOIN contractor_businesses b ON b.id=m.business_id WHERE m.business_id=$1 AND m.status='active' AND b.status='active' AND u.is_active=true AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now()) AND m.role='manager'`, [business]);
        for (const u of [...admins.filter((u: any) => hasAccess(u, 'contractors')), ...members]) {
            await db.query(`INSERT INTO contractor_notifications(id,company_id,business_id,recipient_id,event_key,body,href) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(event_key,recipient_id) DO NOTHING`, [randomUUID(), c.companyId, business, u.id, event, body, u.role === 'admin' ? '/admin/contractors' : '/contractor']);
        }
    }
    checkVersion(row: any, value: any) {
        if (!Number.isInteger(value) || value !== row.version)
            fail(409, 'This record changed. Refresh and try again.');
    }
    async action(user: Actor, action: string, id: string, body: any) {
        return this.run(user, async (db, c) => {
            if (action === 'create-business') {
                this.admin(c);
                const d = businessInput.parse(body);
                const bid = randomUUID();
                await db.query(`INSERT INTO contractor_businesses(id,company_id,name,contact_name,email,phone,agreement_start,agreement_end,required_documents,approval_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [bid, c.companyId, d.name, d.contact_name, d.email, d.phone, d.agreement_start || null, d.agreement_end || null, JSON.stringify(d.required_documents), d.approval_status]);
                await this.audit(db, c, bid, 'business', bid, 'created');
                return { id: bid };
            }
            if (action === 'edit-business' || action === 'business-status') {
                this.admin(c);
                const b = await this.business(db, c, id);
                this.checkVersion(b, body.version);
                if (action === 'edit-business') {
                    const d = businessInput.parse(body);
                    await db.query(`UPDATE contractor_businesses SET name=$1,contact_name=$2,email=$3,phone=$4,agreement_start=$5,agreement_end=$6,required_documents=$7,approval_status=$8,version=version+1 WHERE id=$9`, [d.name, d.contact_name, d.email, d.phone, d.agreement_start || null, d.agreement_end || null, JSON.stringify(d.required_documents), d.approval_status, id]);
                }
                else {
                    const status = z.enum(['active', 'suspended', 'archived']).parse(body.status);
                    await db.query('UPDATE contractor_businesses SET status=$1,version=version+1 WHERE id=$2', [status, id]);
                    if (status !== 'active')
                        await db.query('UPDATE contractor_invitations SET revoked_at=now() WHERE business_id=$1 AND accepted_at IS NULL', [id]);
                }
                await this.audit(db, c, id, 'business', id, action);
                return { ok: true };
            }
            if (action === 'invite') {
                this.admin(c);
                const b = await this.business(db, c, id);
                if (b.status !== 'active')
                    fail(409, 'Activate the contractor before inviting');
                const d = z.object({ email: z.string().email().transform(v => v.toLowerCase()), role: z.enum(['manager', 'lead']) }).parse(body);
                const raw = randomBytes(32).toString('base64url'), iid = randomUUID();
                await db.query(`INSERT INTO contractor_invitations(id,company_id,business_id,email,role,token_hash,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6,now()+interval '7 days',$7)`, [iid, c.companyId, id, d.email, d.role, tokenHash(raw), c.id]);
                await this.audit(db, c, id, 'invitation', iid, 'created');
                return { id: iid, url: `${process.env.APP_URL || 'http://localhost:5000'}/contractor-invite/${raw}`, expires_in_days: 7 };
            }
            if (action === 'revoke-invite') {
                this.admin(c);
                const { rows: [i] } = await db.query('SELECT * FROM contractor_invitations WHERE id=$1 AND company_id=$2', [id, c.companyId]);
                if (!i)
                    fail(404, 'Invitation not found');
                await db.query('UPDATE contractor_invitations SET revoked_at=now() WHERE id=$1', [id]);
                await this.audit(db, c, i.business_id, 'invitation', id, 'revoked');
                return { ok: true };
            }
            if (action === 'revoke-member') {
                this.admin(c);
                const { rows: [m] } = await db.query('SELECT * FROM contractor_memberships WHERE id=$1 AND company_id=$2', [id, c.companyId]);
                if (!m)
                    fail(404, 'Member not found');
                await db.query("UPDATE contractor_memberships SET status='revoked',ends_at=now() WHERE id=$1", [id]);
                await this.audit(db, c, m.business_id, 'membership', id, 'revoked');
                return { ok: true };
            }
            if (action === 'create-assignment') {
                this.admin(c);
                const d = assignmentInput.parse(body), b = await this.business(db, c, d.business_id);
                if (b.status !== 'active' || b.approval_status !== 'approved')
                    fail(409, 'Approve and activate the contractor first');
                const { rows: documents } = await db.query("SELECT document_type,expires_on FROM contractor_files WHERE business_id=$1 AND kind='business' AND approval_status='approved'", [b.id]);
                if (b.required_documents.some((type: string) => !documents.some((f: any) => f.document_type === type && (!f.expires_on || f.expires_on >= localDate(new Date(), d.timezone)))))
                    fail(409, 'Required contractor documents need current approved uploads');
                if (b.agreement_start && d.starts_on < String(b.agreement_start).slice(0, 10) || b.agreement_end && d.ends_on > String(b.agreement_end).slice(0, 10))
                    fail(400, 'Assignment dates must fall within the agreement');
                const { rows: [l] } = await db.query('SELECT * FROM locations WHERE id=$1 AND company_id=$2', [d.location_id, c.companyId]);
                if (!l)
                    fail(404, 'Location not found');
                const { rows: [company] } = await db.query('SELECT timezone FROM companies WHERE id=$1', [c.companyId]);
                if (d.timezone !== (l.timezone || company.timezone))
                    fail(400, 'Use the location timezone (or company timezone if unset)');
                const aid = randomUUID();
                await db.query(`INSERT INTO contractor_assignments(id,company_id,business_id,location_id,starts_on,ends_on,timezone,weekdays,start_time,end_time,scope,frequency,checklist,supplies,equipment,admin_contact) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [aid, c.companyId, d.business_id, d.location_id, d.starts_on, d.ends_on, d.timezone, [...new Set(d.weekdays)], d.start_time, d.end_time, d.scope, d.frequency, JSON.stringify(d.checklist), d.supplies, d.equipment, d.admin_contact]);
                await this.audit(db, c, d.business_id, 'assignment', aid, 'proposed');
                await this.notify(db, c, d.business_id, `assignment:${aid}`, 'A new service assignment is ready to review.', 'contractor');
                return { id: aid };
            }
            if (action === 'assignment-decision') {
                this.manager(c);
                if (c.admin)
                    fail(403, 'The contractor manager must accept or decline');
                const a = await this.assignment(db, c, id);
                this.checkVersion(a, body.version);
                if (a.state !== 'proposed')
                    fail(409, 'Assignment already decided');
                const decision = z.enum(['accepted', 'declined']).parse(body.decision);
                const reason = z.string().trim().min(decision === 'declined' ? 1 : 0).max(2000).parse(body.reason || '');
                await db.query('UPDATE contractor_assignments SET state=$1,decision_reason=$2,version=version+1 WHERE id=$3', [decision, reason, id]);
                await this.audit(db, c, a.business_id, 'assignment', id, decision, { reason });
                await this.notify(db, c, a.business_id, `decision:${id}`, `An assignment was ${decision}.`, 'admin');
                if (decision === 'accepted')
                    await this.generate(db, c, a);
                return { ok: true };
            }
            if (action === 'allocate-lead') {
                this.manager(c);
                const a = await this.assignment(db, c, id);
                this.checkVersion(a, body.version);
                if (body.member_id) {
                    const { rows: [m] } = await db.query(`SELECT m.*,b.status business_status FROM contractor_memberships m JOIN contractor_businesses b ON b.id=m.business_id WHERE m.id=$1 AND m.business_id=$2 AND m.role='lead'`, [body.member_id, a.business_id]);
                    if (!isActiveMembership(m))
                        fail(400, 'Select an active team lead from this contractor');
                }
                await db.query('UPDATE contractor_assignments SET lead_member_id=$1,version=version+1 WHERE id=$2', [body.member_id || null, id]);
                await this.audit(db, c, a.business_id, 'assignment', id, 'lead allocated');
                return { ok: true };
            }
            if (action === 'end-assignment') {
                this.admin(c);
                const a = await this.assignment(db, c, id);
                this.checkVersion(a, body.version);
                await db.query("UPDATE contractor_assignments SET state='ended',version=version+1 WHERE id=$1", [id]);
                await db.query(`UPDATE contractor_visits SET status='cancelled',version=version+1 WHERE assignment_id=$1 AND service_date>$2 AND status='scheduled'`, [id, localDate(new Date(), a.timezone)]);
                await this.audit(db, c, a.business_id, 'assignment', id, 'ended');
                return { ok: true };
            }
            if (action === 'instructions') {
                this.admin(c);
                const a = await this.assignment(db, c, id);
                this.checkVersion(a, body.version);
                const d = z.object({ content: z.string().trim().min(1).max(30000), access_details: z.string().max(10000).default(''), access_member_ids: z.array(z.string()).max(100).default([]), important: z.boolean().default(true) }).parse(body);
                if (d.access_member_ids.length) {
                    const { rows } = await db.query("SELECT id FROM contractor_memberships WHERE id=ANY($1) AND business_id=$2 AND status='active'", [d.access_member_ids, a.business_id]);
                    if (rows.length !== new Set(d.access_member_ids).size)
                        fail(400, 'Access recipients must be active members of this contractor');
                }
                const { rows: [v] } = await db.query('SELECT COALESCE(max(version),0)+1 version FROM contractor_instructions WHERE assignment_id=$1', [id]);
                await db.query(`INSERT INTO contractor_instructions(id,assignment_id,version,content,access_details,access_member_ids,important,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [randomUUID(), id, v.version, d.content, d.access_details, d.access_member_ids, d.important, c.id]);
                await db.query('UPDATE contractor_assignments SET version=version+1 WHERE id=$1', [id]);
                await this.audit(db, c, a.business_id, 'assignment', id, 'instructions updated', { version: v.version, important: d.important });
                await this.notify(db, c, a.business_id, `instructions:${id}:${v.version}`, 'Site instructions have changed. Review them in ClockField.', 'contractor');
                return { ok: true };
            }
            if (action === 'acknowledge') {
                if (c.admin)
                    fail(403, 'Contractor acknowledgement required');
                const a = await this.assignment(db, c, id);
                const { rows: [i] } = await db.query('SELECT id FROM contractor_instructions WHERE assignment_id=$1 ORDER BY version DESC LIMIT 1', [id]);
                if (!i || i.id !== body.instruction_id)
                    fail(409, 'Instructions changed. Refresh before acknowledging');
                await db.query('INSERT INTO contractor_acknowledgements(instruction_id,member_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [i.id, c.member.id]);
                await this.audit(db, c, a.business_id, 'assignment', id, 'instructions acknowledged', { instruction_id: i.id });
                return { ok: true };
            }
            if (action === 'generate') {
                this.admin(c);
                const a = await this.assignment(db, c, id);
                if (a.state !== 'accepted')
                    fail(409, 'Accept the assignment first');
                return { created: await this.generate(db, c, a) };
            }
            if (action === 'submit') {
                if (c.admin)
                    fail(403, 'Only a contractor can submit work');
                const { v, a } = await this.visit(db, c, id, true);
                const d = submissionInput.parse(body);
                const { rows: [existing] } = await db.query('SELECT id FROM contractor_submissions WHERE visit_id=$1 AND request_key=$2', [id, d.request_key]);
                if (existing)
                    return { id: existing.id, replayed: true };
                this.checkVersion(v, d.version);
                if (!['scheduled', 'blocked', 'correction_required'].includes(v.status))
                    fail(409, 'This visit cannot be submitted');
                if (String(v.service_date).slice(0, 10) > localDate(new Date(), a.timezone))
                    fail(400, 'Future service cannot be marked complete');
                const { rows: [i] } = await db.query('SELECT * FROM contractor_instructions WHERE assignment_id=$1 ORDER BY version DESC LIMIT 1', [a.id]);
                if (i?.important) {
                    const { rows } = await db.query('SELECT 1 FROM contractor_acknowledgements WHERE instruction_id=$1 AND member_id=$2', [i.id, c.member.id]);
                    if (!rows.length)
                        fail(409, 'Acknowledge the current site instructions first');
                }
                const ids = [...new Set([...d.file_ids, ...Object.values(d.task_files).flat()])];
                const { rows: files } = await db.query("SELECT * FROM contractor_files WHERE id=ANY($1) AND entity_id=$2 AND kind='visit' AND company_id=$3 AND business_id=$4", [ids, id, c.companyId, c.businessId]);
                if (files.length !== ids.length)
                    fail(400, 'Evidence must be uploaded to this visit');
                for (const task of a.checklist) {
                    if (task.required && !d.checklist[task.id])
                        fail(400, `Complete: ${task.label}`);
                    if (task.photo_required && !(d.task_files[task.id] || []).some(fid => files.some((f: any) => f.id === fid && f.mime.startsWith('image/'))))
                        fail(400, `Photo evidence required: ${task.label}`);
                }
                const sid = randomUUID();
                await db.query(`INSERT INTO contractor_submissions(id,visit_id,revision,submitted_by,checklist,notes,file_ids,request_key) SELECT $1,$2,COALESCE(max(revision),0)+1,$3,$4,$5,$6,$7 FROM contractor_submissions WHERE visit_id=$2`, [sid, id, c.id, JSON.stringify({ answers: d.checklist, task_files: d.task_files }), d.notes, ids, d.request_key]);
                await db.query("UPDATE contractor_visits SET status='submitted',deadline=NULL,version=version+1,updated_at=now() WHERE id=$1", [id]);
                await this.audit(db, c, a.business_id, 'visit', id, 'submitted', { submission_id: sid });
                await this.notify(db, c, a.business_id, `submission:${sid}`, 'Completed work is ready for review.', 'admin');
                return { id: sid };
            }
            if (action === 'review') {
                this.admin(c);
                const { v, a } = await this.visit(db, c, id);
                this.checkVersion(v, body.version);
                if (v.status !== 'submitted')
                    fail(409, 'Only submitted work can be reviewed');
                const d = z.object({ decision: z.enum(['approved', 'correction_required']), findings: z.string().trim().max(10000).default(''), deadline: z.string().datetime().nullable().optional(), score: z.number().int().min(0).max(100).nullable().optional() }).parse(body);
                if (d.decision === 'correction_required' && (!d.findings || !d.deadline || new Date(d.deadline) <= new Date()))
                    fail(400, 'Provide findings and a future correction deadline');
                const { rows: [s] } = await db.query('SELECT revision FROM contractor_submissions WHERE visit_id=$1 ORDER BY revision DESC LIMIT 1', [id]);
                await db.query('INSERT INTO contractor_inspections(id,visit_id,revision,reviewer_id,decision,findings,deadline,score) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), id, s.revision, c.id, d.decision, d.findings, d.deadline || null, d.score ?? null]);
                await db.query('UPDATE contractor_visits SET status=$1,review_findings=$2,deadline=$3,version=version+1,updated_at=now() WHERE id=$4', [d.decision, d.findings, d.decision === 'correction_required' ? d.deadline : null, id]);
                await this.audit(db, c, a.business_id, 'visit', id, d.decision, { revision: s.revision });
                await this.notify(db, c, a.business_id, `review:${id}:${v.version}`, d.decision === 'approved' ? 'Service work has been approved.' : 'Corrections were requested. Check findings and deadline in ClockField.', 'contractor');
                return { ok: true };
            }
            if (action === 'visit-status') {
                const { v, a } = await this.visit(db, c, id, !c.admin);
                this.checkVersion(v, body.version);
                if (!canTransition(c.admin ? 'admin' : 'contractor', v.status, body.status))
                    fail(409, 'This status transition is not permitted');
                const reason = z.string().trim().min(1).max(2000).parse(body.reason);
                if (body.status === 'missed' && String(v.service_date).slice(0, 10) >= localDate(new Date(), a.timezone))
                    fail(400, 'A visit can only be marked missed after its local service day ends');
                await db.query('UPDATE contractor_visits SET status=$1,review_findings=$2,version=version+1,updated_at=now() WHERE id=$3', [body.status, reason, id]);
                await this.audit(db, c, a.business_id, 'visit', id, body.status, { reason });
                await this.notify(db, c, a.business_id, `visit:${id}:${v.version}`, 'A service visit status changed. Review it in ClockField.');
                return { ok: true };
            }
            if (action === 'create-issue') {
                const d = issueInput.parse(body), a = await this.assignment(db, c, d.assignment_id, !c.admin);
                if (d.visit_id) {
                    const { v } = await this.visit(db, c, d.visit_id, !c.admin);
                    if (v.assignment_id !== a.id)
                        fail(400, 'Visit belongs to another assignment');
                }
                await this.checkOwner(db, c, a.business_id, d.owner_id);
                const iid = randomUUID();
                await db.query(`INSERT INTO contractor_issues(id,company_id,business_id,assignment_id,visit_id,category,severity,description,owner_id,response_target,resolution_target,raised_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [iid, c.companyId, a.business_id, a.id, d.visit_id || null, d.category, d.severity, d.description, d.owner_id || null, d.response_target, d.resolution_target, c.id]);
                await this.audit(db, c, a.business_id, 'issue', iid, 'raised');
                await this.notify(db, c, a.business_id, `issue:${iid}`, 'A service issue needs attention. Urgent emergencies require the site emergency procedure.');
                return { id: iid };
            }
            if (action === 'comment' || action === 'issue-status') {
                const { rows: [i] } = await db.query('SELECT * FROM contractor_issues WHERE id=$1 AND company_id=$2 FOR UPDATE', [id, c.companyId]);
                if (!i)
                    fail(404, 'Issue not found');
                await this.assignment(db, c, i.assignment_id, !c.admin);
                if (action === 'comment') {
                    const d = z.object({ body: z.string().trim().min(1).max(10000), request_key: z.string().min(8).max(100) }).parse(body);
                    await db.query('INSERT INTO contractor_comments(id,issue_id,author_id,body,request_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [randomUUID(), id, c.id, d.body, d.request_key]);
                    await db.query('UPDATE contractor_issues SET responded_at=COALESCE(responded_at,now()) WHERE id=$1', [id]);
                    await this.notify(db, c, i.business_id, `comment:${id}:${c.id}:${d.request_key}`, 'A new issue comment is available.');
                    return { ok: true };
                }
                this.checkVersion(i, body.version);
                const status = z.enum(['open', 'in_progress', 'resolved', 'closed']).parse(body.status);
                if (status === 'closed')
                    this.admin(c);
                if (body.owner_id !== undefined)
                    await this.checkOwner(db, c, i.business_id, body.owner_id);
                await db.query(`UPDATE contractor_issues SET status=$1,owner_id=$2,resolved_at=CASE WHEN $1 IN ('resolved','closed') THEN COALESCE(resolved_at,now()) ELSE NULL END,version=version+1 WHERE id=$3`, [status, body.owner_id === undefined ? i.owner_id : body.owner_id, id]);
                await this.audit(db, c, i.business_id, 'issue', id, status);
                await this.notify(db, c, i.business_id, `issue-status:${id}:${i.version}`, 'A service issue status changed.');
                return { ok: true };
            }
            if (action === 'document-review') {
                this.admin(c);
                const { rows: [f] } = await db.query("SELECT * FROM contractor_files WHERE id=$1 AND company_id=$2 AND kind='business' FOR UPDATE", [id, c.companyId]);
                if (!f)
                    fail(404, 'Document not found');
                this.checkVersion(f, body.version);
                const approvalStatus = z.enum(['pending', 'approved', 'rejected']).parse(body.approval_status);
                await db.query('UPDATE contractor_files SET approval_status=$1,version=version+1 WHERE id=$2', [approvalStatus, id]);
                await this.audit(db, c, f.business_id, 'document', id, 'reviewed', { approval_status: approvalStatus });
                return { ok: true };
            }
            if (action === 'read-notification') {
                await db.query('UPDATE contractor_notifications SET read_at=now() WHERE id=$1 AND company_id=$2 AND recipient_id=$3', [id, c.companyId, c.id]);
                return { ok: true };
            }
            fail(404, 'Action not found');
        });
    }
    async checkOwner(db: DB, c: any, business: string, id?: string | null) {
        if (!id)
            return;
        const { rows: [u] } = await db.query('SELECT * FROM users WHERE id=$1 AND company_id=$2 AND is_active=true', [id, c.companyId]);
        if (u?.role === 'admin' && hasAccess({ ...u, adminPermissions: u.admin_permissions }, 'contractors'))
            return;
        const { rows: [m] } = await db.query(`SELECT m.*,b.status business_status FROM contractor_memberships m JOIN contractor_businesses b ON b.id=m.business_id WHERE user_id=$1 AND m.business_id=$2`, [id, business]);
        if (!isActiveMembership(m))
            fail(400, 'Select an authorized issue owner');
    }
    async generate(db: DB, c: any, a: any) {
        let count = 0;
        for (const day of serviceDates({ ...a, starts_on: String(a.starts_on).slice(0, 10), ends_on: String(a.ends_on).slice(0, 10) }, String(a.starts_on).slice(0, 10), String(a.ends_on).slice(0, 10))) {
            const r = await db.query(`INSERT INTO contractor_visits(id,company_id,business_id,assignment_id,service_date) VALUES($1,$2,$3,$4,$5) ON CONFLICT(assignment_id,service_date) DO NOTHING`, [randomUUID(), c.companyId, a.business_id, a.id, day]);
            count += r.rowCount;
        }
        return count;
    }
}
