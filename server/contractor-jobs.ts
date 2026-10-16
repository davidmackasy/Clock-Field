import { ContractorService } from './contractor-service';
import { hasAccess } from '../shared/people';
import { isActiveMembership, localDate, serviceDayOver } from '../shared/contractor';
export async function processContractorJobs(pool: any, send: (to: string, subject: string, body: string) => Promise<any>) {
    const svc = new ContractorService(pool);
    // Deduplicated in-app alerts are recorded first; email is a retryable outbox.
    const db = await pool.connect();
    try {
        await db.query('BEGIN');
        const { rows: overdue } = await db.query(`SELECT i.company_id,i.business_id,i.id,i.resolution_target target FROM contractor_issues i WHERE status NOT IN ('resolved','closed') AND (resolution_target<now() OR (responded_at IS NULL AND response_target<now())) UNION ALL SELECT company_id,business_id,id,deadline target FROM contractor_visits WHERE status='correction_required' AND deadline<now()`);
        for (const row of overdue)
            await svc.notify(db, { companyId: row.company_id }, row.business_id, `overdue:${row.id}:${new Date(row.target).toISOString()}`, 'An issue or correction is overdue. Review targets in ClockField.');
        const { rows: visits } = await db.query(`SELECT v.*,a.timezone,a.start_time,a.end_time FROM contractor_visits v JOIN contractor_assignments a ON a.id=v.assignment_id JOIN contractor_businesses b ON b.id=v.business_id WHERE v.status='scheduled' AND a.state='accepted' AND b.status='active' FOR UPDATE OF v`);
        for (const v of visits)
            if (serviceDayOver(v)) {
                await db.query("UPDATE contractor_visits SET status='missed',version=version+1 WHERE id=$1 AND status='scheduled'", [v.id]);
                await svc.audit(db, { companyId: v.company_id, id: null }, v.business_id, 'visit', v.id, 'missed', { reason: 'Local service day ended without submission' });
                await svc.notify(db, { companyId: v.company_id }, v.business_id, `missed:${v.id}`, 'A scheduled service day ended without a submission.');
            }
        await db.query('COMMIT');
    }
    catch (e) {
        await db.query('ROLLBACK');
        throw e;
    }
    finally {
        db.release();
    }
    const { rows: messages } = await pool.query(`WITH selected AS(SELECT id FROM contractor_notifications WHERE (email_state='pending' AND next_attempt_at<=now()) OR (email_state='sending' AND next_attempt_at<now()-interval '5 minutes') ORDER BY created_at LIMIT 30 FOR UPDATE SKIP LOCKED) UPDATE contractor_notifications n SET email_state='sending',attempts=attempts+1,next_attempt_at=now() FROM selected WHERE n.id=selected.id RETURNING n.*`);
    await Promise.all(messages.map(async (n: any) => {
        try {
            const { rows: [u] } = await pool.query('SELECT * FROM users WHERE id=$1 AND company_id=$2', [n.recipient_id, n.company_id]);
            const { rows: [m] } = await pool.query(`SELECT m.*,b.status business_status FROM contractor_memberships m JOIN contractor_businesses b ON b.id=m.business_id WHERE user_id=$1 AND m.business_id=$2`, [n.recipient_id, n.business_id]);
            if (!u?.is_active || !u.email || (u.role === 'admin' ? !hasAccess({ ...u, adminPermissions: u.admin_permissions }, 'contractors') : !isActiveMembership(m))) {
                await pool.query("UPDATE contractor_notifications SET email_state='cancelled' WHERE id=$1", [n.id]);
                return;
            }
            await send(u.email, 'ClockField contractor workspace update', `${n.body}\n\nOpen your workspace: ${new URL(n.href, process.env.APP_URL || 'https://clockfield.com').href}`);
            await pool.query("UPDATE contractor_notifications SET email_state='sent' WHERE id=$1", [n.id]);
        }
        catch {
            await pool.query("UPDATE contractor_notifications SET email_state='pending',next_attempt_at=now()+interval '5 minutes' WHERE id=$1", [n.id]);
        }
    }));
    return { processed: messages.length };
}
