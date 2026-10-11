import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
const text=(await fs.readFile('cloudflare/worker.js','utf8')).replace(/^import[^\n]*\n/,'').replace('export class ClockFieldContainer','class ClockFieldContainer').replace('export default {','return {');
const RealDate=Date;let moment='2026-10-20T14:00:00Z';
class FrozenDate extends RealDate{constructor(...args){super(...(args.length?args:[moment]));}static now(){return RealDate.parse(moment);}}
globalThis.Date=FrozenDate;
let schedules={company:{enabled:true,timezone:'America/Winnipeg',anchor:'2026-05-18',days:[2,4],hour:9}};let requests=[];let jobs=[];
const stub={getPayrollSchedules:async()=>schedules,fetch:async request=>{requests.push(request);return Response.json({sent:0});}};
const worker=new Function('Container','getContainer',text)(class{},()=>stub);
const env={SESSION_SECRET:'synthetic-test-key',CF_VERSION_METADATA:{id:'test-version'}};
try{
 for(const date of ['2026-10-20T13:00:00Z','2026-10-20T14:00:00Z','2026-10-21T14:00:00Z','2026-11-03T14:00:00Z','2026-11-03T15:00:00Z']){moment=date;await worker.scheduled({},env,{waitUntil:promise=>jobs.push(promise)});await Promise.all(jobs);const request=requests.at(-1),stamp=request.headers.get('X-ClockField-Timestamp');assert.equal(request.headers.get('X-ClockField-Signature'),createHmac('sha256',env.SESSION_SECRET).update(`payroll-summary:${stamp}`).digest('hex'));assert.equal(new URL(request.url).pathname,'/api/internal/payroll-summary');}
 assert.equal(requests.length,5);
 const config=await fs.readFile('cloudflare/wrangler.jsonc','utf8');assert.ok(config.includes('*/5 * * * *'));
 console.log('PASS: five-minute attendance/payroll checks across DST, even on non-payroll days, with authenticated internal requests.');
}finally{globalThis.Date=RealDate;}
