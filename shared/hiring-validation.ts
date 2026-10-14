import { z } from 'zod';
export function hiringSubmissionError(pkg: any, sub: any, template: any, documents: any[], acceptances: any[]) {
    const info = sub?.personalInfoJson || {};
    if (!String(info.firstName || '').trim() || !String(info.lastName || '').trim())
        return 'Full name is required';
    if (pkg.applicationKind === 'application' && !/^\S+@\S+\.\S+$/.test(String(info.email || pkg.employeeEmail || '')))
        return 'A valid email address is required';
    if (pkg.applicationKind !== 'application') {
        const required = ['sin_card', 'void_cheque', 'government_id'];
        if (required.some(type => !documents.some(d => d.documentType === type)))
            return 'Upload all required onboarding documents';
    }
    const policies = Array.isArray(template?.policies) ? template.policies : [];
    if (policies.some((p: any) => !acceptances.some(a => a.policyId === p.id && a.policyContentSnapshot === p.content)))
        return 'Read and accept each required policy';
    if (sub.finalAcknowledgement !== true || typeof sub.signatureData !== 'string' || !sub.signatureData.startsWith('data:image/png;base64,') || !validDocument(Buffer.from(sub.signatureData.split(',')[1] || '', 'base64'), 'image/png'))
        return 'Your acknowledgement and signature are required';
    return null;
}
export function validDocument(buffer: Buffer, mime: string) { if (!buffer.length)
    return false; if (mime === 'application/pdf')
    return buffer.subarray(0, 5).toString() === '%PDF-'; if (mime === 'image/jpeg')
    return buffer.subarray(0, 3).toString('hex') === 'ffd8ff'; if (mime === 'image/png')
    return buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'; if (mime === 'image/webp')
    return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'; if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return buffer.subarray(0, 2).toString() === 'PK'; if (mime === 'text/plain')
    return !buffer.includes(0); return false; }
const value = z.string().trim().max(2000).default('');
export const personalInfoSchema = z.object({ firstName: value, lastName: value, dateOfBirth: value, sinNumber: value, email: value, phone: value, address: value, city: value, province: value, postalCode: value });
export const medicalInfoSchema = z.object({ allergies: value, medications: value, conditions: value, otherNotes: value });
export const policySchema = z.array(z.object({ id: z.string().min(1).max(100), title: z.string().min(1).max(250), content: z.string().max(100000) })).max(30).refine(p => new Set(p.map(v => v.id)).size === p.length);
