export function personalizePolicy(content: string, name: string, date: string) {
 return content.replace(/(\bI\s*,?\s*)[_＿]{3,}(?=\s*[,，]?\s*(?:acknowledge|understand|agree|confirm|certify|declare))/gi,(_,prefix)=>prefix+name).replace(/\{\{\s*(?:employee_?name|full_?name)\s*\}\}/gi,name).replace(/((?:Employee Name(?: Printed)?|Printed Name|Full Name)\s*:\s*)_+/gi,(_,label)=>label+name).replace(/(Date\s*:\s*)_+/gi,(_,label)=>label+date).replace(/((?:Employee )?Signature\s*:\s*)_+/gi,'$1[Signature recorded below]');
}
