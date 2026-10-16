import { ContractorService, fail, tokenHash } from './contractor-service';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hasAccess } from '../shared/people';
import { date, localDate, assignmentActive } from '../shared/contractor';
export class ContractorQueries extends ContractorService {
    async state(user: any) {
        return this.run(user, async (db, c) => {
            const filter = c.admin ? '' : ` AND a.business_id=$2${c.member.role === 'lead' ? ' AND a.lead_member_id=$3' : ''}`;
            const args = c.admin ? [c.companyId] : c.member.role === 'lead' ? [c.companyId, c.businessId, c.member.id] : [c.companyId, c.businessId];
            const { rows: assignments } = await db.query(`SELECT a.*,l.name location_name,l.address FROM contractor_assignments a JOIN locations l ON l.id=a.location_id AND l.company_id=a.company_id WHERE a.company_id=$1${filter} ORDER BY a.starts_on DESC`, args);
            const ids = assignments.map((a: any) => a.id);
            const businessIds = [...new Set(c.admin ? [] : assignments.map((a: any) => a.business_id))];
            const { rows: businesses } = await db.query(`SELECT * FROM contractor_businesses WHERE company_id=$1${c.admin ? '' : ' AND id=$2'} ORDER BY name`, c.admin ? [c.companyId] : [c.companyId, c.businessId]);
            const { rows: visits } = await db.query('SELECT * FROM contractor_visits WHERE company_id=$1 AND assignment_id=ANY($2) ORDER BY service_date DESC', [c.companyId, ids]);
            const visitIds = visits.map((v: any) => v.id);
            const { rows: submissions } = await db.query('SELECT * FROM contractor_submissions WHERE visit_id=ANY($1) ORDER BY submitted_at DESC', [visitIds]);
            const { rows: inspections } = await db.query('SELECT * FROM contractor_inspections WHERE visit_id=ANY($1) ORDER BY created_at DESC', [visitIds]);
            const { rows: instructions } = await db.query(`SELECT id,assignment_id,version,content,important,created_at FROM contractor_instructions WHERE assignment_id=ANY($1) ORDER BY version DESC`, [ids]);
            const { rows: acknowledgements } = await db.query(`SELECT x.* FROM contractor_acknowledgements x JOIN contractor_instructions i ON i.id=x.instruction_id WHERE i.assignment_id=ANY($1)${c.admin ? '' : ' AND x.member_id=$2'}`, c.admin ? [ids] : [ids, c.member.id]);
            const { rows: issues } = await db.query('SELECT * FROM contractor_issues WHERE company_id=$1 AND assignment_id=ANY($2) ORDER BY created_at DESC', [c.companyId, ids]);
            const { rows: comments } = await db.query('SELECT * FROM contractor_comments WHERE issue_id=ANY($1) ORDER BY created_at', [issues.map((i: any) => i.id)]);
            const { rows: members } = c.admin || c.member.role === 'manager' ? await db.query(`SELECT m.*,u.first_name,u.last_name,u.email FROM contractor_memberships m JOIN users u ON u.id=m.user_id WHERE m.company_id=$1${c.admin ? '' : ' AND m.business_id=$2'}`, c.admin ? [c.companyId] : [c.companyId, c.businessId]) : { rows: [] };
            const { rows: invitations } = c.admin ? await db.query('SELECT id,business_id,email,role,expires_at,revoked_at,accepted_at FROM contractor_invitations WHERE company_id=$1', [c.companyId]) : { rows: [] };
            const liveIds = assignments.filter((a: any) => assignmentActive(a)).map((a: any) => a.id);
            const liveVisits = visits.filter((v: any) => liveIds.includes(v.assignment_id)).map((v: any) => v.id), liveIssues = issues.filter((i: any) => liveIds.includes(i.assignment_id)).map((i: any) => i.id);
            const { rows: files } = await db.query(`SELECT id,business_id,kind,entity_id,name,mime,size,document_type,expires_on,approval_status,uploaded_by,created_at,version FROM contractor_files WHERE company_id=$1${c.admin ? '' : ` AND business_id=$2 AND ((kind='business' AND $3=true) OR (kind='visit' AND entity_id=ANY($4)) OR (kind='issue' AND entity_id=ANY($5)))`}`, c.admin ? [c.companyId] : [c.companyId, c.businessId, c.member.role === 'manager', liveVisits, liveIssues]);
            const { rows: audit } = await db.query(`SELECT id,entity_type,entity_id,actor_id,action,details,created_at FROM contractor_audit WHERE company_id=$1${c.admin ? '' : ` AND business_id=$2 AND ((entity_type='assignment' AND entity_id=ANY($3)) OR (entity_type='visit' AND entity_id=ANY($4)) OR (entity_type='issue' AND entity_id=ANY($5)))`} ORDER BY created_at DESC LIMIT 500`, c.admin ? [c.companyId] : [c.companyId, c.businessId, ids, visitIds, issues.map((i: any) => i.id)]);
            const { rows: notifications } = await db.query('SELECT id,body,href,read_at,created_at FROM contractor_notifications WHERE company_id=$1 AND recipient_id=$2 ORDER BY created_at DESC LIMIT 50', [c.companyId, c.id]);
            const { rows: company } = await db.query('SELECT name,company_logo_url,brand_color,timezone FROM companies WHERE id=$1', [c.companyId]);
            const { rows: locations } = c.admin ? await db.query('SELECT id,name,address,timezone FROM locations WHERE company_id=$1 ORDER BY name', [c.companyId]) : { rows: [] };
            const { rows: adminContacts } = await db.query("SELECT id,role,admin_permissions,first_name,last_name FROM users WHERE company_id=$1 AND role='admin' AND is_active=true", [c.companyId]);
            const owner_candidates = [...adminContacts.filter((u: any) => hasAccess({ ...u, adminPermissions: u.admin_permissions }, 'contractors')).map((u: any) => ({ id: u.id, name: `${u.first_name} ${u.last_name}`, business_id: null })), ...members.filter((m: any) => m.status === 'active').map((m: any) => ({ id: m.user_id, name: `${m.first_name} ${m.last_name}`, business_id: m.business_id }))];
            return { owner_candidates, admin: c.admin, membership: c.member ? { id: c.member.id, role: c.member.role, business_id: c.businessId } : null, company: company[0], businesses: c.admin || c.member.role === 'manager' ? businesses : businesses.map((b: any) => ({ id: b.id, name: b.name, status: b.status })), assignments, visits, submissions, inspections, instructions, acknowledgements, issues, comments, members, invitations, files, audit, notifications, locations };
        });
    }
    async accessDetails(user: any, id: string) {
        return this.run(user, async (db, c) => {
            const a = await this.assignment(db, c, id, !c.admin);
            const { rows: [i] } = await db.query('SELECT access_details,access_member_ids FROM contractor_instructions WHERE assignment_id=$1 ORDER BY version DESC LIMIT 1', [a.id]);
            if (!i || !c.admin && !i.access_member_ids.includes(c.member.id))
                fail(403, 'Sensitive access information has not been shared with you');
            await this.audit(db, c, a.business_id, 'assignment', id, 'access information viewed');
            return { access_details: i.access_details };
        });
    }
    async fileScope(db: any, c: any, kind: string, id: string) {
        if (kind === 'business') {
            this.manager(c);
            return (await this.business(db, c, id)).id;
        }
        if (kind === 'visit') {
            return (await this.visit(db, c, id, !c.admin)).a.business_id;
        }
        if (kind === 'issue') {
            const { rows: [i] } = await db.query('SELECT * FROM contractor_issues WHERE id=$1 AND company_id=$2', [id, c.companyId]);
            if (!i)
                fail(404, 'Issue not found');
            return (await this.assignment(db, c, i.assignment_id, !c.admin)).business_id;
        }
        fail(400, 'Choose a document, visit or issue');
    }
    async withFile(user: any, id: string, fn: (f: any) => Promise<any>) {
        return this.run(user, async (db, c) => {
            const { rows: [f] } = await db.query('SELECT * FROM contractor_files WHERE id=$1 AND company_id=$2', [id, c.companyId]);
            if (!f)
                fail(404, 'File not found');
            await this.fileScope(db, c, f.kind, f.entity_id);
            return fn(f);
        });
    }
    async report(user: any, from: string, to: string, business?: string, location?: string) {
        date.parse(from);
        date.parse(to);
        if (to < from || Date.parse(to) - Date.parse(from) > 366 * 86400000)
            fail(400, 'Choose up to one year');
        const s = await this.state(user);
        const assignments = s.assignments.filter((a: any) => (!business || a.business_id === business) && (!location || a.location_id === location));
        const ids = assignments.map((a: any) => a.id);
        const visits = s.visits.filter((v: any) => ids.includes(v.assignment_id) && v.service_date >= from && v.service_date <= to);
        const issues = s.issues.filter((i: any) => ids.includes(i.assignment_id) && localDate(new Date(i.created_at), assignments.find((a: any) => a.id === i.assignment_id).timezone) >= from && localDate(new Date(i.created_at), assignments.find((a: any) => a.id === i.assignment_id).timezone) <= to);
        const groups = assignments.map((a: any) => ({ business_id: a.business_id, location_id: a.location_id, name: a.location_name, timezone: a.timezone })).filter((a: any, i: number, arr: any[]) => arr.findIndex(b => b.business_id === a.business_id && b.location_id === a.location_id) === i);
        const now = Date.now();
        return { from, to, definitions: { scheduled: 'All visits whose local service date falls in the period; cancelled visits remain in the denominator.', submitted: 'Visits with at least one submission revision, including approved or correction-required visits.', approved: 'Visits currently approved / all scheduled visits.', inspection_coverage: 'Distinct inspected visits / visits with submissions. Uninspected is not a failed inspection.', quality_score: 'Mean numeric scores on each visit’s latest inspection; latest unscored inspections and uninspected visits are excluded.', complaints: 'Issues explicitly categorized as complaints; ordinary client requests are excluded.', repeat_defects: 'Correction decisions after the first correction on the same visit.', resolution_hours: 'Mean elapsed hours from issue creation to resolution for resolved issues created in this period.', open_issues: 'Unresolved issues created in the selected period.', overdue_corrections: 'Current correction-required visits in the period whose deadline has passed.' }, groups: groups.map((g: any) => { const aid = assignments.filter((a: any) => a.business_id === g.business_id && a.location_id === g.location_id).map((a: any) => a.id), vs = visits.filter((v: any) => aid.includes(v.assignment_id)), vid = vs.map((v: any) => v.id), subs = s.submissions.filter((x: any) => vid.includes(x.visit_id)), ins = s.inspections.filter((x: any) => vid.includes(x.visit_id)), is = issues.filter((i: any) => aid.includes(i.assignment_id)); const submitted = new Set(subs.map((x: any) => x.visit_id)).size, inspected = new Set(ins.map((x: any) => x.visit_id)).size; const latest = vs.map((v: any) => ins.find((x: any) => x.visit_id === v.id)).filter(Boolean); const scores = latest.filter((i: any) => i.score !== null); const resolved = is.filter((i: any) => i.resolved_at); return { ...g, scheduled: vs.length, submitted, approved: vs.filter((v: any) => v.status === 'approved').length, missed: vs.filter((v: any) => v.status === 'missed').length, cancelled: vs.filter((v: any) => v.status === 'cancelled').length, inspections: ins.length, inspected_visits: inspected, inspection_coverage: submitted ? Math.round(inspected / submitted * 100) : null, uninspected_submissions: submitted - inspected, quality_score: scores.length ? Math.round(scores.reduce((sum: number, i: any) => sum + i.score, 0) / scores.length) : null, scored_visits: scores.length, complaints: is.filter((i: any) => i.category === 'complaint').length, repeat_defects: vs.reduce((n: number, v: any) => n + Math.max(0, ins.filter((i: any) => i.visit_id === v.id && i.decision === 'correction_required').length - 1), 0), open_issues: is.filter((i: any) => !['resolved', 'closed'].includes(i.status)).length, overdue_corrections: vs.filter((v: any) => v.status === 'correction_required' && v.deadline && new Date(v.deadline).getTime() < now).length, resolution_hours: resolved.length ? Math.round(resolved.reduce((n: number, i: any) => n + (new Date(i.resolved_at).getTime() - new Date(i.created_at).getTime()) / 3600000, 0) / resolved.length * 10) / 10 : null }; }) };
    }
    async invitation(raw: string) {
        if (!/^[\w-]{40,100}$/.test(raw))
            fail(404, 'Invitation not found');
        const { rows: [i] } = await this.pool.query(`SELECT i.id,i.email,i.role,b.name business_name,c.name company_name,c.company_logo_url FROM contractor_invitations i JOIN contractor_businesses b ON b.id=i.business_id JOIN companies c ON c.id=i.company_id WHERE i.token_hash=$1 AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>now() AND b.status='active'`, [tokenHash(raw)]);
        if (!i)
            fail(410, 'This invitation has expired or was revoked');
        return i;
    }
    async accept(raw: string, details: any, passwordHash: string, existingUser?: any) {
        const d = z.object({ first_name: z.string().trim().min(1).max(100), last_name: z.string().trim().min(1).max(100) }).parse(details);
        const db = await this.pool.connect();
        try {
            await db.query('BEGIN');
            const { rows: [i] } = await db.query(`SELECT i.* FROM contractor_invitations i JOIN contractor_businesses b ON b.id=i.business_id WHERE token_hash=$1 AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>now() AND b.status='active' FOR UPDATE OF i,b`, [tokenHash(raw)]);
            if (!i)
                fail(410, 'This invitation has expired or was revoked');
            const { rows: [old] } = await db.query('SELECT * FROM users WHERE lower(email)=lower($1)', [i.email]);
            if (old)
                fail(409, 'This email already has an account. Ask your admin to use a separate contractor account email.');
            const uid = randomUUID();
            await db.query(`INSERT INTO users(id,company_id,email,password,role,first_name,last_name,is_active,login_enabled,account_status) VALUES($1,$2,$3,$4,'contractor',$5,$6,true,true,'active')`, [uid, i.company_id, i.email, passwordHash, d.first_name, d.last_name]);
            await db.query(`INSERT INTO contractor_memberships(id,company_id,business_id,user_id,role) VALUES($1,$2,$3,$4,$5)`, [randomUUID(), i.company_id, i.business_id, uid, i.role]);
            await db.query('UPDATE contractor_invitations SET accepted_at=now() WHERE id=$1', [i.id]);
            await this.audit(db, { id: uid, companyId: i.company_id }, i.business_id, 'invitation', i.id, 'accepted');
            await db.query('COMMIT');
            return { ok: true };
        }
        catch (e) {
            await db.query('ROLLBACK');
            throw e;
        }
        finally {
            db.release();
        }
    }
}
