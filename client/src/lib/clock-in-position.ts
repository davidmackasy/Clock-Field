import type {PositionFix} from '@shared/geofence';
export function clockInPosition():Promise<PositionFix> {
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(new Error('Location is unavailable on this device. Use a phone with location services enabled.'));
    navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp}),e=>reject(new Error(e.code===1?'Location access is blocked. In your browser’s website settings, allow Location for ClockField. Also turn on Location Services and Precise Location for your browser in your phone’s settings, then try again.':e.code===3?'Location took too long. Check location services and retry.':'Your location could not be found. Enable precise location and retry.')),{enableHighAccuracy:true,maximumAge:0,timeout:20000});
  });
}
export function clockInError(error:any):string {
  const message=error?.message||'Location could not be verified. Please retry.';
  try {return JSON.parse(message.slice(message.indexOf('{'))).message||message;} catch {return message;}
}

export function clockInErrorTitle(message: string): string {
  if (/location access is blocked/i.test(message)) return 'Allow location access';
  if (/metres from|within \d+ metres/i.test(message)) return 'Arrive at your work site';
  if (/accurate enough/i.test(message)) return 'Improve location accuracy';
  if (/location|reading/i.test(message)) return 'Check your location';
  return 'Clock-in needs your attention';
}
