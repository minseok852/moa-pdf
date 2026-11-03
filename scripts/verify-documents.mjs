// Engine integration checks in Node. This is not a browser/CSP or full-fidelity test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createSubprocessConverter } from '@matbee/libreoffice-converter/server';
import { fixtures } from './document-fixtures.mjs';
const root=new URL('../',import.meta.url);
const fonts=['NotoSansKR-Regular.otf','NotoSerifKR-Regular.otf'].map(filename=>({filename,data:new Uint8Array(readFileSync(new URL('public/documents/fonts/'+filename,root)))}));
async function inspect(bytes,expectedPages,text){
 const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),expectedPages);
 const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:false});
 try{
  const document=await task.promise,page=await document.getPage(1);
  const operators=await page.getOperatorList();assert.ok(operators.fnArray.length>10,'PDF must contain painted content');
  if(text){const content=await page.getTextContent();const value=content.items.filter(item=>'str'in item).map(item=>item.str).join('').replace(/\s/g,'');assert.ok(value.includes(text),'Expected text missing: '+text+' in '+value);assert.ok(value.includes('한글'),'Korean text missing');}
 }finally{await task.destroy();}
}
const context={console,WebAssembly,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,Response,Request,URL,fetch};
context.self=context;vm.createContext(context);
vm.runInContext(readFileSync(new URL('public/documents/hwp/0.2.2/rhwptopdf.umd.js',root),'utf8'),context);
const hwp=context.RhwpToPdf;
assert.equal(typeof hwp,'function');
await hwp({module_or_path:readFileSync(new URL('public/documents/hwp/0.2.2/rhwptopdf.umd_bg.wasm',root))});
for(const font of fonts)hwp.registerPdfFont(font.data);
const upstream='https://raw.githubusercontent.com/edwardkim/rhwp/1a76570e833917d15817415a53c09ad61ab3203f/';
for(const sample of [
 {format:'hwp',path:'tests/fixtures/issue_7076/ship-collision-analysis-form.hwp',sha:'c62790c111c2ba538da0052a9892a4823a9ad2a3'},
 {format:'hwpx',path:'tests/fixtures/form-password/edit-password.hwpx',sha:'695641faac09b6636f3678b46a9ce5a93ff4f8ff'}
]){
 const response=await fetch(upstream+sample.path);if(!response.ok)throw new Error('Fixture download failed '+response.status);
 const bytes=new Uint8Array(await response.arrayBuffer());
 assert.equal(createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),sample.sha);
 const analysis=hwp.analyzeHwp(bytes);assert.ok(analysis.pageCount>0&&analysis.pageCount<=200);
 const output=hwp.hwpToPdf(bytes);await inspect(output,analysis.pageCount);
 console.log(sample.format+': real fixture → '+analysis.pageCount+' PDF page(s), painted content verified.');
}
const converter=await createSubprocessConverter({fonts});
try{
 for(const fixture of fixtures){
  const result=await converter.convert(fixture.bytes,{outputFormat:'pdf'},'sample.'+fixture.format);
  await inspect(result.data,fixture.pages,fixture.text);
  console.log(fixture.format+': synthetic document → '+fixture.pages+' PDF page(s), expected text verified.');
 }
}finally{await converter.destroy();}
console.log('All five document format engines passed basic conversion checks.');
