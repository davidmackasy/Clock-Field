import { useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
export function ProfilePhotoUpload({ kind, id, name, url, onUpdated }: {
    kind: 'clients' | 'employees';
    id: string;
    name: string;
    url?: string;
    onUpdated?: (value: any) => void;
}) { const input = useRef<HTMLInputElement>(null), [busy, setBusy] = useState(false); const { toast } = useToast(); const upload = async (file?: File) => { if (!file)
    return; setBusy(true); try {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)
        throw new Error('Choose a PNG, JPEG or WebP image under 10 MB');
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height)), canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const imageData = canvas.toDataURL('image/png');
    if (imageData.length > 2800000)
        throw new Error('Use a smaller image');
    const updated = await (await apiRequest('POST', `/api/${kind}/${id}/avatar`, { imageData })).json();
    queryClient.invalidateQueries({ queryKey: [`/api/${kind}`] });
    onUpdated?.(updated);
    toast({ title: 'Profile image saved' });
}
catch (error: any) {
    toast({ title: 'Image upload failed', description: error.message, variant: 'destructive' });
}
finally {
    setBusy(false);
    if (input.current)
        input.current.value = '';
} }; return <div className="flex items-center gap-3"><Avatar className="h-14 w-14 rounded-lg"><AvatarImage src={url} alt={name} className="object-contain"/><AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : 'Upload photo / logo'}</Button><p className="text-xs text-muted-foreground mt-1">PNG, JPEG or WebP</p></div><input ref={input} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => upload(e.target.files?.[0])}/></div>; }
