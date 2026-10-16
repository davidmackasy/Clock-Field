import { z } from 'zod';
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s, 'Enter a valid date');
const text = z.string().trim().max(10000);
export const businessInput = z.object({ name: text.min(1).max(200), contact_name: text.max(200).default(''), email: z.string().email(), phone: text.max(100).default(''), agreement_start: date.nullable().optional(), agreement_end: date.nullable().optional(), required_documents: z.array(z.string().min(1).max(120)).max(25).default([]), approval_status: z.enum(['pending', 'approved', 'rejected']).default('pending') }).refine(v => !v.agreement_start || !v.agreement_end || v.agreement_end >= v.agreement_start, 'Agreement end must follow start');
export const assignmentInput = z.object({ business_id: z.string().min(1), location_id: z.string().min(1), starts_on: date, ends_on: date, timezone: z.string().refine(v => {
        try {
            new Intl.DateTimeFormat('en', { timeZone: v });
            return true;
        }
        catch {
            return false;
        }
    }, 'Choose an IANA timezone'), weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7), start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), scope: text.min(1), frequency: z.enum(['weekly', 'fortnightly']).default('weekly'), checklist: z.array(z.object({ id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/).refine(v => !['__proto__', 'constructor', 'prototype'].includes(v), 'Choose a safe task ID'), label: text.min(1).max(500), required: z.boolean().default(true), photo_required: z.boolean().default(false) })).max(100), supplies: text.default(''), equipment: text.default(''), admin_contact: text.default('') }).refine(v => v.ends_on >= v.starts_on && Date.parse(v.ends_on) - Date.parse(v.starts_on) <= 366 * 86400000, 'Select an assignment period of at most one year').refine(v => new Set(v.checklist.map(c => c.id)).size === v.checklist.length, 'Checklist IDs must be unique');
export const issueInput = z.object({ assignment_id: z.string(), visit_id: z.string().nullable().optional(), category: z.enum(['blocked_access', 'missing_supplies', 'damage', 'unsafe_conditions', 'client_request', 'quality_concern', 'complaint', 'other']), severity: z.enum(['low', 'medium', 'high', 'urgent']), description: text.min(1), owner_id: z.string().nullable().optional(), response_target: z.string().datetime(), resolution_target: z.string().datetime() }).refine(v => v.resolution_target >= v.response_target, 'Resolution target must follow response target');
export const submissionInput = z.object({ version: z.number().int().positive(), request_key: z.string().min(8).max(100), notes: text.default(''), checklist: z.record(z.boolean()), file_ids: z.array(z.string()).max(30).default([]), task_files: z.record(z.array(z.string()).max(10)).default({}) });
export function serviceDates(a: {
    starts_on: string;
    ends_on: string;
    weekdays: number[];
    frequency: string;
}, from: string, to: string) {
    const result: string[] = [];
    let d = new Date(Math.max(Date.parse(a.starts_on), Date.parse(from)));
    const end = Math.min(Date.parse(a.ends_on), Date.parse(to));
    for (; d.getTime() <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const days = Math.floor((d.getTime() - Date.parse(a.starts_on)) / 86400000);
        if (a.weekdays.includes(d.getUTCDay()) && (a.frequency !== 'fortnightly' || Math.floor(days / 7) % 2 === 0))
            result.push(d.toISOString().slice(0, 10));
    }
    return result;
}
export function localDate(now: Date, tz: string) { const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now); const get = (t: string) => p.find(x => x.type === t)!.value; return `${get('year')}-${get('month')}-${get('day')}`; }
export const transitions: Record<string, Record<string, string[]>> = { contractor: { scheduled: ['blocked'], blocked: ['scheduled'], missed: [], submitted: [], approved: [], cancelled: [], correction_required: [] }, admin: { scheduled: ['blocked', 'missed', 'cancelled'], blocked: ['scheduled', 'missed', 'cancelled'], missed: ['scheduled', 'cancelled'], submitted: [], approved: [], cancelled: ['scheduled'], correction_required: ['cancelled'] } };
export function canTransition(role: string, from: string, to: string) { return !!transitions[role]?.[from]?.includes(to); }
export function isActiveMembership(m: any, now = new Date()) { return !!m && m.status === 'active' && m.business_status === 'active' && new Date(m.starts_at) <= now && (!m.ends_at || new Date(m.ends_at) > now); }
export function assignmentActive(a: any, now = new Date()) { const today = localDate(now, a.timezone); const time = new Intl.DateTimeFormat('en-GB', { timeZone: a.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now); const next = new Date(Date.parse(a.ends_on) + 86400000).toISOString().slice(0, 10); return a.state === 'accepted' && today >= a.starts_on && (today <= a.ends_on || (a.end_time < a.start_time && today === next && time <= a.end_time)); }
export function serviceDayOver(v: any, now = new Date()) {
    const today = localDate(now, v.timezone);
    if (v.service_date >= today)
        return false;
    const next = new Date(Date.parse(v.service_date) + 86400000).toISOString().slice(0, 10);
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: v.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    return !(v.end_time < v.start_time && today === next && time <= v.end_time);
}
