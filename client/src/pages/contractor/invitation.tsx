import { useState } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function ContractorInvitation() {
    const { token } = useParams<{
        token: string;
    }>();
    const q = useQuery<any>({ queryKey: ['/api/public/contractor-invites', token], queryFn: async () => { const r = await apiRequest('GET', `/api/public/contractor-invites/${token}`); return r.json(); }, retry: false });
    const [first, setFirst] = useState(''), [last, setLast] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false);
    return <main className="min-h-screen bg-slate-50 p-4 sm:p-8 flex items-start justify-center"><section className="w-full max-w-lg rounded-xl border bg-background p-6 sm:p-8 space-y-5">{q.data?.company_logo_url && <img alt="Company logo" src={q.data.company_logo_url} className="h-14 object-contain"/>}<p className="text-sm text-muted-foreground">ClockField · {q.data?.company_name}</p><h1 className="text-2xl font-semibold">Contractor invitation</h1>{q.isLoading ? <p>Loading invitation…</p> : q.isError ? <div role="alert"><p>{(q.error as Error).message}</p><Button onClick={() => q.refetch()}>Retry</Button></div> : done ? <><p>Your contractor account is ready. Sign in with the invited email and your password.</p><Link href="/business/login" className="text-primary underline">Continue to sign in</Link></> : <><p>Join <strong>{q.data.business_name}</strong> as a {q.data.role === 'lead' ? 'team lead' : 'contractor manager'}.</p><p className="text-sm">Invited email: {q.data.email}</p><form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault();
                if (password !== confirm) {
                    setError('Passwords must match');
                    return;
                }
                setBusy(true);
                setError('');
                try {
                    await apiRequest('POST', `/api/public/contractor-invites/${token}/accept`, { first_name: first, last_name: last, password });
                    setDone(true);
                    setPassword('');
                    setConfirm('');
                }
                catch (e: any) {
                    setError(e.message);
                }
                finally {
                    setBusy(false);
                }
            }}><label className="block text-sm">First name<Input autoComplete="given-name" required value={first} onChange={e => setFirst(e.target.value)}/></label><label className="block text-sm">Last name<Input autoComplete="family-name" required value={last} onChange={e => setLast(e.target.value)}/></label><label className="block text-sm">Create a password (at least 12 characters)<Input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}/></label><label className="block text-sm">Confirm password<Input required type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)}/></label>{error && <p role="alert" className="text-red-700 text-sm">{error}</p>}<Button disabled={busy} className="w-full">{busy ? 'Creating account…' : 'Accept invitation and create account'}</Button></form><p className="text-xs text-muted-foreground">Workspace roles control app access and do not determine legal contractor status.</p></>}</section></main>;
}
