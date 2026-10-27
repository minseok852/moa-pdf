import type { PageItem, Rect, Settings } from './types';
export const MM = 72 / 25.4;
export const modRotation = (r: number) => ((r % 360) + 360) % 360;
export function contentSize(page: Pick<PageItem, 'width' | 'height' | 'crop' | 'rotation'>) {
  const width = page.width * (page.crop?.width ?? 1);
  const height = page.height * (page.crop?.height ?? 1);
  return modRotation(page.rotation) % 180 ? { width: height, height: width } : { width, height };
}
export function paperSize(settings: Settings, size: { width: number; height: number }, kind: 'image' | 'pdf' = 'image') {
  if (settings.paper === 'original' || (kind === 'pdf' && settings.keepPdfSize)) {
    const scale = kind === 'image' ? 72 / 150 : 1;
    return { width: size.width * scale, height: size.height * scale };
  }
  const dims = { a4: [210 * MM, 297 * MM], a3: [297 * MM, 420 * MM], letter: [612, 792] }[settings.paper];
  const landscape = settings.orientation === 'landscape' || (settings.orientation === 'auto' && size.width > size.height);
  return { width: dims[landscape ? 1 : 0], height: dims[landscape ? 0 : 1] };
}
export function placement(content: { width: number; height: number }, paper: { width: number; height: number }, marginMm: number, fit: Settings['fit']) {
  const margin = Math.min(marginMm * MM, paper.width / 3, paper.height / 3);
  const availableWidth = paper.width - 2 * margin;
  const availableHeight = paper.height - 2 * margin;
  const scale = (fit === 'cover' ? Math.max : Math.min)(availableWidth / content.width, availableHeight / content.height);
  const width = content.width * scale, height = content.height * scale;
  return { left: (paper.width - width) / 2, bottom: (paper.height - height) / 2, width, height, margin, availableWidth, availableHeight, scale };
}
export function pdfCropBox(box: { x: number; y: number; width: number; height: number }, rotation: number, crop?: Rect) {
  if (!crop) return box;
  const map = (u: number, v: number) => {
    switch (modRotation(rotation)) {
      case 90: return [box.x + v * box.width, box.y + u * box.height];
      case 180: return [box.x + (1 - u) * box.width, box.y + v * box.height];
      case 270: return [box.x + (1 - v) * box.width, box.y + (1 - u) * box.height];
      default: return [box.x + u * box.width, box.y + (1 - v) * box.height];
    }
  };
  const a = map(crop.x, crop.y), b = map(crop.x + crop.width, crop.y + crop.height);
  return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.abs(a[0] - b[0]), height: Math.abs(a[1] - b[1]) };
}

