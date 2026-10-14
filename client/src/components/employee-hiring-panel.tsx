import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { EmployeeProfileFields } from './employee-profile-fields';
import { useToast } from '@/hooks/use-toast';
export function EmployeeHiringPanel({ employee, onUpdated }: {
    employee?: any;
    onUpdated?: (e: any) => void;
}) {
    const { toast } = useToast();
    const [detail, setDetail] = useState<string | null>(null), [link, setLink] = useState(''), [existing, setExisting] = useState('');
    const endpoint = employee ? `/api/employees/${employee.id}/hiring` : '/api/hiring-applications';
    const { data: packages = [], isLoading, error } = useQuery<any[]>({ queryKey: [endpoint] });
    const { data: details, isLoading: detailLoading } = useQuery<any>({ queryKey: ['/api/hiring-package/packages', detail, 'detail'], enabled: !!detail });
    const { data: employees = [] } = useQuery<any[]>({ queryKey: ['/api/employees'], enabled: !employee && !!detail });
    const copy = async (value: string) => { try {
        await navigator.clipboard.writeText(value);
        toast({ title: 'Link copied' });
    }
    catch {
        setLink(value);
        toast({ title: 'Copy this link from the field below' });
    } };
    const create = useMutation({ mutationFn: async () => { const res = await apiRequest('POST', employee ? `/api/employees/${employee.id}/hiring` : '/api/hiring-applications/link', {}); return res.json(); }, onSuccess: data => { setLink(data.publicLink || data.url); queryClient.invalidateQueries({ queryKey: [endpoint] }); copy(data.publicLink || data.url); }, onError: (e: any) => toast({ title: 'Link could not be created', description: e.message, variant: 'destructive' }) });
    const importProfile = useMutation({ mutationFn: async () => { const res = await apiRequest('POST', `/api/hiring-applications/${detail}/link-profile`, { employeeId: existing || employee?.id }); return res.json(); }, onSuccess: e => { queryClient.invalidateQueries({ queryKey: ['/api/employees'] }); queryClient.invalidateQueries({ queryKey: [endpoint] }); queryClient.invalidateQueries({ queryKey: [`/api/employees/${e.id}/profile`] }); onUpdated?.(e); toast({ title: 'Employee profile linked', description: 'Login access is enabled separately after your review.' }); setDetail(null); }, onError: (e: any) => toast({ title: 'Profile could not be linked', description: e.message, variant: 'destructive' }) });
    const send = useMutation({ mutationFn: async (id: string) => apiRequest('POST', `/api/hiring-package/packages/${id}/send`, {}), onSuccess: () => toast({ title: 'Profile completion email sent' }), onError: (e: any) => toast({ title: 'Email could not be sent', description: e.message, variant: 'destructive' }) });
    const requestChanges = useMutation({ mutationFn: async () => apiRequest('PATCH', `/api/hiring-package/submissions/${details.submission.id}`, { reviewStatus: 'changes_requested', missingDocsMessage: 'Please review and complete the missing information or documents.', requestedMissingDocs: [] }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/hiring-package/packages', detail, 'detail'] }); toast({ title: 'Application reopened for corrections', description: 'Copy the completion link or send it to the applicant.' }); }, onError: (e: any) => toast({ title: 'Could not reopen the application', description: e.message, variant: 'destructive' }) });
    const download = async (doc: any, view = false) => { try {
        const d = await (await apiRequest('GET', `/api/hiring-package/documents/${doc.id}`)).json();
        const raw = atob(d.file_data), bytes = Uint8Array.from(raw, c => c.charCodeAt(0)), url = URL.createObjectURL(new Blob([bytes], { type: d.mime_type || 'application/octet-stream' }));
        const a = document.createElement('a');
        a.href = url;
        if (view && ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'].includes(d.mime_type)) {
            a.target = '_blank';
            a.rel = 'noopener';
        }
        else
            a.download = d.original_name || 'document';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    catch (e: any) {
        toast({ title: 'Document could not be opened', description: e.message, variant: 'destructive' });
    } };
    const personal = details?.submission?.personalInfoJson || {};
    return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{employee ? 'Hiring & profile completion' : 'Applications & onboarding'}</h3><p className="text-sm text-muted-foreground">{employee ? 'Collect details and documents on their phone, then review them here.' : 'Create a branded application link. Submitted profiles stay pending until reviewed.'}</p></div><Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? 'Creating…' : employee ? 'Create completion link' : 'Copy application link'}</Button></div>{link && <div className="flex gap-2"><input aria-label="Application link" className="min-w-0 flex-1 border rounded-md px-3 py-2 text-sm" readOnly value={link}/><Button variant="outline" type="button" onClick={() => copy(link)}>Copy</Button></div>}{error ? <p role="alert" className="text-sm text-destructive">Applications could not be loaded. Please retry.</p> : isLoading ? <p>Loading applications…</p> : !packages.length ? <p className="text-sm text-muted-foreground">No applications or completion packages yet.</p> : <div className="divide-y rounded-lg border">{packages.map(p => <div key={p.id} className="flex flex-wrap gap-3 justify-between p-3 items-center"><div><p className="text-sm font-medium">{p.employee_name || p.employeeName || employee?.firstName}</p><p className="text-xs text-muted-foreground">{p.employee_email || p.employeeEmail || 'Link only'} · {p.submission_status || p.status} {p.document_count !== undefined ? `· ${p.document_count} documents` : ''}</p></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setDetail(p.id)}>Review</Button>{p.publicLink && <><Button type="button" size="sm" variant="ghost" onClick={() => copy(p.publicLink)}>Copy link</Button><Button type="button" size="sm" variant="ghost" disabled={!p.employee_email || send.isPending} onClick={() => send.mutate(p.id)}>Send email</Button></>}</div></div>)}</div>}
 <Dialog open={!!detail} onOpenChange={v => { if (!v)
        setDetail(null); }}><DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Application details</DialogTitle></DialogHeader>{detailLoading ? <p>Loading…</p> : details ? <div className="space-y-5"><div><h3 className="font-semibold">{details.package.employeeName}</h3><p className="text-sm">{details.package.employeeEmail} · {details.package.position}</p><Badge variant="secondary">{details.submission?.status || 'Not started'}</Badge><div className="flex gap-2 mt-3"><Button type="button" variant="outline" size="sm" onClick={() => copy(`${location.origin}/public/hiring-package/${details.package.publicToken}`)}>Copy completion link</Button><Button type="button" variant="outline" size="sm" disabled={!details.package.employeeEmail || send.isPending} onClick={() => send.mutate(details.package.id)}>Send email</Button></div></div>{details.submission ? <><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Object.entries(personal).filter(([key, value]) => key !== 'profileDetails' && typeof value !== 'object').map(([key, value]) => <div key={key}><p className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</p><p className="text-sm break-words">{String(value || '—')}</p></div>)}</div><EmployeeProfileFields value={{ ...personal.profileDetails, address: personal.address || personal.profileDetails?.address, city: personal.city || personal.profileDetails?.city, province: personal.province || personal.profileDetails?.province, postalCode: personal.postalCode || personal.profileDetails?.postalCode, emergencyContacts: details.submission.emergencyContactsJson || personal.profileDetails?.emergencyContacts }} readOnly/>
 {Object.values(details.submission.medicalInfoJson || {}).some(Boolean) && <section><h3 className="font-semibold mb-2">Submitted medical information</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Object.entries(details.submission.medicalInfoJson).map(([key, value]) => <div key={key}><p className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</p><p className="text-sm whitespace-pre-wrap">{String(value || "—")}</p></div>)}</div></section>}<details className="border rounded-lg p-3"><summary className="font-medium text-sm cursor-pointer">Acknowledgements & signature</summary><div className="pt-3 space-y-2">{details.policyAcceptances?.map((p: any) => <p key={p.id} className="text-sm">{p.policyTitle} · {new Date(p.acceptedAt).toLocaleDateString()}</p>)}{details.submission.signatureData && <img src={details.submission.signatureData} alt="Submitted employee signature" className="max-w-full max-h-32 object-contain border rounded"/>}</div></details><section><h3 className="font-semibold mb-2">Submitted documents ({details.documents?.length || 0})</h3>{details.documents?.map((d: any) => <div key={d.id} className="flex justify-between items-center gap-2 border-b py-2"><p className="text-sm break-words">{d.originalName} · {d.documentType}</p><div className="flex gap-2 shrink-0"><Button type="button" variant="ghost" size="sm" onClick={() => download(d, true)}>View</Button><Button type="button" variant="outline" size="sm" onClick={() => download(d)}>Download</Button></div></div>)}</section><p className="text-sm text-muted-foreground">Policies accepted: {details.policyAcceptances?.length || 0} · Submitted: {details.submission.submittedAt ? new Date(details.submission.submittedAt).toLocaleDateString() : 'Not yet'}</p>
 {details.submission.status === 'submitted' && <div className="border-t pt-4 space-y-3">{!employee && !details.package.employeeId && <select className="w-full border rounded-md p-2" aria-label="Employee profile to link" value={existing} onChange={e => setExisting(e.target.value)}><option value="">Create a new employee profile</option>{employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} · {e.employeeId || 'Profile only'}</option>)}</select>}<div className="flex flex-wrap gap-2"><Button type="button" disabled={importProfile.isPending} onClick={() => importProfile.mutate()}>{employee || existing || details.package.employeeId ? 'Update employee profile from submission' : 'Create employee profile from submission'}</Button><Button type="button" variant="outline" disabled={requestChanges.isPending} onClick={() => requestChanges.mutate()}>Request corrections</Button></div></div>}</> : <p>The applicant has not started filling out this package.</p>}</div> : <p role="alert">Application details are unavailable.</p>}</DialogContent></Dialog></section>;
}
export function EmployeeCollectedDocuments({ employeeId }: {
    employeeId: string;
}) { const { toast } = useToast(); const { data = [], isLoading, error } = useQuery<any[]>({ queryKey: [`/api/employees/${employeeId}/hiring-documents`] }); const open = async (doc: any, view = false) => { try {
    const d = await (await apiRequest('GET', `/api/hiring-package/documents/${doc.id}`)).json();
    const bytes = Uint8Array.from(atob(d.file_data), c => c.charCodeAt(0)), url = URL.createObjectURL(new Blob([bytes], { type: d.mime_type }));
    const a = document.createElement('a');
    a.href = url;
    if (view && ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'].includes(d.mime_type)) {
        a.target = '_blank';
        a.rel = 'noopener';
    }
    else
        a.download = d.original_name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
catch (e: any) {
    toast({ title: 'Document could not be opened', description: e.message, variant: 'destructive' });
} }; return <section className="border-t pt-4 space-y-3"><h3 className="text-sm font-semibold">Collected through hiring packages</h3>{isLoading ? <p className="text-sm">Loading documents…</p> : error ? <p role="alert">Hiring documents could not be loaded.</p> : !data.length ? <p className="text-sm text-muted-foreground">No hiring documents submitted yet. Use the Hiring tab to send a completion link.</p> : data.map(d => <div key={d.id} className="flex flex-wrap justify-between items-center gap-2 rounded-lg border p-3"><div className="min-w-0"><p className="text-sm break-words">{d.original_name}</p><p className="text-xs text-muted-foreground">{d.document_type.replaceAll('_', ' ')} · {new Date(d.uploaded_at).toLocaleDateString()}</p></div><div className="flex gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => open(d, true)}>View</Button><Button type="button" size="sm" variant="outline" onClick={() => open(d)}>Download</Button></div></div>)}</section>; }
