// Synthetic, non-user OOXML documents for engine integration checks.
const encoder=new TextEncoder();
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
export function zip(files){
 const local=[],central=[];let offset=0;
 for(const[name,text]of Object.entries(files)){
  const n=encoder.encode(name),data=encoder.encode(text),header=new Uint8Array(30+n.length),v=new DataView(header.buffer),crc=crc32(data);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);header.set(n,30);local.push(header,data);
  const directory=new Uint8Array(46+n.length),d=new DataView(directory.buffer);
  d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,n.length,true);d.setUint32(42,offset,true);directory.set(n,46);central.push(directory);
  offset+=header.length+data.length;
 }
 const count=central.length,length=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
 e.setUint32(0,0x06054b50,true);e.setUint16(8,count,true);e.setUint16(10,count,true);e.setUint32(12,length,true);e.setUint32(16,offset,true);
 return Buffer.concat([...local,...central,end].map(x=>Buffer.from(x)));
}
const relationships=items=>'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+items.map(([id,type,target])=>'<Relationship Id="'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'+type+'" Target="'+target+'"/>').join('')+'</Relationships>';
const contentTypes=items=>'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+items.map(([part,type])=>'<Override PartName="/'+part+'" ContentType="application/vnd.openxmlformats-officedocument.'+type+'"/>').join('')+'</Types>';
const docx=zip({
 '[Content_Types].xml':contentTypes([['word/document.xml','wordprocessingml.document.main+xml'],['word/styles.xml','wordprocessingml.styles+xml']]),
 '_rels/.rels':relationships([['rId1','officeDocument','word/document.xml']]),
 'word/_rels/document.xml.rels':relationships([['rId1','styles','styles.xml']]),
 'word/styles.xml':'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="24"/></w:rPr></w:style></w:styles>',
 'word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>MOA DOCX 한글 문서 테스트</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblW w:w="6000" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>표 셀 하나</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Table cell two</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>'
});
const presentation='<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>';
const slide=number=>'<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="10363200" cy="3657600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="ko-KR" sz="3200"><a:solidFill><a:srgbClr val="27342e"/></a:solidFill><a:latin typeface="Noto Sans KR"/><a:ea typeface="Noto Sans KR"/></a:rPr><a:t>MOA PPTX '+number+' 한글 슬라이드</a:t></a:r><a:endParaRPr lang="ko-KR"/></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
const pptx=zip({
 '[Content_Types].xml':contentTypes([['ppt/presentation.xml','presentationml.presentation.main+xml'],['ppt/slides/slide1.xml','presentationml.slide+xml'],['ppt/slides/slide2.xml','presentationml.slide+xml']]),
 '_rels/.rels':relationships([['rId1','officeDocument','ppt/presentation.xml']]),
 'ppt/presentation.xml':presentation,
 'ppt/_rels/presentation.xml.rels':relationships([['rId1','slide','slides/slide1.xml'],['rId2','slide','slides/slide2.xml']]),
 'ppt/slides/slide1.xml':slide(1),'ppt/slides/slide2.xml':slide(2)
});
const sheet=number=>'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:B2"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols><col min="1" max="2" width="28" customWidth="1"/></cols><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>MOA XLSX '+number+'</t></is></c><c r="B1" t="inlineStr"><is><t>한글 셀</t></is></c></row><row r="2"><c r="A2"><v>42</v></c><c r="B2"><v>100</v></c></row></sheetData><pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1"/></worksheet>';
const xlsx=zip({
 '[Content_Types].xml':contentTypes([['xl/workbook.xml','spreadsheetml.sheet.main+xml'],['xl/worksheets/sheet1.xml','spreadsheetml.worksheet+xml'],['xl/worksheets/sheet2.xml','spreadsheetml.worksheet+xml']]),
 '_rels/.rels':relationships([['rId1','officeDocument','xl/workbook.xml']]),
 'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Sheet 1" sheetId="1" r:id="rId1"/><sheet name="Sheet 2" sheetId="2" r:id="rId2"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels':relationships([['rId1','worksheet','worksheets/sheet1.xml'],['rId2','worksheet','worksheets/sheet2.xml']]),
 'xl/worksheets/sheet1.xml':sheet(1),'xl/worksheets/sheet2.xml':sheet(2)
});
export const fixtures=[{format:'docx',bytes:docx,pages:1,text:'MOADOCX'},{format:'pptx',bytes:pptx,pages:2,text:'MOAPPTX'},{format:'xlsx',bytes:xlsx,pages:2,text:'MOAXLSX'}];
