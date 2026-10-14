import {validCoordinates,distanceMeters} from '../shared/geofence';
const normalize=(s:string)=>s.toLowerCase().replace(/\bstreet\b/g,'st').replace(/\broad\b/g,'rd').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
// Building pins independently verified on Google Maps. Match the street AND city.
export function verifiedWorkSite(address:string){const a=normalize(address);if(/^1783 dugald rd\b/.test(a)&&/\bwinnipeg\b/.test(a))return {latitude:49.8866742,longitude:-97.0359618,source:'Verified building pin'};if(/^650 main st\b/.test(a)&&/\bselkirk\b/.test(a))return {latitude:50.1560784,longitude:-96.8649149,source:'Verified building pin'};return null;}
export function matchAddress(address:string,features:any[],country:string){
 const a=normalize(address),house=a.match(/^([0-9]+[a-z]?)\b/)?.[1];if(!house)throw new Error('Save the complete street address, including building number and city, before enabling this boundary.');
 const matches=features.filter(f=>{const p=f.properties||{},c=f.geometry?.coordinates;return c?.length===2&&validCoordinates(c[1],c[0])&&String(p.countrycode||'').toUpperCase()===country&&normalize(String(p.housenumber||''))===house&&p.street&&a.includes(normalize(p.street))&&[p.city,p.town,p.village].some(city=>city&&(address.split(',').slice(1).some(part=>normalize(part)===normalize(city)) || a.endsWith(' '+normalize(city))));});
 if(!matches.length)throw new Error('The work site address could not be matched precisely. Add its full street address and city, or enter a verified map pin.');
 const first=matches[0].geometry.coordinates;
 if(matches.some(f=>distanceMeters({latitude:first[1],longitude:first[0]},{latitude:f.geometry.coordinates[1],longitude:f.geometry.coordinates[0]})>30))throw new Error('This address has multiple map matches. Enter the correct building’s map pin.');
 return {latitude:first[1],longitude:first[0],source:'OpenStreetMap / Photon'};
}
const cache=new Map<string,{expires:number;result:any}>();let queue=Promise.resolve(),lastRequest=0;
export async function resolveWorkSite(site:any,company:any,request:typeof fetch=fetch){
 const address=String(site.address||'').trim();if(!address)throw new Error('Add a complete street address to this work site first.');
 const known=verifiedWorkSite(address);if(known)return known;
 const country=String(company.country||'CA').toUpperCase(),key=`${country}:${normalize(address)}`;
 const cached=cache.get(key);if(cached&&cached.expires>Date.now())return cached.result;
 const previous=queue;let release!:()=>void;queue=new Promise<void>(r=>release=r);await previous;
 try{const again=cache.get(key);if(again&&again.expires>Date.now())return again.result;const delay=Math.max(0,1100-(Date.now()-lastRequest));if(delay)await new Promise(r=>setTimeout(r,delay));lastRequest=Date.now();
 const url=new URL(process.env.WORK_SITE_GEOCODER_URL||'https://photon.komoot.io/api/');url.searchParams.set('q',`${address}, ${country}`);url.searchParams.set('limit','5');url.searchParams.set('lang','en');
 const response=await request(url,{headers:{'User-Agent':'ClockField work-site boundary setup (https://clockfield.com)'},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('Address lookup is temporarily unavailable. Try again or enter the building’s map pin.');
 const data=await response.json();const result=matchAddress(address,data.features||[],country);if(cache.size>500)cache.clear();cache.set(key,{result,expires:Date.now()+86400000});return result;
 }finally{release();}
}
