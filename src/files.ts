import { GlobalWorkerOptions, getDocument, PasswordResponses, version } from 'pdfjs-dist';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PageItem, SourceFile } from './types';
GlobalWorkerOptions.workerSrc = workerUrl;
const documents = new Map<string, PDFDocumentLoadingTask>();
export const pdfDocument = (source: SourceFile) => {
  if (!documents.has(source.id)) {
    const assets=new URL(`${import.meta.env.BASE_URL}pdfjs/${version}/`,window.location.href).href;
    const task = getDocument({ data: source.bytes.slice(),cMapUrl:assets+'cmaps/',cMapPacked:true,standardFontDataUrl:assets+'standard_fonts/',wasmUrl:assets+'wasm/',iccUrl:assets+'iccs/',enableXfa:false });
    task.onPassword = (_update: (password: string) => void, reason: number) => {
      task.destroy();
      if (reason === PasswordResponses.NEED_PASSWORD) console.info('Encrypted PDF was excluded.');
    };
    documents.set(source.id, task);
  }
  return documents.get(source.id)!.promise;
};
export function releasePdfDocument(id: string) {
  const pending = documents.get(id);
  if (pending) void pending.destroy().catch(()=>{});
  documents.delete(id);
}
export function clearPdfCache() {
  for (const task of documents.values()) void task.destroy().catch(()=>{});
  documents.clear();
}
export async function readImage(url: string) {
  const image = new Image();
  image.src = url; await image.decode(); return image;
}
export async function renderPdfPage(source: SourceFile, index: number, maxSize = 1000) {
  const document = await pdfDocument(source), page = await document.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const surface = window.document.createElement('canvas');
  const scale = Math.min(maxSize / Math.max(base.width, base.height), 4);
  const viewport = page.getViewport({ scale });
  surface.width = Math.ceil(viewport.width); surface.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: surface.getContext('2d')!, viewport, canvas: surface, background: 'rgb(255,255,255)' }).promise;
  return { url: surface.toDataURL('image/jpeg', .88), width: base.width, height: base.height };
}
export async function importFile(file: File): Promise<{ source: SourceFile; pages: PageItem[] }> {
  const ext = file.name.split('.').at(-1)?.toLowerCase();
  if (!['pdf', 'png', 'jpg', 'jpeg'].includes(ext ?? '')) throw new Error('PNG, JPG, JPEG, PDF 파일을 선택해 주세요.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png=[137,80,78,71,13,10,26,10];
  const valid=ext==='pdf'?new TextDecoder('latin1').decode(bytes.subarray(0,1024)).includes('%PDF-'):ext==='png'?png.every((value,index)=>bytes[index]===value):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!valid)throw new Error('파일 확장자와 실제 형식이 일치하지 않습니다.');
  const kind = ext === 'pdf' ? 'pdf' : 'image';
  const source: SourceFile = { id: crypto.randomUUID(), name: file.name, kind, bytes, mime: kind === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg' };
  const base = { sourceId: source.id, sourceName: source.name, kind, rotation: 0 } as const;
  if (kind === 'pdf') {
   try {
    const { PDFDocument } = await import('pdf-lib');
    try { await PDFDocument.load(bytes.slice()); }
    catch (e) { if (String(e).toLowerCase().includes('encrypt')) throw new Error('비밀번호·암호화 PDF는 아직 지원하지 않습니다. 잠금을 해제한 사본을 선택해 주세요.'); throw new Error('PDF를 읽을 수 없습니다. 파일이 손상되지 않았는지 확인해 주세요.'); }
    const doc = await pdfDocument(source);
    if (doc.numPages > 200) throw new Error('한 PDF는 최대 200쪽까지 불러올 수 있습니다.');
    const pages: PageItem[] = [];
    for (let i = 0; i < doc.numPages; i++) {
      const preview = await renderPdfPage(source, i, 330);
      pages.push({ ...base, id: crypto.randomUUID(), sourceIndex: i, width: preview.width, height: preview.height, thumbnail: preview.url });
    }
    return { source, pages };
   } catch(error) { releasePdfDocument(source.id); throw error; }
  }
  const objectUrl = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: source.mime }));
  try {
    const image = await readImage(objectUrl);
    if (image.naturalWidth * image.naturalHeight > 60_000_000) throw new Error('이미지가 너무 큽니다. 6,000만 화소 이하로 줄여 주세요.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(360 / Math.max(image.naturalWidth, image.naturalHeight), 1);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    source.url = objectUrl;
    return { source, pages: [{ ...base, id: crypto.randomUUID(), sourceIndex: 0, width: image.naturalWidth, height: image.naturalHeight, thumbnail: canvas.toDataURL('image/jpeg', .85) }] };
  } catch (e) { URL.revokeObjectURL(objectUrl); throw e; }
}
export async function sourcePreview(source: SourceFile, page: PageItem, maxSize = 1500) {
  return source.kind === 'image' ? source.url! : (await renderPdfPage(source, page.sourceIndex, maxSize)).url;
}
export async function prepareImage(source: SourceFile, page: PageItem, quality: 'original' | 'balanced' | 'small') {
  if (quality === 'original' && !page.crop && !page.rotation && source.mime === 'image/png') return { bytes: source.bytes, mime: 'image/png' };
  const image = await readImage(source.url!);
  const crop = page.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const width = Math.max(1, Math.round(image.naturalWidth * crop.width));
  const height = Math.max(1, Math.round(image.naturalHeight * crop.height));
  const scale = quality === 'original' ? 1 : Math.min(1, (quality === 'balanced' ? 2400 : 1400) / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  const sideways = page.rotation % 180 !== 0;
  canvas.width = sideways ? h : w; canvas.height = sideways ? w : h;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(page.rotation * Math.PI / 180);
  ctx.drawImage(image, crop.x * image.naturalWidth, crop.y * image.naturalHeight, width, height, -w / 2, -h / 2, w, h);
  const mime = quality === 'original' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('이미지 변환에 실패했습니다.')), mime, quality === 'small' ? .65 : .85));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime };
}

