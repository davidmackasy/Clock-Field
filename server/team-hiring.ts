import { randomBytes } from 'node:crypto';
import { db, pool } from './db';
import { users, companies, employeeHiringPackages } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from './auth';
import { emptyProfile, profileSchema, safePerson, mergeSubmittedProfile, employeeInput } from '../shared/people';
import { getPlan } from './plans';
export function registerTeamHiring(app: any, storage: any, requireRole: any, ensureTemplate: any) {
    const now = () => new Date().toISOString();
    const base = (req: any) => process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    app.get('/api/employees/:id/hiring', requireRole('admin'), async (req: any, res: any) => { try {
        const employee = await storage.getUser(req.params.id);
        if (!employee || employee.role !== 'employee' || employee.companyId !== req.user.companyId)
            return res.sendStatus(404);
        const { rows } = await pool.query(`SELECT p.*,s.id AS submission_id,s.status AS submission_status,s.submitted_at,s.review_status FROM employee_hiring_packages p LEFT JOIN employee_hiring_submissions s ON s.package_id=p.id WHERE p.company_id=$1 AND (p.employee_id=$2 OR (p.employee_id IS NULL AND lower(p.employee_email)=lower($3) AND $3<>'')) ORDER BY p.created_at DESC`, [req.user.companyId, employee.id, employee.email || '']);
        res.json(rows.map(p => ({ ...p, publicLink: `${base(req)}/public/hiring-package/${p.public_token}` })));
    }
    catch {
        res.status(500).json({ message: 'Could not load hiring history' });
    } });
    app.post('/api/employees/:id/hiring', requireRole('admin'), async (req: any, res: any) => { try {
        const employee = await storage.getUser(req.params.id);
        if (!employee || employee.role !== 'employee' || employee.companyId !== req.user.companyId)
            return res.sendStatus(404);
        const template = await ensureTemplate(req.user.companyId), timestamp = now();
        const pkg = await storage.createHPPackage({ companyId: req.user.companyId, templateId: template.id, employeeId: employee.id, applicationKind: 'application', employeeName: `${employee.firstName} ${employee.lastName}`, employeeEmail: employee.email || '', position: employee.position || '', publicToken: randomBytes(24).toString('base64url'), status: 'draft', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), createdBy: req.user.id, createdAt: timestamp, updatedAt: timestamp });
        res.status(201).json({ ...pkg, publicLink: `${base(req)}/public/hiring-package/${pkg.publicToken}` });
    }
    catch {
        res.status(500).json({ message: 'Could not create the profile completion link' });
    } });
    app.get('/api/hiring-applications', requireRole('admin'), async (req: any, res: any) => { try {
        const { rows } = await pool.query(`SELECT p.public_token,p.id,p.employee_name,p.employee_email,p.employee_id,p.position,p.status,p.created_at,s.id AS submission_id,s.status AS submission_status,s.review_status,s.submitted_at,(SELECT count(*)::int FROM employee_hiring_documents d WHERE d.submission_id=s.id) AS document_count FROM employee_hiring_packages p LEFT JOIN employee_hiring_submissions s ON s.package_id=p.id WHERE p.company_id=$1 ORDER BY p.created_at DESC LIMIT 200`, [req.user.companyId]);
        res.json(rows.map(p => ({ ...p, publicLink: `${base(req)}/public/hiring-package/${p.public_token}` })));
    }
    catch {
        res.status(500).json({ message: 'Could not load applications' });
    } });
    app.post('/api/hiring-applications/link', requireRole('admin'), async (req: any, res: any) => { try {
        const { rows } = await pool.query(`INSERT INTO hiring_application_links(company_id,public_token) VALUES($1,$2) ON CONFLICT(company_id) DO UPDATE SET is_active=true RETURNING public_token`, [req.user.companyId, randomBytes(24).toString('base64url')]);
        res.json({ url: `${base(req)}/apply/${rows[0].public_token}` });
    }
    catch {
        res.status(500).json({ message: 'Could not create an application link' });
    } });
    app.get('/api/public/apply/:token', async (req: any, res: any) => { try {
        const { rows } = await pool.query('SELECT company_id FROM hiring_application_links WHERE public_token=$1 AND is_active=true', [req.params.token]);
        if (!rows[0])
            return res.status(404).json({ message: 'Application link is unavailable' });
        const company = await storage.getCompany(rows[0].company_id);
        res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }).json({ companyName: company.name, companyLogoUrl: company.companyLogoUrl, brandColor: company.brandColor });
    }
    catch {
        res.status(500).json({ message: 'Could not load the application' });
    } });
    const attempts = new Map<string, {
        time: number;
        count: number;
    }>();
    app.post('/api/public/apply/:token/start', async (req: any, res: any) => { try {
        res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' });
        const firstName = String(req.body.firstName || '').trim(), lastName = String(req.body.lastName || '').trim(), email = String(req.body.email || '').trim().toLowerCase();
        if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 250)
            return res.status(400).json({ message: 'Enter your full name and a valid email address' });
        if (req.body.website)
            return res.status(400).json({ message: 'Application could not be started' });
        const key = `${req.params.token}:${req.ip}`;
        let attempt = attempts.get(key);
        if (!attempt || Date.now() - attempt.time > 3600000) {
            attempt = { time: Date.now(), count: 0 };
            if (attempts.size > 10000)
                attempts.clear();
            attempts.set(key, attempt);
        }
        if (++attempt.count > 10)
            return res.status(429).json({ message: 'Too many applications started. Please try again later.' });
        const { rows } = await pool.query('SELECT company_id FROM hiring_application_links WHERE public_token=$1 AND is_active=true', [req.params.token]);
        if (!rows[0])
            return res.status(404).json({ message: 'Application link is unavailable' });
        const companyId = rows[0].company_id, template = await ensureTemplate(companyId), timestamp = now();
        const pkg = await storage.createHPPackage({ companyId, templateId: template.id, applicationKind: 'application', employeeName: `${firstName} ${lastName}`, employeeEmail: email, position: String(req.body.position || '').trim().slice(0, 100), publicToken: randomBytes(24).toString('base64url'), status: 'draft', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), createdAt: timestamp, updatedAt: timestamp });
        await storage.createHPSubmission({ companyId, packageId: pkg.id, publicToken: pkg.publicToken, status: 'started', currentStep: 1, personalInfoJson: { firstName, lastName, email }, createdAt: timestamp, updatedAt: timestamp });
        res.status(201).json({ path: `/public/hiring-package/${pkg.publicToken}` });
    }
    catch {
        res.status(500).json({ message: 'Could not start your application. Please retry.' });
    } });
    app.post('/api/hiring-applications/:id/link-profile', requireRole('admin'), async (req: any, res: any) => {
        try {
            const pkg = await storage.getHPPackage(req.params.id);
            if (!pkg || pkg.companyId !== req.user.companyId)
                return res.sendStatus(404);
            const sub = await storage.getHPSubmissionByPackage(pkg.id);
            if (!sub || sub.status !== 'submitted')
                return res.status(400).json({ message: 'Review a completed application before linking its profile' });
            const info = sub.personalInfoJson || {}, profile = profileSchema.parse({ ...emptyProfile(), ...(info.profileDetails || {}), notes: "", hireDate: "", dateOfBirth: info.dateOfBirth || info.profileDetails?.dateOfBirth || "", address: info.address || info.profileDetails?.address || '', city: info.city || info.profileDetails?.city || '', province: info.province || info.profileDetails?.province || '', postalCode: info.postalCode || info.profileDetails?.postalCode || '', emergencyContacts: sub.emergencyContactsJson || info.profileDetails?.emergencyContacts || [] });
            const targetId = pkg.employeeId || req.body.employeeId;
            let target = targetId ? await storage.getUser(targetId) : null;
            if (targetId && (!target || target.companyId !== req.user.companyId || target.role !== 'employee'))
                return res.status(404).json({ message: 'Employee not found' });
            const company = await storage.getCompany(req.user.companyId);
            const existing = await storage.getEmployeesByCompany(req.user.companyId);
            if (!target && existing.length >= getPlan(company.planCode).maxEmployees)
                return res.status(403).json({ message: 'Your plan employee limit has been reached' });
            const password = target ? null : await hashPassword(randomBytes(32).toString('hex'));
            const employee = await db.transaction(async (tx) => {
                const [locked] = await tx.select().from(employeeHiringPackages).where(and(eq(employeeHiringPackages.id, pkg.id), eq(employeeHiringPackages.companyId, req.user.companyId))).for('update');
                if (locked.employeeId && (!pkg.employeeId || sub.reviewStatus === 'approved')) {
                    const [already] = await tx.select().from(users).where(and(eq(users.id, locked.employeeId), eq(users.companyId, req.user.companyId)));
                    if (already)
                        return already;
                }
                let updated;
                if (target) {
                    const [fresh] = await tx.select().from(users).where(and(eq(users.id, target.id), eq(users.companyId, req.user.companyId))).for('update');
                    if (!fresh)
                        throw new Error('Employee no longer available');
                    const [row] = await tx.update(users).set({ ...employeeInput({firstName:info.firstName||fresh.firstName,lastName:info.lastName||fresh.lastName,phone:info.phone||undefined,position:pkg.position||undefined}), profileDetails: mergeSubmittedProfile(fresh.profileDetails, profile) }).where(and(eq(users.id, target.id), eq(users.companyId, req.user.companyId))).returning();
                    updated = row;
                }
                else {
                    await tx.select().from(companies).where(eq(companies.id, req.user.companyId)).for('update');
                    const employees = await tx.select({ id: users.id }).from(users).where(and(eq(users.companyId, req.user.companyId), eq(users.role, 'employee')));
                    if (employees.length >= getPlan(company.planCode).maxEmployees)
                        throw new Error('Employee plan limit reached');
                    const [row] = await tx.insert(users).values({ companyId: req.user.companyId, role: 'employee', firstName: String(info.firstName || pkg.employeeName.split(' ')[0]).trim(), lastName: String(info.lastName || pkg.employeeName.split(' ').slice(1).join(' ')).trim(), email: pkg.employeeEmail || null, phone: info.phone || null, position: pkg.position || null, password: password!, profileDetails: profile, isActive: false, loginEnabled: false, accountStatus: 'profile_only' }).returning();
                    updated = row;
                }
                await tx.update(employeeHiringPackages).set({ employeeId: updated.id, updatedAt: now() }).where(eq(employeeHiringPackages.id, pkg.id));
                return updated;
            });
            await storage.updateHPSubmission(sub.id, { reviewStatus: 'approved', updatedAt: now() });
            res.json(safePerson(employee));
        }
        catch (error: any) {
            res.status(error.code === '23505' ? 409 : 400).json({ message: error.code === '23505' ? 'This email already belongs to an account. Select the existing employee profile instead.' : 'The profile could not be linked. Check the submitted information.' });
        }
    });
    app.get('/api/employees/:id/hiring-documents', requireRole('admin'), async (req: any, res: any) => { try {
        const employee = await storage.getUser(req.params.id);
        if (!employee || employee.role !== 'employee' || employee.companyId !== req.user.companyId)
            return res.sendStatus(404);
        const { rows } = await pool.query(`SELECT d.id,d.original_name,d.document_type,d.mime_type,d.file_size,d.uploaded_at FROM employee_hiring_documents d JOIN employee_hiring_submissions s ON s.id=d.submission_id JOIN employee_hiring_packages p ON p.id=s.package_id WHERE p.company_id=$1 AND d.company_id=$1 AND (p.employee_id=$2 OR (p.employee_id IS NULL AND lower(p.employee_email)=lower($3) AND $3<>'')) ORDER BY d.uploaded_at DESC`, [req.user.companyId, employee.id, employee.email || '']);
        res.json(rows);
    }
    catch {
        res.status(500).json({ message: 'Hiring documents could not be loaded' });
    } });
    app.get('/api/hiring-package/documents/:id', requireRole('admin'), async (req: any, res: any) => { try {
        const { rows } = await pool.query('SELECT d.* FROM employee_hiring_documents d JOIN employee_hiring_submissions s ON s.id=d.submission_id WHERE d.id=$1 AND d.company_id=$2 AND s.company_id=$2', [req.params.id, req.user.companyId]);
        if (!rows[0])
            return res.sendStatus(404);
        res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).json(rows[0]);
    }
    catch {
        res.status(500).json({ message: 'Document could not be loaded' });
    } });
}
