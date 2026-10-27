export type Rect = { x: number; y: number; width: number; height: number };
export type Settings = {
  paper: 'a4' | 'a3' | 'letter' | 'original';
  orientation: 'auto' | 'portrait' | 'landscape';
  fit: 'contain' | 'cover';
  margin: number;
  quality: 'original' | 'balanced' | 'small';
  pageNumbers: boolean;
  filename: string;
  keepPdfSize: boolean;
};
export type PageItem = {
  id: string; sourceId: string; sourceName: string; sourceIndex: number;
  kind: 'image' | 'pdf'; width: number; height: number;
  thumbnail: string; rotation: number; crop?: Rect;
  settings?: Partial<Settings>;
};
export type SourceFile = {
  id: string; name: string; kind: 'image' | 'pdf'; bytes: Uint8Array;
  mime: string; url?: string;
};
export type ExportPage = PageItem & { imageBytes?: Uint8Array; imageMime?: string };
export const DEFAULT_SETTINGS: Settings = {
  paper: 'a4', orientation: 'auto', fit: 'contain', margin: 10,
  quality: 'original', pageNumbers: false, filename: '모아PDF', keepPdfSize: true,
};
export const LIMITS = { fileBytes: 40 * 1024 * 1024, totalBytes: 120 * 1024 * 1024, pages: 200 };

