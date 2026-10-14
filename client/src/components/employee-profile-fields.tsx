import { emptyProfile, type EmployeeProfile } from '@shared/people';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
export function EmployeeProfileFields({ value, onChange, readOnly = false, application = false, experienceOnly = false }: {
    value: any;
    onChange?: (value: any) => void;
    readOnly?: boolean;
    application?: boolean;
    experienceOnly?: boolean;
}) {
    const profile: EmployeeProfile = { ...emptyProfile(), ...value };
    const update = (key: string, next: any) => onChange?.({ ...profile, [key]: next });
    const field = (key: string, label: string, type = 'text') => <div key={key} className="space-y-1.5"><Label htmlFor={`profile-${key}`}>{label}</Label>{readOnly ? <p className="text-sm whitespace-pre-wrap break-words">{(profile as any)[key] || '—'}</p> : <Input id={`profile-${key}`} type={type} value={(profile as any)[key] || ''} onChange={e => update(key, e.target.value)}/>}</div>;
    const collection = (key: 'employmentHistory' | 'references' | 'emergencyContacts', title: string, fields: [
        string,
        string
    ][], blank: any) => { const rows = profile[key] || []; return <section className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-sm">{title}</h3>{!readOnly && <Button type="button" size="sm" variant="outline" onClick={() => update(key, [...rows, blank])} disabled={rows.length >= (key === 'emergencyContacts' ? 5 : key === 'employmentHistory' ? 15 : 10)}>Add</Button>}</div>{!rows.length && <p className="text-sm text-muted-foreground">None recorded</p>}{rows.map((row: any, index: number) => <div key={index} className="rounded-lg border p-3 space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{fields.map(([name, label]) => <div key={name} className="space-y-1.5"><Label htmlFor={`${key}-${index}-${name}`}>{label}</Label>{readOnly ? <p className="text-sm break-words whitespace-pre-wrap">{row[name] || '—'}</p> : <Input id={`${key}-${index}-${name}`} type={name.endsWith('Date') ? 'date' : 'text'} value={row[name] || ''} onChange={e => update(key, rows.map((r: any, i: number) => i === index ? { ...r, [name]: e.target.value } : r))}/>}</div>)}</div>{!readOnly && <Button type="button" variant="ghost" size="sm" onClick={() => update(key, rows.filter((_: any, i: number) => i !== index))}>Remove this entry</Button>}</div>)}</section>; };
    return <div className="space-y-6">{!experienceOnly && <section className="space-y-3"><h3 className="font-semibold text-sm">Address & employment</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{field('address', 'Street address')}{field('city', 'City')}{field('province', 'Province / state')}{field('postalCode', 'Postal / ZIP code')}{field('country', 'Country')}{!application && field('dateOfBirth', 'Date of birth (optional)', 'date')}{!application && field('hireDate', 'Hire date', 'date')}{field('employmentType', 'Employment type')}</div></section>}
 {collection('employmentHistory', 'Employment history', [['company', 'Previous employer'], ['position', 'Job title'], ['startDate', 'Start date'], ['endDate', 'End date'], ['referenceName', 'Supervisor / reference'], ['referencePhone', 'Reference phone'], ['description', 'Duties / experience']], { company: '', position: '', startDate: '', endDate: '', referenceName: '', referencePhone: '', description: '' })}
 {collection('references', 'References', [['name', 'Full name'], ['company', 'Company'], ['relationship', 'Relationship'], ['phone', 'Phone'], ['email', 'Email']], { name: '', company: '', relationship: '', phone: '', email: '' })}
 {!experienceOnly && collection('emergencyContacts', 'Emergency contacts', [['name', 'Contact name'], ['relationship', 'Relationship'], ['phone', 'Phone'], ['email', 'Email']], { name: '', relationship: '', phone: '', email: '' })}
 <section className="space-y-3"><h3 className="font-semibold text-sm">Skills & availability</h3>{[['skills', 'Skills / experience'], ['qualifications', 'Qualifications / certifications'], ['availability', 'Days and times available'], ...(!application ? [['notes', 'Internal profile notes']] : [])].map(([key, label]) => <div key={key} className="space-y-1.5"><Label htmlFor={`profile-${key}`}>{label}</Label>{readOnly ? <p className="text-sm whitespace-pre-wrap">{(profile as any)[key] || '—'}</p> : <Textarea id={`profile-${key}`} value={(profile as any)[key] || ''} onChange={e => update(key, e.target.value)} rows={2}/>}</div>)}</section></div>;
}
