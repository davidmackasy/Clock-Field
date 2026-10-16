import { z } from 'zod';
const text = z.string().trim().max(2000).default('');
const date = z.string().refine(v => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v), 'Use YYYY-MM-DD').default('');
export const profileSchema = z.object({ address: text, city: text, province: text, postalCode: text, country: z.string().max(80).default('Canada'), dateOfBirth: date, hireDate: date, employmentType: text, availability: text, availabilitySlots:z.array(z.object({day:z.enum(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)})).max(21).default([]), skills: text, qualifications: text, notes: text, emergencyContacts: z.array(z.object({ name: text, relationship: text, phone: text, email: text })).max(5).default([]), employmentHistory: z.array(z.object({ company: text, position: text, startDate: date, endDate: date, referenceName: text, referencePhone: text, description: text })).max(15).default([]), references: z.array(z.object({ name: text, company: text, relationship: text, phone: text, email: text })).max(10).default([]) });
export type EmployeeProfile = z.infer<typeof profileSchema>;
export const emptyProfile = () => profileSchema.parse({});
export function employeeInput(body: any, create = false) {
    const result: any = {};
    for (const k of ['firstName', 'lastName', 'email', 'phone', 'position'])
        if (body[k] !== undefined) {
            if (typeof body[k] !== 'string' || body[k].length > 250)
                throw new Error(`Enter a valid ${k}`);
            result[k] = body[k].trim();
        }
    if (create || body.firstName !== undefined)
        if (!result.firstName)
            throw new Error('First name is required');
    if (create || body.lastName !== undefined)
        if (!result.lastName)
            throw new Error('Last name is required');
    if (result.email) {
        if (!z.string().email().safeParse(result.email).success)
            throw new Error('Enter a valid email address');
        result.email = result.email.toLowerCase();
    }
    else if (result.email === '')
        result.email = null;
    for (const k of ['hourlyRate', 'overtimeRate'])
        if (body[k] !== undefined) {
            const v = body[k];
            if (v === '' || v === null) {
                result[k] = null;
                continue;
            }
            const n = Number(v);
            if (!['string', 'number'].includes(typeof v) || !Number.isFinite(n) || n < 0 || n > 10000)
                throw new Error('Pay rates must be between 0 and 10,000');
            result[k] = n.toFixed(2);
        }
    if (typeof body.isActive === 'boolean' && !create)
        result.isActive = body.isActive;
    if (body.profileDetails !== undefined) {
        const parsed = profileSchema.safeParse(body.profileDetails);
        if (!parsed.success)
            throw new Error('Check the employee profile fields and dates');
        result.profileDetails = parsed.data;
    }
    return result;
}
export function safePerson(user: any, directory = false) { const { password, tempPin, inviteToken, inviteExpiresAt, avatarFilePath, avatarMimeType, profileDetails, ...safe } = user; return directory ? safe : { ...safe, profileDetails }; }
export const ACCESS_MODULES = [['dashboard', 'Dashboard'], ['employees', 'Employee profiles & hiring'], ['schedule', 'Schedules'], ['attendance', 'Attendance & fit for duty'], ['payroll', 'Payroll'], ['clients', 'Clients & work sites'], ['contractors', 'Contractors'], ['work-log', 'Work log & supplies'], ['forms', 'Forms & quote requests'], ['training', 'Training Hub'], ['documents', 'Documents & agreements'], ['messages', 'Messages'], ['settings', 'Company settings'], ['billing', 'Subscription & billing'], ['team', 'Manage staff access']] as const;
export function hasAccess(user: any, module: string) { return user?.role === 'admin' && (user.isSuperAdmin || user.adminPermissions == null || user.adminPermissions.includes(module)); }
export function validPermissions(value: any) { if (!Array.isArray(value) || value.some(x => !ACCESS_MODULES.some(([id]) => id === x)))
    throw new Error('Select valid access areas'); return Array.from(new Set(value)) as string[]; }
export function pathModule(path: string) {
    path = path.replace(/^\/api\/admin\//, '/api/');
    if (/^\/api\/attendance\/(timesheets|timesheet\.csv|payroll)/.test(path))
        return 'payroll';
    if (/^\/api\/(auth(?:\/|$)|settings\/timezone$|plan(?:\/|$)|plans(?:\/|$))/.test(path))
        return 'common';
    if (/^\/api\/super-admin/.test(path))
        return 'owner';
    if (/^\/api\/contractors/.test(path)) return 'contractors';
    if (/^\/api\/(admins|management)/.test(path))
        return 'team';
    if (/^\/api\/(employees|hiring-package|hiring-applications)/.test(path))
        return 'employees';
    if (/^\/api\/(shifts|recurring-schedules|schedule)/.test(path))
        return 'schedule';
    if (/^\/api\/(payroll|pay-runs|pay-stubs|timesheets|generated-timesheets|admin\/attendance\/(timesheets|payroll))/.test(path))
        return 'payroll';
    if (/^\/api\/(time-entries|attendance|fit-for-duty|admin\/fit-for-duty)/.test(path))
        return 'attendance';
    if (/^\/api\/(clients|locations|client-requests)/.test(path))
        return 'clients';
    if (/^\/api\/(training|admin\/training)/.test(path))
        return 'training';
    if (/^\/api\/(admin\/messages|admin\/platform-messages|messages|platform-messages)/.test(path))
        return 'messages';
    if (/^\/api\/(quote-forms|booking-|jobs|form-)/.test(path))
        return 'forms';
    if (/^\/api\/(publications|proposals|agreements|hiring)/.test(path))
        return 'documents';
    if (/^\/api\/(work-submissions|field-notes|scheduled-field-notes|supplies|inventory|location-supply|reports|incidents|incident-|admin\/incidents|cleaner-requests|priority-alerts)/.test(path))
        return 'work-log';
    if (/^\/api\/(billing|stripe|subscription)/.test(path))
        return 'billing';
    if (/^\/api\/upload\/logo/.test(path))
        return 'settings';
    if (/^\/api\/(attachments|upload|work-submission-photos|priority-alert-photos)/.test(path))
        return 'work-log';
    if (/^\/api\/jobsite-walks/.test(path))
        return 'forms';
    if (/^\/api\/(company|settings)/.test(path))
        return 'settings';
    if (/^\/api\/(dashboard|admin\/dashboard|stats)/.test(path))
        return 'dashboard';
    return 'owner';
}
export function permissionAllowed(user: any, path: string, method = 'GET') {
    if (user?.role !== 'admin' || user.adminPermissions == null || user.isSuperAdmin)
        return true;
    const module = pathModule(path);
    if (module === 'common')
        return true;
    if (method === 'GET' && path === '/api/company')
        return true;
    if (method === 'GET' && ['/api/employees', '/api/clients', '/api/shifts', '/api/recurring-schedules'].includes(path))
        return ['employees', 'schedule', 'attendance', 'payroll', 'work-log', 'training', 'clients'].some(p => hasAccess(user, p));
    if (method === 'GET' && /^\/api\/(employees|clients)\/[^/]+\/avatar$/.test(path))
        return ['employees', 'schedule', 'attendance', 'payroll', 'work-log', 'training', 'clients'].some(p => hasAccess(user, p));
    if (method === 'GET' && path === '/api/locations')
        return ['clients', 'schedule', 'employees', 'work-log', 'attendance', 'payroll'].some(p => hasAccess(user, p));
    return hasAccess(user, module);
}
export function pageModule(path: string) { if (path === '/admin')
    return 'dashboard'; const part = path.split('/')[2]; return ({ contractors:'contractors', employees: 'employees', management: 'team', admins: 'team', schedule: 'schedule', attendance: path.includes('timesheet') ? 'payroll' : 'attendance', 'fit-for-duty': 'attendance', payroll: 'payroll', timesheets: 'payroll', clients: 'clients', 'work-log': 'work-log', reports: 'work-log', 'field-notes': 'work-log', supplies: 'work-log', incidents: 'work-log', 'quote-forms': 'forms', publications: 'documents', proposals: 'documents', agreements: 'documents', training: 'training', messages: 'messages', 'platform-messages': 'messages', settings: 'settings', subscription: 'billing' } as any)[part] || 'dashboard'; }
export function clientInput(body: any, create = false) { const data: any = {}; for (const key of ['name', 'contactName', 'contactEmail', 'contactPhone'])
    if (body[key] !== undefined) {
        if (typeof body[key] !== 'string' || body[key].length > 250)
            throw new Error('Enter valid client contact details');
        data[key] = body[key].trim();
    } if ((create || body.name !== undefined) && !data.name)
    throw new Error('Client name is required'); if (data.contactEmail) {
    if (!z.string().email().safeParse(data.contactEmail).success)
        throw new Error('Enter a valid contact email');
    data.contactEmail = data.contactEmail.toLowerCase();
} if (typeof body.isActive === 'boolean')
    data.isActive = body.isActive; return data; }
export function canManageStaff(actor: any, target: any) { if (actor.isSuperAdmin)
    return true; if (target.isSuperAdmin)
    return false; if (actor.adminPermissions == null)
    return true; return target.adminPermissions != null && target.adminPermissions.every((p: string) => actor.adminPermissions.includes(p)); }
export function mergeSubmittedProfile(existing: any, incoming: any) { const result: any = { ...emptyProfile(), ...existing }; for (const [key, value] of Object.entries(incoming || {}))
    if (Array.isArray(value) ? value.length : typeof value === 'string' ? value.trim() : value != null)
        result[key] = value; return profileSchema.parse(result); }
export function firstAccessiblePage(user: any) { const pages: any = { contractors:'/admin/contractors', dashboard: '/admin', employees: '/admin/employees', schedule: '/admin/schedule', attendance: '/admin/attendance', payroll: '/admin/payroll', clients: '/admin/clients', 'work-log': '/admin/work-log', forms: '/admin/quote-forms', training: '/admin/training', documents: '/admin/publications', messages: '/admin/messages', settings: '/admin/settings', billing: '/admin/subscription', team: '/admin/management' }; return ACCESS_MODULES.find(([id]) => hasAccess(user, id))?.[0] ? pages[ACCESS_MODULES.find(([id]) => hasAccess(user, id))![0]] : null; }
