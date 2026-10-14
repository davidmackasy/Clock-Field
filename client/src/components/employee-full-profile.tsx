import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { EmployeeProfileFields } from './employee-profile-fields';
import { emptyProfile } from '@shared/people';
import { useToast } from '@/hooks/use-toast';
export function EmployeeFullProfile({ employeeId }: {
    employeeId: string;
}) { const { toast } = useToast(); const [editing, setEditing] = useState(false), [value, setValue] = useState<any>(emptyProfile()); const key = `/api/employees/${employeeId}/profile`; const { data, isLoading, error } = useQuery<any>({ queryKey: [key] }); useEffect(() => { if (data)
    setValue(data.profileDetails || emptyProfile()); }, [data]); const save = useMutation({ mutationFn: async () => { return (await apiRequest('PATCH', `/api/employees/${employeeId}`, { profileDetails: value })).json(); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: [key] }); setEditing(false); toast({ title: 'Full profile updated' }); }, onError: (e: any) => toast({ title: 'Profile could not be saved', description: e.message, variant: 'destructive' }) }); return <section className="border-t pt-5 space-y-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Full employee details</h3><p className="text-xs text-muted-foreground">Employment history, references, emergency contacts and qualifications.</p></div><Button type="button" variant="outline" size="sm" onClick={() => { if (editing)
    setValue(data?.profileDetails || emptyProfile()); setEditing(v => !v); }}>{editing ? 'Cancel' : 'Edit details'}</Button></div>{isLoading ? <p>Loading profile…</p> : error ? <p role="alert">Profile could not be loaded.</p> : <><EmployeeProfileFields value={value} onChange={setValue} readOnly={!editing}/>{editing && <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>Save full details</Button>}</>}</section>; }
