import { PDFDocument, StandardFonts, degrees, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } from 'pdf-lib';
import type { ExportPage, Settings, SourceFile } from './types';
import { contentSize, paperSize, placement, pdfCropBox, modRotation } from './layout';
export async function buildPdf(pages: ExportPage[], sources: Record<string, SourceFile>, settings: Settings, progress?: (n: number) => void) {
  if (!pages.length) throw new Error('페이지를 추가해 주세요.');
  const output = await PDFDocument.create();
  output.setTitle(settings.filename); output.setCreator('모아PDF'); output.setProducer('모아PDF / pdf-lib');
  const cache = new Map<string, PDFDocument>();
  const font = await output.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages.length; index++) {
    const item = pages[index], opts = { ...settings, ...item.settings };
    const source = sources[item.sourceId];
    if (!source) throw new Error('원본 파일을 찾을 수 없습니다.');
    const size = contentSize(item), paper = paperSize(opts, size, item.kind);
    let page;
    if (item.kind === 'pdf') {
      if (!cache.has(source.id)) cache.set(source.id, await PDFDocument.load(source.bytes));
      const doc = cache.get(source.id)!, original = doc.getPage(item.sourceIndex);
      const rotation = modRotation(original.getRotation().angle + item.rotation);
      const crop = pdfCropBox(original.getCropBox(), original.getRotation().angle, item.crop);
      if (opts.paper === 'original' || opts.keepPdfSize) {
        [page] = await output.copyPages(doc, [item.sourceIndex]);
        page.setCropBox(crop.x, crop.y, crop.width, crop.height); page.setRotation(degrees(rotation)); output.addPage(page);
      } else {
        page = output.addPage([paper.width, paper.height]);
        if (original.node.Contents()) {
        const embedded = await output.embedPage(original, { left: crop.x, bottom: crop.y, right: crop.x + crop.width, top: crop.y + crop.height });
        const pos = placement(size, paper, opts.margin, opts.fit);
        const scaledWidth = embedded.width * pos.scale, scaledHeight = embedded.height * pos.scale;
        let x = pos.left, y = pos.bottom;
        if (rotation === 90) y += scaledWidth;
        else if (rotation === 180) { x += scaledWidth; y += scaledHeight; }
        else if (rotation === 270) x += scaledHeight;
        page.pushOperators(pushGraphicsState(), rectangle(pos.margin, pos.margin, pos.availableWidth, pos.availableHeight), clip(), endPath());
        page.drawPage(embedded, { x, y, width: scaledWidth, height: scaledHeight, rotate: degrees(-rotation) });
        page.pushOperators(popGraphicsState());
        }
      }
    } else {
      if (!item.imageBytes) throw new Error('이미지를 준비하지 못했습니다.');
      const image = item.imageMime === 'image/png' ? await output.embedPng(item.imageBytes) : await output.embedJpg(item.imageBytes);
      page = output.addPage([paper.width, paper.height]);
      const pos = placement(size, paper, opts.paper === 'original' ? 0 : opts.margin, opts.fit);
      page.pushOperators(pushGraphicsState(), rectangle(pos.margin, pos.margin, pos.availableWidth, pos.availableHeight), clip(), endPath());
      page.drawImage(image, { x: pos.left, y: pos.bottom, width: pos.width, height: pos.height });
      page.pushOperators(popGraphicsState());
    }
    if (settings.pageNumbers) {
      const text = String(index + 1), fontSize = 10;
      const crop = page.getCropBox();
      const angle = modRotation(page.getRotation().angle);
      const w = angle % 180 ? crop.height : crop.width;
      const tx = (w - font.widthOfTextAtSize(text, fontSize)) / 2, ty = 12;
      let x = crop.x + tx, y = crop.y + ty;
      if (angle === 90) { x = crop.x + crop.width - ty; y = crop.y + tx; }
      if (angle === 180) { x = crop.x + crop.width - tx; y = crop.y + crop.height - ty; }
      if (angle === 270) { x = crop.x + ty; y = crop.y + crop.height - tx; }
      page.drawText(text, { x, y, size: fontSize, font, color: rgb(.35, .36, .4), rotate: degrees(angle) });
    }
    progress?.((index + 1) / pages.length);
  }
  return output.save();
}

