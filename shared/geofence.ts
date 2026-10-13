export type PositionFix = { latitude: number; longitude: number; accuracy: number; timestamp: number };
export function distanceMeters(a: {latitude:number;longitude:number}, b: {latitude:number;longitude:number}) {
  const rad = Math.PI / 180, lat = (b.latitude-a.latitude)*rad, lon = (b.longitude-a.longitude)*rad;
  const h = Math.sin(lat/2)**2 + Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(lon/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
}
export function validCoordinates(lat: unknown, lon: unknown) {
  return typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat)<=90 && typeof lon === 'number' && Number.isFinite(lon) && Math.abs(lon)<=180;
}
export function checkGeofence(site:any, fix:any, now=Date.now()) {
  if (!site.geofenceEnabled) return null;
  const latitude=Number(site.latitude),longitude=Number(site.longitude),radius=site.geofenceRadiusMeters;
  if (site.latitude==null || site.longitude==null || !validCoordinates(latitude,longitude) || !Number.isInteger(radius) || radius<50 || radius>1000) throw new Error('This work site’s boundary needs to be configured by your admin.');
  if (!fix || !validCoordinates(fix.latitude,fix.longitude) || typeof fix.accuracy!=='number' || !Number.isFinite(fix.accuracy) || fix.accuracy<0 || typeof fix.timestamp!=='number' || !Number.isFinite(fix.timestamp)) throw new Error('Allow location access and retry at your assigned work site.');
  if (now-fix.timestamp>60000 || fix.timestamp-now>10000) throw new Error('Your location reading has expired. Please retry to get a fresh reading.');
  if (fix.accuracy>Math.min(75,radius/2)) throw new Error('Your location is not accurate enough. Enable precise location, move near an entrance and retry.');
  const distance=distanceMeters({latitude,longitude},fix);
  // Never expand the configured boundary by the browser-reported accuracy.
  if (distance>radius) throw new Error(`You are ${Math.round(distance)} metres from ${site.name}. Clock in when you are within ${radius} metres of this work site.`);
  return {distanceMeters:Math.round(distance),accuracyMeters:Math.round(fix.accuracy),radiusMeters:radius,checkedAt:new Date(now).toISOString()};
}
export function geofenceInput(body:any,current:any={}) {
  const merged={...current}; const changes:any={};
  for (const key of ['geofenceEnabled','latitude','longitude','geofenceRadiusMeters']) if (body[key]!==undefined) {merged[key]=body[key];changes[key]=body[key];}
  if (changes.geofenceEnabled!==undefined && typeof changes.geofenceEnabled!=='boolean') throw new Error('Boundary enabled must be true or false.');
  for(const key of ['latitude','longitude']) if(changes[key]!==undefined) {
    if(changes[key]===null || changes[key]==='') changes[key]=merged[key]=null;
    else {if(typeof changes[key]!=='number' || !Number.isFinite(changes[key]) || Math.abs(changes[key])>(key==='latitude'?90:180))throw new Error('Enter valid latitude and longitude.');changes[key]=String(changes[key]);}
  }
  if(changes.geofenceRadiusMeters!==undefined && (!Number.isInteger(changes.geofenceRadiusMeters)||changes.geofenceRadiusMeters<50||changes.geofenceRadiusMeters>1000)) throw new Error('Radius must be between 50 and 1,000 metres.');
  if(merged.geofenceEnabled && (merged.latitude==null || merged.longitude==null || !validCoordinates(Number(merged.latitude),Number(merged.longitude)))) throw new Error('Set the exact work site coordinates before enabling its boundary.');
  return changes;
}
