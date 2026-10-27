import type { PageItem, Settings } from './types';
export type PageSettings = Pick<Settings, 'paper' | 'orientation' | 'fit' | 'margin' | 'keepPdfSize'>;
export const PAGE_SETTING_KEYS = ['paper', 'orientation', 'fit', 'margin', 'keepPdfSize'] as const;
export type SizingMode = 'images' | 'all' | 'original';
export function sizingMode(settings: Pick<Settings, 'paper' | 'keepPdfSize'>): SizingMode {
  return settings.paper === 'original' ? 'original' : settings.keepPdfSize ? 'images' : 'all';
}
export function sizingPatch(mode: SizingMode, paper: Settings['paper']): Partial<PageSettings> {
  return { paper: mode === 'original' ? 'original' : paper === 'original' ? 'a4' : paper, keepPdfSize: mode !== 'all' };
}
export function mixedSettings(pages: PageItem[], settings: Settings) {
  const values = pages.map(page => ({ ...settings, ...page.settings }));
  return PAGE_SETTING_KEYS.filter(key => values.some(value => value[key] !== values[0]?.[key]));
}
export function patchPageSettings(pages: PageItem[], ids: string[], patch: Partial<PageSettings>) {
  if (!Object.keys(patch).length) return pages;
  const chosen = new Set(ids);
  return pages.map(page => chosen.has(page.id) ? { ...page, settings: { ...page.settings, ...patch } } : page);
}
// The insertion slot refers to the original list, before selected pages are removed.
export function reorderPages(pages: PageItem[], ids: string[], slot: number): PageItem[] {
  const selected = new Set(ids);
  const moving = pages.filter(page => selected.has(page.id));
  if (!moving.length) return pages;
  const boundary = Math.max(0, Math.min(pages.length, slot));
  const insertion = pages.slice(0, boundary).filter(page => !selected.has(page.id)).length;
  const remaining = pages.filter(page => !selected.has(page.id));
  const result = [...remaining.slice(0, insertion), ...moving, ...remaining.slice(insertion)];
  return result.every((page, index) => page.id === pages[index].id) ? pages : result;
}
