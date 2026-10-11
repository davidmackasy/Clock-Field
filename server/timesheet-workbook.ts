import fs from "node:fs/promises";
import path from "node:path";
import archiver from "archiver";
import {dateShift} from "../shared/payroll-cycle";

const escape = (value: unknown) => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const excelDate = (value: string) => (Date.parse(value + "T00:00:00Z") - Date.UTC(1899,11,30))/86400000;
const timeValue = (value: string) => value ? (Number(value.slice(0,2))*60+Number(value.slice(3)))/1440 : null;
function cell(xml: string, address: string, value: unknown, formula?: string, styleOverride?: string) {
  const pattern = new RegExp(`<x:c\\b(?=[^>]*\\br="${address}")[^>]*?(?:\\/>|>[\\s\\S]*?<\\/x:c>)`);
  const existing = xml.match(pattern)?.[0] || ""; const style = styleOverride || existing.match(/\bs="(\d+)"/)?.[1] || "1";
  const type = typeof value === "number" ? "n" : "str";
  const next = `<x:c r="${address}" s="${style}" t="${type}">${formula ? `<x:f>${escape(formula.replace(/^=/,""))}</x:f>` : ""}<x:v>${escape(value)}</x:v></x:c>`;
  return xml.replace(pattern,next);
}
async function templateParts(directory: string, relative = ""): Promise<Map<string,Buffer>> {
  const result = new Map<string,Buffer>();
  for(const item of await fs.readdir(path.join(directory,relative),{withFileTypes:true})) {
    const name=path.posix.join(relative,item.name);
    if(item.isDirectory()) for(const [key,value] of Array.from(await templateParts(directory,name)))result.set(key,value);
    else result.set(name,await fs.readFile(path.join(directory,name)));
  }
  return result;
}

/** Fill the Artifact Tool-authored template at runtime; styling and formulas stay intact. */
export async function createTimesheetWorkbook(snapshot: any): Promise<Buffer> {
  const parts = await templateParts(path.resolve(process.cwd(),"config/timesheet-template"));
  let template = parts.get("xl/worksheets/sheet1.xml")!.toString();
  const dayCount=Math.round((Date.parse(snapshot.period.end)-Date.parse(snapshot.period.start))/86400000)+1;
  const extra=dayCount-14;
  if(extra!==0){
    const rows=Array.from(template.matchAll(/<x:row\b[^>]*r="(\d+)"[^>]*>[\s\S]*?<\/x:row>/g));
    const shiftRow=(xml:string,from:number,to:number)=>xml.replace(new RegExp(`r="${from}"`),`r="${to}"`).replace(/r="([A-Z]+)(\d+)"/g,(_,col,num)=>`r="${col}${Number(num)+to-from}"`);
    const before=rows.filter(row=>Number(row[1])<7).map(row=>row[0]);
    const days=Array.from({length:dayCount},(_,day)=>{const original=rows.find(row=>Number(row[1])===7+day%14)!;return shiftRow(original[0],Number(original[1]),7+day);});
    const after=rows.filter(row=>Number(row[1])>20).map(row=>shiftRow(row[0],Number(row[1]),Number(row[1])+extra));
    template=template.replace(/<x:sheetData>[\s\S]*?<\/x:sheetData>/,`<x:sheetData>${[...before,...days,...after].join("")}</x:sheetData>`).replace(/(<x:mergeCell ref="[A-Z]+)(\d+):([A-Z]+)(\d+)("\s*\/>)/g,(all,a,b,c,d,e)=>Number(b)>20?`${a}${Number(b)+extra}:${c}${Number(d)+extra}${e}`:all);
  }
  const sourceTemplate = parts.get("xl/worksheets/sheet2.xml")!.toString();
  const drawingRelationships = parts.get("xl/worksheets/_rels/sheet1.xml.rels");
  const sourceHeader = sourceTemplate.match(/<x:row\b[^>]*r="1"[^>]*>[\s\S]*?<\/x:row>/)![0];
  let sourceData = sourceHeader; let sourceRow = 2;
  const names: string[] = [];
  for(const name of Array.from(parts.keys())) if(name.startsWith("xl/worksheets/"))parts.delete(name);
  const logo = snapshot.company.companyLogoUrl?.match(/^data:image\/png;base64,([\s\S]*)$/)?.[1];
  if(logo){for(const name of Array.from(parts.keys()))if(name.startsWith("xl/media/"))parts.set(name,Buffer.from(logo,"base64"));}
  else for(const name of Array.from(parts.keys()))if(name.startsWith("xl/media/")||name.startsWith("xl/drawings/"))parts.delete(name);
  for(let index=0;index<snapshot.employees.length;index++) {
    const employee = snapshot.employees[index];
    const name = `${employee.employeeNumber || index+1} ${employee.name}`.replace(/[\\/*?:\[\]]/g,"_").slice(0,27)+` ${index+1}`;
    names.push(name);let xml=template;
    xml=cell(xml,"B1",snapshot.company.name);xml=cell(xml,"C3",employee.name);xml=cell(xml,"C4",employee.employeeNumber);
    xml=cell(xml,"F3",excelDate(snapshot.period.start));xml=cell(xml,"F4",excelDate(snapshot.period.end));
    for(let day=0;day<dayCount;day++) {
      const date=dateShift(snapshot.period.start,day); const rows=employee.rows.filter((row:any)=>row.date===date&&row.id);
      const first=rows[0]; const last=rows.at(-1); const raw=rows.reduce((sum:number,row:any)=>sum+row.rawMinutes,0);const payable=rows.reduce((sum:number,row:any)=>sum+row.payableMinutes,0);
      const start=timeValue(first?.startTime||"");const end=timeValue(last?.endTime||"");
      const dayOffset=last?.endDate ? Math.round((Date.parse(last.endDate+"T12:00:00Z")-Date.parse(date+"T12:00:00Z"))/86400000):0;
      const values=[excelDate(date),employee.employeeNumber,first?.clockInAt ? (Date.parse(first.clockInAt)-Date.UTC(1899,11,30))/86400000:null,last?.clockOutAt ? (Date.parse(last.clockOutAt)-Date.UTC(1899,11,30))/86400000:null,raw,payable-raw,start??0,end===null?0:end+dayOffset,rows.map((row:any)=>row.id).join(", ")];
      const styles=Array.from({length:9},(_,column)=>Number(sourceTemplate.match(new RegExp(`<x:c\\b(?=[^>]*r="${String.fromCharCode(65+column)}2")[^>]*s="(\\d+)"`))?.[1] || 9));
      sourceData+=`<x:row r="${sourceRow}">${values.map((value:any,column:number)=>`<x:c r="${String.fromCharCode(65+column)}${sourceRow}" s="${styles[column]}" t="${typeof value==="number"?"n":"str"}"><x:v>${escape(value)}</x:v></x:c>`).join("")}</x:row>`;
      const row=day+7;
      const weekday=new Intl.DateTimeFormat("en-US",{timeZone:"UTC",weekday:"long"}).format(new Date(date+"T12:00:00Z"));
      const weekdayStyle=template.match(new RegExp(`<x:c\\b(?=[^>]*r="B${weekday==="Monday"?7:8}")[^>]*s="(\\d+)"`))?.[1];
      xml=cell(xml,`B${row}`,weekday,undefined,weekdayStyle);
      xml=cell(xml,`A${row}`,excelDate(date));xml=cell(xml,`C${row}`,start ?? "");xml=cell(xml,`D${row}`,end ?? "");
      const locations=Array.from(new Set(rows.map((value:any)=>value.location))).join("; ");
      xml=cell(xml,`F${row}`,locations);
      if(locations.length>42)xml=xml.replace(new RegExp(`<x:row\\b(?=[^>]*r="${row}")[^>]*>`),tag=>tag.replace(/\bht="[^"]*"/,`ht="${Math.max(25,Math.ceil(locations.length/42)*18)}"`));
      const formula=`IF(OR(C${row}="",D${row}=""),"",ROUND(MAX(0,MAX(0,('Recorded'!E${sourceRow}+'Recorded'!F${sourceRow})/60)+24*((D${row}+IF('Recorded'!E${sourceRow}=0,IF(D${row}<C${row},1,0),INT('Recorded'!H${sourceRow}))-C${row})-('Recorded'!H${sourceRow}-'Recorded'!G${sourceRow}))),4))`;
      xml=cell(xml,`E${row}`,rows.length?payable/60:"",formula);sourceRow++;
    }
    xml=cell(xml,`E${22+extra}`,employee.payableMinutes/60,`SUM(E7:E${20+extra})`);
    xml=cell(xml,`F${24+extra}`,snapshot.period.payday ? `Payday: ${snapshot.period.payday}` : "");xml=cell(xml,`F${25+extra}`,`${snapshot.company.timezone}${employee.pendingEntries ? `; unfinished shifts: ${employee.pendingEntries}` : ""}`);
    if(!logo)xml=xml.replace(/<x:drawing\b[^>]*\/>/,"");
    parts.set(`xl/worksheets/sheet${index+1}.xml`,Buffer.from(xml));
    if(logo&&drawingRelationships)parts.set(`xl/worksheets/_rels/sheet${index+1}.xml.rels`,drawingRelationships);
  }
  names.push("Recorded");
  const source=sourceTemplate.replace(/<x:sheetData>[\s\S]*?<\/x:sheetData>/,`<x:sheetData>${sourceData}</x:sheetData>`);
  parts.set(`xl/worksheets/sheet${names.length}.xml`,Buffer.from(source));
  parts.set("xl/workbook.xml",Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name,index)=>`<sheet name="${escape(name)}" sheetId="${index+1}" r:id="rIdSheet${index+1}"/>`).join("")}</sheets><definedNames>${names.slice(0,-1).map((name,index)=>`<definedName name="_xlnm.Print_Area" localSheetId="${index}">'${escape(name.replace(/'/g,"''"))}'!$A$1:$F$${25+extra}</definedName>`).join("")}</definedNames><calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`));
  const relationships=parts.get("xl/_rels/workbook.xml.rels")!.toString().replace(/<Relationship\b(?=[^>]*Type="[^"]*\/worksheet")[^>]*\/>/g,"").replace("</Relationships>",names.map((_,index)=>`<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet${index+1}.xml" Id="rIdSheet${index+1}"/>`).join("")+"</Relationships>");
  parts.set("xl/_rels/workbook.xml.rels",Buffer.from(relationships));
  let types=parts.get("[Content_Types].xml")!.toString().replace(/<Override\b(?=[^>]*PartName="\/xl\/worksheets\/sheet\d+\.xml")[^>]*\/>/g,"").replace("</Types>",names.map((_,index)=>`<Override PartName="/xl/worksheets/sheet${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")+"</Types>");
  if(!logo)types=types.replace(/<Override\b(?=[^>]*PartName="\/xl\/drawings\/[^"]*")[^>]*\/>/g,"");
  parts.set("[Content_Types].xml",Buffer.from(types));
  const archive=archiver("zip",{zlib:{level:6}});const chunks:Buffer[]=[];
  const completed=new Promise<Buffer>((resolve,reject)=>{archive.on("data",chunk=>chunks.push(chunk));archive.on("end",()=>resolve(Buffer.concat(chunks)));archive.on("error",reject);});
  for(const [name,value]of Array.from(parts))archive.append(value,{name});await archive.finalize();return completed;
}
