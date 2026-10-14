import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { transform } from 'esbuild';
import { validateForm, formName, validFormConfig } from '../shared/form-validation';
import { DEFAULT_FORM_CONFIG, SMART_CLEANING_CONFIG } from '../shared/schema';
const source = await fs.readFile('server/routes.ts','utf8');
const config:any={steps:[{enabled:true,fields:[
 {id:'email',label:'Email',type:'email',required:true,enabled:true},
 {id:'hours',label:'Hours',type:'number',required:true,enabled:true},
 {id:'consent',label:'Consent',type:'checkbox',required:true,enabled:true},
 {id:'kind',label:'Kind',type:'select',options:['A'],enabled:true},
 {id:'date',label:'Date',type:'date',enabled:true},
 {id:'hidden',label:'Hidden',type:'text',required:true,enabled:true,showWhenField:'kind',showWhenValues:['B']}
]}]};
assert.deepEqual(validateForm(config,{email:'cleaner@example.com',hours:0,consent:true,kind:'A',date:'2026-10-12'}),{});
for(const [key,value] of [['email','bad'],['hours','NaN'],['consent','true'],['kind','invalid'],['date','2026-02-30']]) assert.ok(validateForm(config,{email:'a@example.com',hours:0,consent:true,[key as string]:value})[key as string]);
assert.equal(formName('  New request  '),'New request');assert.equal(formName(' '),null);
let writes:any[]=[];
const storage:any={
 getQuoteForm:async()=>({id:'form',companyId:'company',config:JSON.stringify(DEFAULT_FORM_CONFIG)}),
 updateQuoteForm:async(id:any,data:any)=>{writes.push(data);return{id,...data,config:JSON.stringify(DEFAULT_FORM_CONFIG)};},
 getQuoteFormSubmission:async()=>({id:'submission',formId:'another',companyId:'foreign'}),
 updateQuoteFormSubmission:async()=>{writes.push('submission');},
 getQuoteFormBySlug:async()=>({id:'form',companyId:'company',isActive:true,config:JSON.stringify(SMART_CLEANING_CONFIG)}),
 createQuoteFormSubmission:async(data:any)=>{writes.push(data);return{id:'submission',...data};},
 addLeadActivity:async()=>{},getFormEmailSettings:async()=>null,getCompany:async()=>({name:'Example'}),
 getBookingRequest:async()=>({companyId:'foreign'}),
 getBookingQuote:async()=>({id:'quote',companyId:'company',bookingRequestId:'booking',status:'draft',email:'a@example.com',clientName:'Example',serviceAddress:'Street',price:'100'}),
 updateBookingQuote:async()=>{writes.push('quote');},updateBookingRequest:async()=>{writes.push('booking');}
};
async function handler(method:string,path:string){
 const start=source.indexOf(`  app.${method}("${path}"`);assert.ok(start>=0,path);
 let end=source.indexOf('\n  app.',start+5);if(end<0)end=source.indexOf('\n  return httpServer',start);
 const code=(await transform(source.slice(start,end),{loader:'ts'})).code;
 let fn:any;
 const app:any={[method]:(_path:any,...args:any[])=>fn=args.at(-1)};
 new Function('app','storage','requireAuth','requireRole','validateForm','formName','validFormConfig','maybeUpgradeSmartConfig','sendBookingQuoteEmail','notifyWebsiteRequest',code)(app,storage,()=>{},()=>()=>{},validateForm,formName,validFormConfig,async(f:any)=>f.config,async()=>{throw Error('Simulated email outage');},async()=>{});
 return fn;
}
function response(){return {code:200,body:null as any,status(n:number){this.code=n;return this;},json(body:any){this.body=body;return this;}};}
const req:any={user:{id:'admin',companyId:'company'},params:{id:'form',formId:'form',companyId:'company',slug:'form',quoteId:'quote'},body:{name:'Renamed form'},protocol:'https',hostname:'example.com'};
let res=response();await(await handler('patch','/api/admin/quote-forms/:id'))(req,res);assert.equal(res.code,200);assert.equal(writes[0].name,'Renamed form');assert.ok(!('slug' in writes[0]));writes=[];
res=response();await(await handler('patch','/api/admin/quote-forms/:formId/submissions/:id'))({...req,body:{status:'contacted'}},res);assert.equal(res.code,404);assert.equal(writes.length,0);
res=response();await(await handler('post','/api/public/forms/:companyId/:slug/submit'))({...req,body:{}},res);assert.equal(res.code,400);assert.equal(writes.length,0);
const valid:any={firstName:'Example',lastName:'Customer',email:'customer@example.com',propertyType:'Residential',serviceType:'Regular Cleaning',frequencyType:'One-time',serviceAddress:'123 Example St',city:'Winnipeg',province:'MB',consent:true};
res=response();await(await handler('post','/api/public/forms/:companyId/:slug/submit'))({...req,body:valid},res);assert.equal(res.code,200);assert.equal(writes[0].serviceAddress,'123 Example St, Winnipeg, MB');writes=[];
let next=false;res=response();await(await handler('use','/api/booking-requests/:id'))(req,res,()=>next=true);assert.equal(res.code,404);assert.equal(next,false);
res=response();await(await handler('post','/api/booking-requests/:id/quotes/:quoteId/send'))({...req,params:{id:'booking',quoteId:'quote'}},res);assert.equal(res.code,502);assert.equal(writes.length,0);
res=response();await(await handler('post','/api/booking-requests/:id/quotes/:quoteId/send'))({...req,params:{id:'other',quoteId:'quote'}},res);assert.equal(res.code,404);assert.equal(writes.length,0);
console.log('PASS: required/conditional field validation; zero numeric inputs; email/select/date validation; stable renamed links; cross-company/form protection; CRM service address; failed quote email preserves status and mismatched quote cannot send. All records and email are isolated fixtures.');
assert.equal(validFormConfig(DEFAULT_FORM_CONFIG),true);
assert.equal(validFormConfig(SMART_CLEANING_CONFIG),true);
assert.equal(validFormConfig({steps:[]}),false);
assert.equal(validFormConfig({steps:[{id:'test',title:'Test',enabled:true,fields:[{id:'__proto__',label:'Bad',type:'text',enabled:true,required:false}]}]}),false);
// Test the actual mail adapter without contacting Mailgun.
const mailSource=await fs.readFile('server/mail.ts','utf8');
const mailCode=(await transform(mailSource.slice(mailSource.indexOf('export async function sendFormConfirmationEmail')), {loader:'ts',format:'cjs'})).code;
let message:any;const module={exports:{} as any};
new Function('module','exports','getClient',mailCode)(module,module.exports,()=>({domain:'example.com',client:{messages:{create:async(_domain:any,data:any)=>message=data}}}));
await module.exports.sendFormConfirmationEmail({to:'customer@example.com',subject:'Request received',companyName:'Example & Company',body:'Thanks <customer>\nWe received your request.'});
assert.equal(message.subject,'Request received');assert.equal(message.text,'Thanks <customer>\nWe received your request.');assert.ok(message.html.includes('&lt;customer&gt;'));assert.ok(message.html.includes('Example &amp; Company'));assert.ok(!message.html.includes('undefined'));
console.log('PASS: form configurations and actual confirmation-mail payload with escaped HTML and preserved plain text.');
