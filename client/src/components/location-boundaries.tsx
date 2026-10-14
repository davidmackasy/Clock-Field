import {validCoordinates} from "@shared/geofence";
import {geofenceInput} from "@shared/geofence";
import {clockInError} from "@/lib/clock-in-position";
import {useState,useRef} from 'react';
import {useMutation} from '@tanstack/react-query';
import {apiRequest,queryClient} from '@/lib/queryClient';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Switch} from '@/components/ui/switch';
import {useToast} from '@/hooks/use-toast';
export function LocationBoundaries({locations=[]}:{locations?:any[]}) {
  const [open,setOpen]=useState(false),[id,setId]=useState(''),[latitude,setLatitude]=useState(''),[longitude,setLongitude]=useState(''),[radius,setRadius]=useState('100'),[enabled,setEnabled]=useState(false),[error,setError]=useState('');
  const requestVersion=useRef(0);const [locating,setLocating]=useState(false),[source,setSource]=useState("");
  const {toast}=useToast(); const selected=locations.find(l=>l.id===id);
  const select=(value:string)=>{requestVersion.current++;setLocating(false);setSource("");const site=locations.find(l=>l.id===value);setId(value);setLatitude(site?.latitude??'');setLongitude(site?.longitude??'');setRadius(String(site?.geofenceRadiusMeters??100));setEnabled(site?.geofenceEnabled??false);setError('');};
  const toggle=async(value:boolean)=>{
    const version=++requestVersion.current;setError("");setLocating(false);
    if(!value){setEnabled(false);return;}
    if(latitude.trim()&&longitude.trim()&&validCoordinates(Number(latitude),Number(longitude))){setEnabled(true);return;}
    setEnabled(false);setLocating(true);
    try {const response=await apiRequest('POST',`/api/locations/${id}/coordinates`),pin=await response.json();if(requestVersion.current!==version)return;if(!validCoordinates(pin.latitude,pin.longitude))throw new Error('Could not find a valid building pin.');setLatitude(String(pin.latitude));setLongitude(String(pin.longitude));setSource(pin.source);setEnabled(true);}catch(e:any){if(requestVersion.current===version)setError(clockInError(e));}finally{if(requestVersion.current===version)setLocating(false);}
  };
  const save=useMutation({mutationFn:async()=>{if(!id)throw new Error('Select a work site.');const body={latitude:latitude.trim()===''?null:Number(latitude),longitude:longitude.trim()===''?null:Number(longitude),geofenceRadiusMeters:Number(radius),geofenceEnabled:enabled};geofenceInput(body);await apiRequest('PATCH',`/api/locations/${id}`,body);},onSuccess:()=>{queryClient.invalidateQueries({queryKey:['/api/locations']});toast({title:enabled?'Clock-in boundary enabled':'Work site boundary saved'});setOpen(false);},onError:(e:any)=>setError(clockInError(e))});
  return <><Button variant="outline" onClick={()=>{select(locations[0]?.id||'');setOpen(true);}}>Clock-in boundaries</Button><Dialog open={open} onOpenChange={value=>{if(!value){requestVersion.current++;setLocating(false);}setOpen(value);}}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Work site clock-in boundary</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={e=>{e.preventDefault();save.mutate();}}>
    <div className="space-y-2"><Label htmlFor="boundary-site">Work site</Label><select id="boundary-site" className="border rounded-md p-2 w-full" value={id} onChange={e=>select(e.target.value)}><option value="">Select a work site</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name} {l.geofenceEnabled?'• Enabled':'• Not enabled'}</option>)}</select></div>
    {selected&&<><p className="text-sm text-muted-foreground break-words">{selected.address||'No street address saved'}</p><a className="text-sm text-primary underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.address||selected.name)}`}>Find this work site on Google Maps</a></>}
    <p className="text-sm text-muted-foreground">Turn on the requirement to fill the coordinates from this work site’s saved address. Check the building pin before saving. You can adjust it for a separate entrance or building.</p>
    <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="boundary-lat">Latitude</Label><Input id="boundary-lat" disabled={locating} inputMode="decimal" placeholder="49.9000000" value={latitude} onChange={e=>setLatitude(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="boundary-lon">Longitude</Label><Input id="boundary-lon" disabled={locating} inputMode="decimal" placeholder="-97.1000000" value={longitude} onChange={e=>setLongitude(e.target.value)} /></div></div>
    <div className="space-y-2"><Label htmlFor="boundary-radius">Allowed radius (metres)</Label><Input id="boundary-radius" type="number" min={50} max={1000} step={1} value={radius} onChange={e=>setRadius(e.target.value)} /></div>
    <div className="flex items-center justify-between gap-3"><Label htmlFor="boundary-enabled">Require location at clock-in</Label><Switch id="boundary-enabled" checked={enabled} disabled={!id||locating||save.isPending} onCheckedChange={toggle}/></div>
    <p className="text-sm text-muted-foreground">Enabled sites block clock-in outside this radius or without a fresh, precise location reading. Assign this work site to the cleaner’s shift. Clock-out is always available.</p>
    {locating&&<p role="status" className="text-sm">Finding the work site’s map coordinates…</p>}
    {source&&<p className="text-xs text-muted-foreground">Coordinates filled automatically · {source}. <a href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`} target="_blank" rel="noopener noreferrer" className="underline">View building pin</a></p>}
    <p className="text-xs text-muted-foreground">Address lookup uses Photon / © OpenStreetMap contributors when no verified pin is saved.</p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" type="submit" disabled={!id||save.isPending||locating}>{save.isPending?'Saving…':'Save boundary'}</Button>
  </form></DialogContent></Dialog></>;
}
