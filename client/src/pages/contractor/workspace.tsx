import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Building2, MapPin, ClipboardCheck, AlertTriangle, BarChart3, Bell, RefreshCw, Plus, Clock, LogOut, ShieldCheck } from 'lucide-react';
import { localDate, canTransition } from '@shared/contractor';
type Row = Record<string, any>;
const status = (v: string) => v.replace(/_/g, ' ');
const native = 'w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm';
function Field({ label, children }: any) { return <label className="flex flex-col gap-1.5 text-sm font-medium min-w-0">{label}{children}</label>; }
function Empty({ children }: any) { return <p className="border border-dashed rounded-xl py-12 px-5 text-center text-muted-foreground">{children}</p>; }
function Time({ value }: any) { return <span>{value ? new Date(value).toLocaleString() : 'Not set'}</span>; }
export default function ContractorWorkspace() {
    const { user, logout } = useAuth(), qc = useQueryClient(), { toast } = useToast();
    const q = useQuery<any>({ queryKey: ['/api/contractors/state'], refetchInterval: 15000, refetchOnWindowFocus: true });
    const [tab, setTab] = useState('overview'), [search, setSearch] = useState(''), [selected, setSelected] = useState<Row | null>(null), [modal, setModal] = useState<Row | null>(null), [draft, setDraft] = useState<Row>({}), [busy, setBusy] = useState(false), [error, setError] = useState(''), [invite, setInvite] = useState(''), [access, setAccess] = useState('');
    const [period, setPeriod] = useState('week'), [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return localDate(d, 'UTC'); }), [to, setTo] = useState(() => localDate(new Date(), 'UTC')), [businessFilter, setBusinessFilter] = useState(''), [locationFilter, setLocationFilter] = useState('');
    const report = useQuery<any>({ queryKey: ['/api/contractors/reports', from, to, businessFilter, locationFilter], queryFn: async () => { const r = await apiRequest('GET', `/api/contractors/reports?from=${from}&to=${to}&business=${businessFilter}&location=${locationFilter}`); return r.json(); }, enabled: tab === 'reports', refetchInterval: 30000 });
    const s = q.data, admin = !!s?.admin, manager = admin || s?.membership?.role === 'manager';
    const fresh = () => { qc.invalidateQueries({ queryKey: ['/api/contractors/state'] }); qc.invalidateQueries({ queryKey: ['/api/contractors/reports'] }); };
    const open = (type: string, row: Row = {}, initial: Row = {}) => { setError(''); setAccess(''); setModal({ type, row }); setDraft(initial); setInvite(''); };
    const act = async (action: string, id: string, body: Row = {}, close = true) => {
        setBusy(true);
        setError('');
        try {
            const r = await apiRequest('POST', `/api/contractors/action/${action}/${id}`, body);
            const result = await r.json();
            fresh();
            if (result.url) {
                setInvite(result.url);
            }
            else if (close)
                setModal(null);
            toast({ title: result.replayed ? 'Already saved' : 'Saved' });
            return result;
        }
        catch (e: any) {
            setError(e.message);
            toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
            throw e;
        }
        finally {
            setBusy(false);
        }
    };
    const send = (action: string, id: string, body: Row = {}, close = true) => { void act(action, id, body, close).catch(() => { }); };
    const upload = async (file: File | undefined, kind: string, id: string) => {
        if (!file)
            return;
        setBusy(true);
        setError('');
        try {
            const data = new FormData();
            data.append('file', file);
            if (draft.document_type)
                data.append('document_type', draft.document_type);
            if (draft.expires_on)
                data.append('expires_on', draft.expires_on);
            const r = await fetch(`/api/contractors/files/${kind}/${id}`, { method: 'POST', credentials: 'include', body: data });
            const body = await r.json();
            if (!r.ok)
                throw Error(body.message || 'Upload failed');
            fresh();
            toast({ title: 'File uploaded' });
        }
        catch (e: any) {
            setError(e.message);
            toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
        }
        finally {
            setBusy(false);
        }
    };
    const set = (k: string, v: any) => setDraft(d => ({ ...d, [k]: v }));
    const select = (label: string, key: string, options: {
        value: string;
        label: string;
    }[], required = true) => <Field label={label}><select required={required} className={native} value={draft[key] || ''} onChange={e => {
            set(key, e.target.value);
            if (key === 'location_id')
                set('timezone', s.locations.find((l: Row) => l.id === e.target.value)?.timezone || s.company.timezone);
        }}><option value="">Select…</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>;
    const field = (label: string, key: string, type = 'text', required = false) => <Field label={label}><Input required={required} type={type} value={draft[key] ?? ''} onChange={e => set(key, e.target.value)}/></Field>;
    const area = (label: string, key: string, required = false) => <Field label={label}><Textarea required={required} value={draft[key] || ''} onChange={e => set(key, e.target.value)}/></Field>;
    const personName = (id: string) => id === user?.id ? `${user.firstName} ${user.lastName}` : s.owner_candidates?.find((u: Row) => u.id === id)?.name || id;
    const businessName = (id: string) => s.businesses.find((b: Row) => b.id === id)?.name || 'Contractor';
    const assignment = (id: string) => s.assignments.find((a: Row) => a.id === id);
    const matches = (r: Row) => JSON.stringify(r).toLowerCase().includes(search.toLowerCase());
    const choosePeriod = (value: string) => {
        setPeriod(value);
        const day = localDate(new Date(), s?.company?.timezone || 'UTC');
        const start = new Date(day + 'T00:00:00Z');
        if (value === 'month')
            start.setUTCDate(1);
        else
            start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
        setFrom(start.toISOString().slice(0, 10));
        setTo(day);
    };
    useEffect(() => { if (s?.company?.timezone)
        choosePeriod(period); }, [s?.company?.timezone]);
    const showFiles = (kind: string, id: string) => <div className="space-y-3 mt-4">{s.files.filter((f: Row) => f.kind === kind && f.entity_id === id).map((f: Row) => <div className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3" key={f.id}><div className="min-w-0"><a href={`/api/contractors/files/${f.id}`} target="_blank" rel="noreferrer" className="font-medium text-primary break-all underline">{f.name}</a><p className="text-xs text-muted-foreground">{f.document_type} · {f.approval_status}{f.expires_on ? ` · Expires ${f.expires_on}` : ''}</p></div>{admin && kind === 'business' && <select aria-label={`Approval for ${f.name}`} className={native + ' max-w-36'} value={f.approval_status} disabled={busy} onChange={e => send('document-review', f.id, { approval_status: e.target.value, version: f.version }, false)}>{['pending', 'approved', 'rejected'].map(v => <option key={v}>{v}</option>)}</select>}</div>)}{kind !== 'business' || manager ? <Field label="Upload a PDF or photo (up to 10 MB)"><Input disabled={busy} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => void upload(e.target.files?.[0], kind, id)}/></Field> : null}</div>;
    if (q.isLoading)
        return <div role="status" className="p-8">Loading contractor workspace…</div>;
    if (q.isError)
        return <div role="alert" className="p-8 space-y-3"><h1 className="text-xl font-semibold">Unable to load contractor workspace</h1><p>{(q.error as Error).message}</p><Button onClick={() => q.refetch()}>Retry</Button></div>;
    const currentVisit = selected?.kind === 'visit' ? s.visits.find((v: Row) => v.id === selected.id) : null;
    const currentIssue = selected?.kind === 'issue' ? s.issues.find((i: Row) => i.id === selected.id) : null;
    const currentBusiness = selected?.kind === 'business' ? s.businesses.find((b: Row) => b.id === selected.id) : null;
    const tabs: [
        string,
        string,
        typeof Building2
    ][] = [['overview', 'Overview', Building2], ['businesses', 'Contractors', Building2], ['assignments', 'Locations', MapPin], ['visits', 'Service visits', ClipboardCheck], ['issues', 'Issues', AlertTriangle], ['reports', 'Reports', BarChart3], ['notifications', 'Updates', Bell]];
    const today = localDate(new Date(), s.company.timezone), upcoming = s.visits.filter((v: Row) => v.service_date >= localDate(new Date(), assignment(v.assignment_id)?.timezone || s.company.timezone) && v.status === 'scheduled').sort((a: Row, b: Row) => a.service_date.localeCompare(b.service_date)), corrections = s.visits.filter((v: Row) => v.status === 'correction_required'), openIssues = s.issues.filter((i: Row) => !['closed', 'resolved'].includes(i.status));
    return <div className="min-h-screen bg-slate-50/60 text-foreground">
  <header className="bg-background border-b px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3">{s.company.company_logo_url ? <img src={s.company.company_logo_url} alt="Company logo" className="h-10 max-w-20 object-contain"/> : <div className="bg-primary text-white rounded-lg p-2"><Clock className="w-6 h-6"/></div>}<div><p className="text-xs text-muted-foreground">{s.company.name} · ClockField</p><h1 className="text-xl sm:text-2xl font-semibold">{admin ? 'Contractor management' : 'Contractor workspace'}</h1></div></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => q.refetch()}><RefreshCw className="w-4 h-4 mr-2"/>Refresh</Button>{!admin && <Button variant="outline" size="sm" onClick={() => logout()}><LogOut className="w-4 h-4 mr-2"/>Sign out</Button>}</div></header>
  <nav aria-label="Contractor navigation" className="bg-background border-b px-4 sm:px-6 flex flex-wrap gap-1">{tabs.filter(([key]) => admin || key !== 'businesses').map(([key, label, Icon]) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => { setTab(key); setSearch(''); setSelected(null); }} className={`px-3 py-3 text-sm flex items-center gap-2 border-b-2 focus-visible:outline-primary ${tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}><Icon className="h-4 w-4"/>{label}</button>)}</nav>
  <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
  {!admin && manager && <Button variant="outline" onClick={() => { setDraft({}); setSelected({ kind: 'business', id: s.membership.business_id }); }}>Business profile, documents and team</Button>}
  <p className="text-xs text-muted-foreground">Shared service records · refreshes every 15 seconds · Contractor workspace roles do not determine legal contractor status.</p>
  {tab === 'overview' && <><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Assigned locations', new Set(s.assignments.filter((a: Row) => a.state === 'accepted').map((a: Row) => a.location_id)).size], ['Upcoming services', upcoming.length], ['Corrections required', corrections.length], ['Open issues', openIssues.length]].map(([label, count]) => <div className="rounded-xl border bg-background p-5" key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="text-3xl font-semibold mt-2">{count}</p></div>)}</div><div className="grid md:grid-cols-2 gap-5"><section className="rounded-xl border bg-background p-5"><h2 className="font-semibold mb-3">Next services</h2>{upcoming.slice(0, 6).map((v: Row) => <button onClick={() => setSelected({ kind: 'visit', id: v.id })} key={v.id} className="w-full text-left py-3 border-t"><span className="font-medium">{assignment(v.assignment_id)?.location_name}</span><p className="text-sm text-muted-foreground">{v.service_date} · {assignment(v.assignment_id)?.start_time}–{assignment(v.assignment_id)?.end_time} · {assignment(v.assignment_id)?.timezone}</p></button>)}{!upcoming.length && <p className="text-muted-foreground text-sm">No upcoming services.</p>}</section><section className="rounded-xl border bg-background p-5"><h2 className="font-semibold mb-3">Needs attention</h2>{corrections.map((v: Row) => <button key={v.id} className="w-full text-left py-3 border-t" onClick={() => setSelected({ kind: 'visit', id: v.id })}><p>{assignment(v.assignment_id)?.location_name} · Correction required</p><p className="text-sm text-muted-foreground">Due <Time value={v.deadline}/></p></button>)}{s.assignments.filter((a: Row) => a.state === 'proposed').map((a: Row) => <button key={a.id} onClick={() => setSelected({ kind: 'assignment', id: a.id })} className="w-full text-left py-3 border-t">Review proposed assignment: {a.location_name}</button>)}{!corrections.length && !s.assignments.some((a: Row) => a.state === 'proposed') && <p className="text-sm text-muted-foreground">You’re up to date.</p>}</section></div></>}
  {['businesses', 'assignments', 'visits', 'issues'].includes(tab) && <div className="flex flex-wrap gap-3 items-center justify-between"><Input className="max-w-lg" aria-label="Search contractor records" placeholder="Search name, location, date or status…" value={search} onChange={e => setSearch(e.target.value)}/>{admin && tab === 'businesses' && <Button onClick={() => open('business', {}, { approval_status: 'pending' })}><Plus className="h-4 w-4 mr-2"/>Add contractor</Button>}{admin && tab === 'assignments' && <Button onClick={() => open('assignment', {}, { timezone: s.company.timezone, weekdays: [1, 2, 3, 4, 5], start_time: '17:00', end_time: '21:00', frequency: 'weekly' })}>Propose assignment</Button>}{tab === 'issues' && <Button onClick={() => open('issue')}>Report issue</Button>}</div>}
  {tab === 'businesses' && <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{s.businesses.filter(matches).map((b: Row) => <button key={b.id} onClick={() => { setDraft({}); setSelected({ kind: 'business', id: b.id }); }} className="border rounded-xl p-5 bg-background text-left space-y-3 hover:border-primary"><div className="flex justify-between gap-3"><h2 className="font-semibold break-words">{b.name}</h2><Badge variant="outline">{b.status}</Badge></div><p className="text-sm text-muted-foreground">{b.contact_name} · {b.email}</p><p className="text-xs">Approval: {b.approval_status} · Agreement: {b.agreement_start || 'Not set'} – {b.agreement_end || 'Not set'}</p></button>)}{!s.businesses.filter(matches).length && <Empty>No contractors yet. Add a business to prepare its access and assignments.</Empty>}</div>}
  {tab === 'assignments' && <div className="grid md:grid-cols-2 gap-3">{s.assignments.filter(matches).map((a: Row) => <button key={a.id} onClick={() => { setAccess(''); setSelected({ kind: 'assignment', id: a.id }); }} className="border rounded-xl p-5 bg-background text-left space-y-2 hover:border-primary"><div className="flex gap-3 justify-between"><h2 className="font-semibold">{a.location_name}</h2><Badge variant="outline">{a.state}</Badge></div><p className="text-sm">{businessName(a.business_id)}</p><p className="text-sm text-muted-foreground">{a.starts_on} – {a.ends_on} · {a.start_time}–{a.end_time} · {a.timezone}</p><p className="text-sm line-clamp-2">{a.scope}</p></button>)}{!s.assignments.filter(matches).length && <Empty>No assigned locations match this view.</Empty>}</div>}
  {tab === 'visits' && <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{s.visits.filter((v: Row) => matches({ ...v, location: assignment(v.assignment_id)?.location_name, business: businessName(v.business_id) })).map((v: Row) => <button key={v.id} onClick={() => { setSelected({ kind: 'visit', id: v.id }); setDraft({}); }} className="border rounded-xl p-5 bg-background text-left space-y-2 hover:border-primary"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{assignment(v.assignment_id)?.location_name}</span><Badge variant="outline">{status(v.status)}</Badge></div><p className="text-sm">{v.service_date} · {businessName(v.business_id)}</p>{v.deadline && <p className="text-sm text-amber-700">Correction due <Time value={v.deadline}/></p>}</button>)}{!s.visits.length && <Empty>Visits appear when a contractor manager accepts an assignment.</Empty>}</div>}
  {tab === 'issues' && <><p className="text-sm rounded-lg border border-amber-200 bg-amber-50 p-3">For urgent safety emergencies, follow the site’s emergency procedure. Do not wait for an app reply.</p><div className="grid md:grid-cols-2 gap-3">{s.issues.filter(matches).map((i: Row) => <button key={i.id} className="border rounded-xl p-5 text-left bg-background space-y-2" onClick={() => { setSelected({ kind: 'issue', id: i.id }); setDraft({ comment_key: crypto.randomUUID() }); }}><div className="flex justify-between gap-2"><h2 className="font-semibold">{status(i.category)} · {assignment(i.assignment_id)?.location_name}</h2><Badge variant="outline">{i.severity}</Badge></div><p className="text-sm line-clamp-2">{i.description}</p><p className="text-xs text-muted-foreground">{status(i.status)} · Respond by <Time value={i.response_target}/></p></button>)}{!s.issues.length && <Empty>No issues reported.</Empty>}</div></>}
  {tab === 'reports' && <><h2 className="text-xl font-semibold">Service and quality reports</h2><div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3"><Field label="Period"><select className={native} value={period} onChange={e => choosePeriod(e.target.value)}><option value="week">This week</option><option value="month">This month</option></select></Field><Field label="From (site local date)"><Input type="date" value={from} onChange={e => setFrom(e.target.value)}/></Field><Field label="Through"><Input type="date" value={to} onChange={e => setTo(e.target.value)}/></Field><Field label="Contractor"><select className={native} value={businessFilter} onChange={e => setBusinessFilter(e.target.value)}><option value="">All permitted</option>{s.businesses.map((b: Row) => <option value={b.id} key={b.id}>{b.name}</option>)}</select></Field><Field label="Location"><select className={native} value={locationFilter} onChange={e => setLocationFilter(e.target.value)}><option value="">All permitted</option>{[...new Map(s.assignments.map((a: Row) => [a.location_id, a])).values()].map((a: any) => <option key={a.location_id} value={a.location_id}>{a.location_name}</option>)}</select></Field></div><a className="inline-block text-primary underline text-sm" href={`/api/contractors/reports?from=${from}&to=${to}&business=${businessFilter}&location=${locationFilter}&format=csv`}>Download CSV</a>{report.isLoading ? <p>Loading report…</p> : report.isError ? <div role="alert">{(report.error as Error).message}<Button onClick={() => report.refetch()}>Retry</Button></div> : <><div className="grid md:grid-cols-2 gap-4">{report.data?.groups.map((g: Row) => <section key={g.business_id + g.location_id} className="border bg-background p-5 rounded-xl"><h3 className="font-semibold">{g.name} · {businessName(g.business_id)}</h3><p className="text-xs text-muted-foreground mb-4">{g.timezone}</p><dl className="grid grid-cols-2 gap-3">{Object.entries(g).filter(([k]) => !['name', 'business_id', 'location_id', 'timezone'].includes(k)).map(([key, value]) => <div key={key}><dt className="text-xs text-muted-foreground capitalize">{status(key)}</dt><dd className="text-lg font-semibold">{value === null ? 'Not measured' : String(value)}{key === 'inspection_coverage' && value !== null ? '%' : ''}</dd></div>)}</dl></section>)}</div>{!report.data?.groups.length && <Empty>No assigned locations in this view.</Empty>}<details className="rounded-xl border p-4 bg-background"><summary className="cursor-pointer font-medium">Metric definitions and denominators</summary><dl className="space-y-3 mt-4">{Object.entries(report.data?.definitions || {}).map(([k, v]) => <div key={k}><dt className="font-medium capitalize">{status(k)}</dt><dd className="text-sm text-muted-foreground">{String(v)}</dd></div>)}</dl></details></>}</>}
  {tab === 'notifications' && <div className="space-y-3">{s.notifications.map((n: Row) => <div key={n.id} className="flex flex-wrap justify-between gap-3 p-4 bg-background rounded-xl border"><div><p>{n.body}</p><p className="text-xs text-muted-foreground"><Time value={n.created_at}/></p></div>{!n.read_at && <Button size="sm" variant="outline" disabled={busy} onClick={() => send('read-notification', n.id, {}, false)}>Mark read</Button>}</div>)}{!s.notifications.length && <Empty>No updates yet.</Empty>}</div>}
  </main>
  <Dialog open={!!selected} onOpenChange={v => {
            if (!v) {
                setSelected(null);
                setAccess('');
                setError('');
            }
        }}><DialogContent className="w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{currentVisit ? 'Service visit' : currentIssue ? 'Service issue' : currentBusiness?.name || 'Location assignment'}</DialogTitle><DialogDescription>Changes are shared with the company and authorized contractor team.</DialogDescription></DialogHeader>
   {selected?.kind === 'assignment' && (() => {
            const a = assignment(selected.id), i = s.instructions.find((i: Row) => i.assignment_id === a?.id);
            if (!a)
                return null;
            return <div className="space-y-4"><h3 className="text-lg font-semibold">{a.location_name}</h3><p>{a.address}</p><Badge variant="outline">{a.state}</Badge><p>{a.scope}</p><p className="text-sm">{a.starts_on} – {a.ends_on} · {a.start_time}–{a.end_time} ({a.timezone}) · {a.frequency}</p><p className="text-sm">Days: {a.weekdays.map((d: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}</p><p>Supplies: {a.supplies || 'Not specified'}</p><p>Equipment: {a.equipment || 'Not specified'}</p><p>Admin contact: {a.admin_contact || 'Not specified'}</p><ul className="list-disc pl-5">{a.checklist.map((t: Row) => <li key={t.id}>{t.label} {t.required ? '(required)' : ''} {t.photo_required ? '· photo required' : ''}</li>)}</ul>
    {i && <section className="border rounded-lg p-4 space-y-3"><h4 className="font-semibold">Site instructions · version {i.version}</h4><p className="whitespace-pre-wrap text-sm">{i.content}</p>{!admin && (s.acknowledgements.some((x: Row) => x.instruction_id === i.id) ? <p className="text-green-700 flex gap-2 text-sm"><ShieldCheck className="w-4 h-4"/>Acknowledged</p> : <Button disabled={busy} onClick={() => send('acknowledge', a.id, { instruction_id: i.id }, false)}>I have read and acknowledge these instructions</Button>)}</section>}
    {i && <details className="border rounded-lg p-4"><summary className="cursor-pointer font-medium">Instruction versions and acknowledgements</summary>{s.instructions.filter((x: Row) => x.assignment_id === a.id).map((x: Row) => <section key={x.id} className="border-t pt-3 mt-3 text-sm"><p className="font-medium">Version {x.version} · <Time value={x.created_at}/></p><p className="whitespace-pre-wrap">{x.content}</p><p className="text-xs text-muted-foreground">Acknowledged by: {s.acknowledgements.filter((ack: Row) => ack.instruction_id === x.id).map((ack: Row) => { const m = s.members.find((m: Row) => m.id === ack.member_id); return m ? `${m.first_name} ${m.last_name}` : 'You'; }).join(', ') || 'No acknowledgements yet'}</p></section>)}</details>}
    <div className="flex flex-wrap gap-2">{!admin && manager && a.state === 'proposed' && <><Button disabled={busy} onClick={() => send('assignment-decision', a.id, { version: a.version, decision: 'accepted', reason: '' }, false)}>Accept assignment</Button><Button variant="outline" onClick={() => open('decline', a)}>Decline with reason</Button></>}{admin && <><Button variant="outline" onClick={() => open('instructions', a, { content: i?.content || '', important: true, access_details: '', access_member_ids: [] })}>Publish instructions</Button><Button variant="outline" disabled={busy || a.state !== 'accepted'} onClick={() => send('generate', a.id, {}, false)}>Generate missing visits</Button><Button variant="outline" onClick={() => send('end-assignment', a.id, { version: a.version }, false)} disabled={busy || a.state === 'ended'}>End assignment</Button></>}{manager && <Button variant="outline" onClick={() => open('allocate', a, { member_id: a.lead_member_id || '' })}>Allocate team lead</Button>}<Button variant="outline" disabled={busy} onClick={async () => {
                    setBusy(true);
                    try {
                        const r = await apiRequest('GET', `/api/contractors/access/${a.id}`);
                        setAccess((await r.json()).access_details || 'No access instructions recorded.');
                    }
                    catch (e: any) {
                        setError(e.message);
                    }
                    finally {
                        setBusy(false);
                    }
                }}>View authorized access details</Button></div>{access && <section className="border border-amber-300 bg-amber-50 p-4 rounded-lg"><p className="font-medium">Sensitive site access · do not forward</p><p className="whitespace-pre-wrap">{access}</p></section>}
    {!admin && manager && <Button variant="outline" onClick={() => { setSelected({ kind: 'business', id: a.business_id }); setDraft({}); }}>Business documents and team</Button>}
   </div>;
        })()}
   {currentBusiness && <div className="space-y-4"><p>{currentBusiness.contact_name} · {currentBusiness.email} · {currentBusiness.phone}</p><p>Status: {currentBusiness.status} · Approval: {currentBusiness.approval_status}</p><p>Agreement: {currentBusiness.agreement_start || 'Not set'} – {currentBusiness.agreement_end || 'Not set'}</p><p>Required documents: {currentBusiness.required_documents.join(', ') || 'None configured'}</p>{admin && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => open('business', currentBusiness, { ...currentBusiness, required_documents: currentBusiness.required_documents.join('\n') })}>Edit business</Button><Button onClick={() => open('invite', currentBusiness, { role: 'manager', email: currentBusiness.email })}>Create invitation link</Button>{['active', 'suspended', 'archived'].filter(v => v !== currentBusiness.status).map(value => <Button key={value} disabled={busy} variant="outline" onClick={() => send('business-status', currentBusiness.id, { version: currentBusiness.version, status: value }, false)}>{value === 'active' ? 'Activate' : value === 'suspended' ? 'Suspend' : 'Archive'}</Button>)}</div>}<div className="grid sm:grid-cols-2 gap-3"><Field label="Document type"><Input list="contractor-document-types" value={draft.document_type || ''} onChange={e => set('document_type', e.target.value)}/><datalist id="contractor-document-types">{currentBusiness.required_documents.map((t: string) => <option value={t} key={t}/>)}</datalist></Field>{field('Document expiry date', 'expires_on', 'date')}</div>{showFiles('business', currentBusiness.id)}<h3 className="font-semibold">Team members</h3>{s.members.filter((m: Row) => m.business_id === currentBusiness.id).map((m: Row) => <div key={m.id} className="flex flex-wrap justify-between gap-2 border-t py-3"><p>{m.first_name} {m.last_name} · {m.role} · {m.status}</p>{admin && m.status === 'active' && <Button variant="outline" size="sm" disabled={busy} onClick={() => send('revoke-member', m.id, {}, false)}>Revoke access</Button>}</div>)}{admin && s.invitations.filter((i: Row) => i.business_id === currentBusiness.id).map((i: Row) => <div key={i.id} className="border-t py-3 flex flex-wrap gap-3 justify-between"><p className="text-sm">{i.email} · {i.accepted_at ? 'Accepted' : i.revoked_at ? 'Revoked' : `Expires ${new Date(i.expires_at).toLocaleDateString()}`}</p>{!i.accepted_at && !i.revoked_at && <Button variant="outline" size="sm" disabled={busy} onClick={() => send('revoke-invite', i.id, {}, false)}>Revoke invitation</Button>}</div>)}</div>}
   {currentVisit && (() => { const v = currentVisit, a = assignment(v.assignment_id); return <div className="space-y-4"><h3 className="font-semibold">{a.location_name} · {v.service_date}</h3><Badge variant="outline">{status(v.status)}</Badge><p className="text-sm">{a.start_time}–{a.end_time} · {a.timezone}</p>{v.review_findings && <div className="rounded-lg border bg-amber-50 p-4"><h4 className="font-medium">Review findings / exception</h4><p className="whitespace-pre-wrap">{v.review_findings}</p>{v.deadline && <p>Due <Time value={v.deadline}/></p>}</div>}<div className="flex flex-wrap gap-2">{!admin && ['scheduled', 'blocked', 'correction_required'].includes(v.status) && <Button onClick={() => open('submit', v, { checklist: {}, task_files: {}, notes: '', request_key: crypto.randomUUID() })}>Submit {v.status === 'correction_required' ? 'correction' : 'completed work'}</Button>}{admin && v.status === 'submitted' && <Button onClick={() => open('review', v, { decision: 'approved', score: '' })}>Review submission</Button>}{['scheduled', 'blocked', 'missed', 'cancelled'].some(value => canTransition(admin ? 'admin' : 'contractor', v.status, value)) && <Button variant="outline" onClick={() => open('visit-status', v, { status: ['blocked', 'scheduled', 'cancelled', 'missed'].find(value => canTransition(admin ? 'admin' : 'contractor', v.status, value)) })}>Record exception / change status</Button>}<Button variant="outline" onClick={() => open('issue', {}, { assignment_id: a.id, visit_id: v.id })}>Raise issue</Button></div>{showFiles('visit', v.id)}<h4 className="font-semibold">Submission and correction history</h4>{s.submissions.filter((x: Row) => x.visit_id === v.id).map((x: Row) => <section key={x.id} className="border p-4 rounded-lg space-y-2"><h5 className="font-medium">Revision {x.revision} · <Time value={x.submitted_at}/></h5><p className="text-xs text-muted-foreground">Submitted by {personName(x.submitted_by)}</p><ul className="text-sm">{a.checklist.map((t: Row) => <li key={t.id}>{x.checklist.answers?.[t.id] ? '✓' : '—'} {t.label}</li>)}</ul><p className="whitespace-pre-wrap text-sm">{x.notes}</p><p className="text-xs">{x.file_ids.length} evidence file(s) retained</p><ul className="text-sm space-y-1">{x.file_ids.map((id: string) => { const f = s.files.find((f: Row) => f.id === id); return f ? <li key={id}><a className="text-primary underline" href={`/api/contractors/files/${id}`} target="_blank" rel="noreferrer">{f.name}</a></li> : null; })}</ul>{s.inspections.filter((i: Row) => i.visit_id === v.id && i.revision === x.revision).map((i: Row) => <div key={i.id} className="bg-muted rounded p-3 text-sm"><p>{status(i.decision)} · {i.score === null ? 'No numeric score' : `Score ${i.score}/100`}</p><p className="whitespace-pre-wrap">{i.findings}</p><p>Reviewed <Time value={i.created_at}/></p></div>)}</section>)}<details><summary className="cursor-pointer font-medium">Audit trail</summary>{s.audit.filter((e: Row) => e.entity_type === 'visit' && e.entity_id === v.id).map((e: Row) => <p className="text-xs py-2" key={e.id}>{e.action} · <Time value={e.created_at}/> · {e.actor_id ? personName(e.actor_id) : 'System'}</p>)}</details></div>; })()}
   {currentIssue && <div className="space-y-4"><h3 className="font-semibold">{status(currentIssue.category)} · {assignment(currentIssue.assignment_id)?.location_name}</h3><Badge variant="outline">{currentIssue.severity} · {status(currentIssue.status)}</Badge><p className="whitespace-pre-wrap">{currentIssue.description}</p><p className="text-sm">Respond by <Time value={currentIssue.response_target}/> · Resolve by <Time value={currentIssue.resolution_target}/></p><Button variant="outline" onClick={() => open('issue-status', currentIssue, { status: currentIssue.status, owner_id: currentIssue.owner_id || '' })}>Update status / owner</Button>{showFiles('issue', currentIssue.id)}<h4 className="font-semibold">Shared conversation</h4>{s.comments.filter((c: Row) => c.issue_id === currentIssue.id).map((c: Row) => <div key={c.id} className="rounded-lg border p-3"><p className="whitespace-pre-wrap text-sm">{c.body}</p><p className="text-xs text-muted-foreground"><Time value={c.created_at}/> · {personName(c.author_id)}</p></div>)}{area('Add a comment', 'comment')}<Button disabled={busy || !draft.comment?.trim()} onClick={() => { void act('comment', currentIssue.id, { body: draft.comment, request_key: draft.comment_key }, false).then(() => { set('comment', ''); set('comment_key', crypto.randomUUID()); }).catch(() => { }); }}>Send comment</Button></div>}
   {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </DialogContent></Dialog>
  <Dialog open={!!modal} onOpenChange={v => {
            if (!v && !busy) {
                setModal(null);
                setInvite('');
                setError('');
            }
        }}><DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden"><DialogHeader><DialogTitle className="capitalize">{modal?.type.replace(/-/g, ' ')}</DialogTitle><DialogDescription>Review your entries before saving. Existing history is retained.</DialogDescription></DialogHeader><form className="min-h-0 flex flex-col gap-4" onSubmit={e => {
            e.preventDefault();
            if (!modal)
                return;
            const { type, row } = modal;
            let data: any = { ...draft, version: row.version };
            let action = type, id = row.id || 'new';
            if (type === 'business') {
                action = row.id ? 'edit-business' : 'create-business';
                data.required_documents = typeof draft.required_documents === 'string' ? draft.required_documents.split('\n').map((x: string) => x.trim()).filter(Boolean) : [];
                data.agreement_start = draft.agreement_start || null;
                data.agreement_end = draft.agreement_end || null;
            }
            if (type === 'assignment') {
                action = 'create-assignment';
                data.checklist = (draft.tasks || '').split('\n').filter((x: string) => x.trim()).map((label: string, i: number) => ({ id: `task-${i + 1}`, label: label.replace(/\[photo\]/gi, '').trim(), required: true, photo_required: /\[photo\]/i.test(label) }));
            }
            if (type === 'decline') {
                action = 'assignment-decision';
                data.decision = 'declined';
            }
            if (type === 'allocate') {
                action = 'allocate-lead';
            }
            if (type === 'issue') {
                action = 'create-issue';
                data.owner_id = draft.owner_id || null;
                if (!data.visit_id)
                    delete data.visit_id;
                data.response_target = new Date(draft.response_target).toISOString();
                data.resolution_target = new Date(draft.resolution_target).toISOString();
            }
            if (type === 'issue-status')
                data.owner_id = draft.owner_id || null;
            if (type === 'review') {
                data.score = draft.score === '' || draft.score === undefined ? null : Number(draft.score);
                data.deadline = draft.deadline ? new Date(draft.deadline).toISOString() : null;
            }
            send(action, id, data);
        }}>
   <div className="min-h-0 overflow-y-auto space-y-4 pr-1">
   {modal?.type === 'business' && <><div className="grid sm:grid-cols-2 gap-3">{field('Business name', 'name', 'text', true)}{field('Contact name', 'contact_name')}{field('Email', 'email', 'email', true)}{field('Phone', 'phone')}{field('Agreement starts', 'agreement_start', 'date')}{field('Agreement ends', 'agreement_end', 'date')}</div>{area('Required document types (one per line)', 'required_documents')}{select('Approval', 'approval_status', ['pending', 'approved', 'rejected'].map(value => ({ value, label: value })))}</>}
   {modal?.type === 'invite' && <>{field('Invite email', 'email', 'email', true)}{select('Workspace role', 'role', [{ value: 'manager', label: 'Contractor manager' }, { value: 'lead', label: 'Team lead' }])}<p className="text-sm text-muted-foreground">Creates a private link valid for 7 days. Share it only with the named recipient. No email is sent automatically.</p>{invite && <div className="border rounded p-3 space-y-2"><Input aria-label="Invitation link" readOnly value={invite}/><Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(invite).then(() => toast({ title: 'Link copied' })).catch(() => toast({ title: 'Copy unavailable. Select and copy the link.' }))}>Copy invitation link</Button></div>}</>}
   {modal?.type === 'assignment' && <>{select('Contractor business', 'business_id', s.businesses.filter((b: Row) => b.status === 'active' && b.approval_status === 'approved').map((b: Row) => ({ value: b.id, label: b.name })))}{select('Existing location', 'location_id', s.locations.map((l: Row) => ({ value: l.id, label: `${l.name} (${l.timezone || s.company.timezone})` })))}<div className="grid sm:grid-cols-2 gap-3">{field('Effective from', 'starts_on', 'date', true)}{field('Effective through (max one year)', 'ends_on', 'date', true)}{field('Service window starts', 'start_time', 'time', true)}{field('Service window ends', 'end_time', 'time', true)}</div><p className="text-xs text-muted-foreground">An end time earlier than the start time means the window ends the next day. Visit date is the service start date.</p>{field('Location timezone (IANA)', 'timezone', 'text', true)}{select('Frequency', 'frequency', [{ value: 'weekly', label: 'Weekly' }, { value: 'fortnightly', label: 'Every two weeks' }])}<fieldset><legend className="text-sm font-medium mb-2">Service days</legend><div className="flex flex-wrap gap-3">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => <label key={day} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={(draft.weekdays || []).includes(index)} onChange={e => set('weekdays', e.target.checked ? [...(draft.weekdays || []), index] : draft.weekdays.filter((x: number) => x !== index))}/>{day}</label>)}</div></fieldset>{area('Cleaning scope', 'scope', true)}{area('Checklist (one required task per line; add [photo] only where a photo is required)', 'tasks')}{area('Supply responsibilities', 'supplies')}{area('Equipment responsibilities', 'equipment')}{field('Admin contact for the site', 'admin_contact')}</>}
   {modal?.type === 'instructions' && <>{area('Site rules, cleaning standards and safety instructions', 'content', true)}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.important !== false} onChange={e => set('important', e.target.checked)}/>Require a fresh acknowledgement before submitting work</label>{area('Sensitive site access details (new version; never included in reports or email)', 'access_details')}<fieldset><legend className="font-medium text-sm">Explicit access recipients</legend>{s.members.filter((m: Row) => m.business_id === modal.row.business_id && m.status === 'active').map((m: Row) => <label key={m.id} className="flex items-center gap-2 text-sm py-1"><input type="checkbox" checked={(draft.access_member_ids || []).includes(m.id)} onChange={e => set('access_member_ids', e.target.checked ? [...draft.access_member_ids, m.id] : draft.access_member_ids.filter((x: string) => x !== m.id))}/>{m.first_name} {m.last_name} ({m.role})</label>)}</fieldset></>}
   {modal?.type === 'allocate' && select('Authorized team lead', 'member_id', [{ value: '', label: 'No lead allocated' }, ...s.members.filter((m: Row) => m.business_id === modal.row.business_id && m.role === 'lead' && m.status === 'active').map((m: Row) => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))], false)}
   {modal?.type === 'decline' && area('Reason for declining', 'reason', true)}
   {modal?.type === 'submit' && <><p className="text-sm">Check completed tasks and select evidence that was successfully uploaded to this visit. Upload files from the visit details first.</p>{assignment(modal.row.assignment_id)?.checklist.map((t: Row) => <div key={t.id} className="border p-3 rounded space-y-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.checklist?.[t.id]} onChange={e => set('checklist', { ...draft.checklist, [t.id]: e.target.checked })}/>{t.label}{t.required ? ' *' : ''}</label>{t.photo_required && <Field label="Required photo evidence"><select multiple className={native} value={draft.task_files?.[t.id] || []} onChange={e => set('task_files', { ...draft.task_files, [t.id]: Array.from(e.target.selectedOptions).map(o => o.value) })}>{s.files.filter((f: Row) => f.kind === 'visit' && f.entity_id === modal.row.id && f.mime.startsWith('image/')).map((f: Row) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>}</div>)}{area('Work notes / correction evidence', 'notes')}<fieldset><legend className="text-sm font-medium">Include relevant uploaded evidence</legend>{s.files.filter((f: Row) => f.kind === 'visit' && f.entity_id === modal.row.id).map((f: Row) => <label key={f.id} className="flex gap-2 items-center text-sm py-1"><input type="checkbox" checked={(draft.file_ids || []).includes(f.id)} onChange={e => set('file_ids', e.target.checked ? [...(draft.file_ids || []), f.id] : (draft.file_ids || []).filter((x: string) => x !== f.id))}/>{f.name}</label>)}</fieldset></>}
   {modal?.type === 'review' && <>{select('Review decision', 'decision', [{ value: 'approved', label: 'Approve completed work' }, { value: 'correction_required', label: 'Request corrections' }])}{area('Inspection findings / correction instructions', 'findings', draft.decision === 'correction_required')}{draft.decision === 'correction_required' && field('Correction deadline (your local time)', 'deadline', 'datetime-local', true)}{field('Inspection score (optional, 0–100)', 'score', 'number')}<p className="text-xs text-muted-foreground">A submitted visit is not approved until you save an approval. Numeric scores cover inspected work only.</p></>}
   {modal?.type === 'visit-status' && <>{select('New status', 'status', (admin ? ['scheduled', 'blocked', 'missed', 'cancelled'] : ['blocked', 'scheduled']).filter(value => canTransition(admin ? 'admin' : 'contractor', modal.row.status, value)).map(value => ({ value, label: status(value) })))}{area('Reason', 'reason', true)}</>}
   {modal?.type === 'issue' && <><p className="rounded border border-amber-200 p-3 bg-amber-50 text-sm">For urgent safety emergencies, follow the site’s emergency procedure; do not wait for an app reply.</p>{select('Assigned location', 'assignment_id', s.assignments.filter((a: Row) => a.state === 'accepted').map((a: Row) => ({ value: a.id, label: a.location_name })))}{select('Category', 'category', ['blocked_access', 'missing_supplies', 'damage', 'unsafe_conditions', 'client_request', 'quality_concern', 'complaint', 'other'].map(value => ({ value, label: status(value) })))}{select('Severity', 'severity', ['low', 'medium', 'high', 'urgent'].map(value => ({ value, label: value })))}{area('Description', 'description', true)}{field('Respond by (your local time)', 'response_target', 'datetime-local', true)}{field('Resolve by (your local time)', 'resolution_target', 'datetime-local', true)}{select('Assigned owner', 'owner_id', s.owner_candidates.filter((u: Row) => !u.business_id || u.business_id === assignment(draft.assignment_id)?.business_id).map((u: Row) => ({ value: u.id, label: u.name })), false)}</>}
   {modal?.type === 'issue-status' && <>{select('Status', 'status', (admin ? ['open', 'in_progress', 'resolved', 'closed'] : ['open', 'in_progress', 'resolved']).map(value => ({ value, label: status(value) })))}{select('Assigned owner', 'owner_id', s.owner_candidates.filter((u: Row) => !u.business_id || u.business_id === modal.row.business_id).map((u: Row) => ({ value: u.id, label: u.name })), false)}</>}
   {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}</div><div className="border-t pt-4 flex gap-3 justify-end shrink-0"><Button type="button" variant="outline" disabled={busy} onClick={() => { setModal(null); setError(''); }}>Cancel</Button><Button disabled={busy || !!invite} type="submit">{busy ? 'Saving…' : 'Save'}</Button></div></form></DialogContent></Dialog>
 </div>;
}
