export type DocumentFormat = 'hwp' | 'hwpx' | 'docx' | 'pptx' | 'xlsx';
export const DOCUMENT_FORMATS: readonly DocumentFormat[] = ['hwp','hwpx','docx','pptx','xlsx'];
export const FILE_ACCEPT = '.png,.jpg,.jpeg,.pdf,.hwp,.hwpx,.docx,.pptx,.xlsx';
export function documentFormat(name: string): DocumentFormat | undefined {
  const extension = name.split('.').pop()?.toLowerCase();
  return DOCUMENT_FORMATS.find(format => format === extension);
}
export const isOfficeDocument = (name: string) => ['docx','pptx','xlsx'].includes(documentFormat(name) ?? '');
const invalid = () => new Error('문서 형식이 올바르지 않거나 지원하지 않는 압축 형식입니다.');
// Inspect the ZIP directory without inflating any entry. Engine workers perform actual parsing.
export function validateDocument(bytes: Uint8Array, format: DocumentFormat): void {
  if (format === 'hwp') {
    if (![0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((value,index) => bytes[index] === value)) throw invalid();
    return;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22 || view.getUint32(0,true) !== 0x04034b50) throw invalid();
  let end = bytes.length - 22;
  for (; end >= Math.max(0,bytes.length-65557); end--) {
    if (view.getUint32(end,true) === 0x06054b50 && end+22+view.getUint16(end+20,true) === bytes.length) break;
  }
  if (end < Math.max(0,bytes.length-65557)) throw invalid();
  const count=view.getUint16(end+10,true), length=view.getUint32(end+12,true), start=view.getUint32(end+16,true);
  if (view.getUint16(end+4,true) || view.getUint16(end+6,true) || view.getUint16(end+8,true)!==count ||
      !count || count>5000 || start+length!==end) throw invalid();
  let position=start, inflated=0;
  const names=new Set<string>();
  for(let i=0;i<count;i++){
    if(position+46>end || view.getUint32(position,true)!==0x02014b50)throw invalid();
    const flags=view.getUint16(position+8,true), method=view.getUint16(position+10,true);
    const compressed=view.getUint32(position+20,true), size=view.getUint32(position+24,true);
    const nameLength=view.getUint16(position+28,true), extra=view.getUint16(position+30,true), comment=view.getUint16(position+32,true);
    const offset=view.getUint32(position+42,true), next=position+46+nameLength+extra+comment;
    if(next>end || offset+30>start || view.getUint32(offset,true)!==0x04034b50)throw invalid();
    const name=new TextDecoder().decode(bytes.subarray(position+46,position+46+nameLength));
    const localNameLength=view.getUint16(offset+26,true), localExtra=view.getUint16(offset+28,true);
    const localName=new TextDecoder().decode(bytes.subarray(offset+30,offset+30+localNameLength));
    if(localName!==name || offset+30+localNameLength+localExtra+compressed>start ||
       flags&1 || ![0,8].includes(method) || name.startsWith('/') || name.includes('\\') ||
       name.split('/').includes('..') || names.has(name) || size>64*1024*1024)throw invalid();
    inflated+=size;
    if(inflated>128*1024*1024)throw new Error('문서의 압축 해제 용량이 너무 큽니다.');
    if(/(?:vbaProject\.bin|vbaData\.xml)$/i.test(name))throw new Error('매크로가 포함된 문서는 지원하지 않습니다.');
    names.add(name); position=next;
  }
  if(position!==end)throw invalid();
  const required={hwpx:['mimetype','Contents/header.xml','Contents/section0.xml'],docx:['[Content_Types].xml','word/document.xml'],pptx:['[Content_Types].xml','ppt/presentation.xml'],xlsx:['[Content_Types].xml','xl/workbook.xml']};
  if(!required[format].every(name=>names.has(name)))throw invalid();
}
