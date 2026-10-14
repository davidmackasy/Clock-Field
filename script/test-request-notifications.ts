import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { transform } from 'esbuild';
import { hasAccess } from '../shared/people';
const source=await fs.readFile('server/request-notifications.ts','utf8');
const code=(await transform(source.replace(/^import .*;\n/gm,''),{loader:'ts',format:'cjs'})).code;
const module={exports:{} as any};
new Function('module','exports','storage','sendWebsiteRequestEmail','hasAccess',code)(module,module.exports,{},()=>{},hasAccess);
const admin={companyId:'company',role:'admin',isActive:true,accountStatus:'active',adminPermissions:null,email:'owner@example.test'};
const recipients=[admin,{...admin,email:' OWNER@example.test '},{...admin,email:'forms@example.test',adminPermissions:['forms']},{...admin,email:'restricted@example.test',adminPermissions:['attendance']},{...admin,email:'disabled@example.test',isActive:false},{...admin,email:'pending@example.test',accountStatus:'pending_activation'},{...admin,email:'foreign@example.test',companyId:'foreign'}];
const notices:any[]=[];const storage={getCompany:async()=>({name:'Example Company'}),getAdminsByCompany:async()=>recipients};
const notice={companyId:'company',requestId:'request & 1',source:'submission',formName:'Cleaning quote',clientName:'Example Customer',serviceType:'Regular cleaning',submittedAt:'2026-10-14T14:30:00Z'};
await module.exports.notifyWebsiteRequest(notice,{storage,send:async(data:any)=>notices.push(data)});
assert.deepEqual(notices.map(n=>n.to),['owner@example.test','forms@example.test']);
const url=new URL(notices[0].requestUrl);assert.equal(url.searchParams.get('submission'),notice.requestId);assert.equal(url.searchParams.get('tab'),'submissions');assert.equal(url.pathname,'/admin/quote-forms');
notices.length=0;await module.exports.notifyWebsiteRequest({...notice,source:'booking'},{storage,send:async(data:any)=>notices.push(data)});assert.equal(new URL(notices[0].requestUrl).searchParams.get('booking'),notice.requestId);
const originalError=console.error;let errors=0;console.error=()=>errors++;
try {await module.exports.notifyWebsiteRequest(notice,{storage,send:async()=>{throw Error('mail outage');}});await module.exports.notifyWebsiteRequest(notice,{storage:{...storage,getAdminsByCompany:async()=>{throw Error('lookup outage');}},send:async()=>{}});}finally{console.error=originalError;}assert.equal(errors,2);
// Exercise the actual mail payload with a fake Mailgun client.
const mailSource=await fs.readFile('server/mail.ts','utf8');const mailCode=(await transform(mailSource.slice(mailSource.indexOf('export async function sendWebsiteRequestEmail')),{loader:'ts',format:'cjs'})).code;
const mailModule={exports:{} as any};let payload:any;
new Function('module','exports','getClient','escapeEmailHtml',mailCode)(mailModule,mailModule.exports,()=>({domain:'example.test',client:{messages:{create:async(_:any,data:any)=>payload=data}}}),(v:string)=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));
await mailModule.exports.sendWebsiteRequestEmail({...notices[0],clientName:'<script>Example</script>',formName:'Quote\r\nInjected'});
assert.ok(payload.html.includes('&lt;script&gt;'));assert.ok(!payload.html.includes('<script>'));assert.ok(payload.html.includes('View request</a>'));assert.ok(payload.text.includes(notices[0].requestUrl));assert.ok(!payload.subject.includes('\n'));assert.deepEqual(payload.to,['owner@example.test']);
// Both public submission routes notify only after saving the request.
const routes=await fs.readFile('server/routes.ts','utf8');
for(const path of ['/api/public/forms/:companyId/:slug/submit','/api/public/booking-request/:companyId']){const start=routes.indexOf(`app.post("${path}"`);const end=routes.indexOf('\n  app.',start+5);const route=routes.slice(start,end<0?routes.indexOf('\n  return httpServer',start):end);assert.ok(route.includes('await notifyWebsiteRequest('));assert.ok(route.indexOf('await notifyWebsiteRequest(')>route.indexOf(path.includes('booking')?'await storage.createBookingRequest':'await storage.createQuoteFormSubmission'));}
console.log('PASS: company and permission-scoped recipients, active accounts, duplicate emails, form/booking deep links, isolated email failures, escaped email button and plain text, and both saved-request hooks. No external emails sent.');
