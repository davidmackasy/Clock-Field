import type {PositionFix} from '@shared/geofence';
export function clockInPosition():Promise<PositionFix> {
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(new Error('Location is unavailable on this device. Use a phone with location services enabled.'));
    navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp}),e=>reject(new Error(e.code===1?'Allow precise location access in your browser settings to clock in at this work site.':e.code===3?'Location took too long. Check location services and retry.':'Your location could not be found. Enable precise location and retry.')),{enableHighAccuracy:true,maximumAge:0,timeout:20000});
  });
}
export function clockInError(error:any):string {
  const message=error?.message||'Location could not be verified. Please retry.';
  try {return JSON.parse(message.slice(message.indexOf('{'))).message||message;} catch {return message;}
}
