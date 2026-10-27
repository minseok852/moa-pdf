import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { getDocument, version } from 'pdfjs-dist/legacy/build/pdf.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const original=await PDFDocument.create();
const font=await original.embedFont(StandardFonts.Helvetica);
original.addPage([180,260]).drawText('Moa PDF preview check',{x:12,y:200,size:10,font});
const bytes=await original.save();
const task=getDocument({
  data:bytes,
  standardFontDataUrl:path.join(root,'node_modules','pdfjs-dist','standard_fonts')+path.sep,
  enableXfa:false,
});
try{
  const document=await task.promise;
  assert.equal(document.numPages,1);
  const page=await document.getPage(1);
  assert.equal(page.getViewport({scale:1}).width,180);
  const text=await page.getTextContent();
  assert.ok(text.items.some(item=>'str' in item&&item.str==='Moa PDF preview check'));
  console.log(`PDF.js ${version}: real PDF loading, text extraction and task cleanup passed.`);
}finally{
  await task.destroy();
}
