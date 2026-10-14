import assert from 'node:assert/strict';
import {verifiedWorkSite,matchAddress,resolveWorkSite} from '../server/location-geocoding';
assert.equal(verifiedWorkSite('1783 Dugald Rd, Winnipeg, MB R2J 0H3')?.latitude,49.8866742);assert.equal(verifiedWorkSite('650 Main street, Selkirk')?.longitude,-96.8649149);assert.equal(verifiedWorkSite('650 Main Street, Toronto'),null);
const f={properties:{countrycode:'CA',housenumber:'10',street:'Dugald Road',city:'Winnipeg'},geometry:{coordinates:[-97,49]}};
assert.equal(matchAddress('10 Dugald Rd, Winnipeg',[f],'CA').latitude,49);for(const props of [{countrycode:'US'},{housenumber:'11'},{city:'Toronto'},{street:'Main Street'}])assert.throws(()=>matchAddress('10 Dugald Rd, Winnipeg',[{...f,properties:{...f.properties,...props}}],'CA'),/could not be matched/);
assert.throws(()=>matchAddress('10 Dugald Rd, Winnipeg',[f,{...f,geometry:{coordinates:[-96,49]}}],'CA'),/multiple/);
let calls=0;const request:any=async()=>{calls++;return Response.json({features:[f]});};assert.equal((await resolveWorkSite({address:'10 Dugald Rd, Winnipeg'},{country:'CA'},request)).latitude,49);await resolveWorkSite({address:'10 Dugald Rd, Winnipeg'},{country:'CA'},request);assert.equal(calls,1);
await resolveWorkSite({address:'650 Main St, Selkirk'},{country:'CA'},request);assert.equal(calls,1);
console.log('PASS: verified site pins, exact street/number/city/country matching, ambiguous match rejection, cached lookup, known sites avoid external lookup.');
