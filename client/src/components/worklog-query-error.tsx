import { Button } from './ui/button';
export function WorklogQueryError({ retry, message = 'Unable to load this information.' }: { retry: () => void; message?: string }) {
 return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex flex-wrap items-center gap-3"><p className="flex-1">{message}</p><Button variant="outline" size="sm" onClick={retry}>Retry</Button></div>;
}
