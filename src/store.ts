import { create } from 'zustand';
import { DEFAULT_SETTINGS } from './types';
import type { PageItem, Settings, SourceFile } from './types';
type Snapshot = { pages: PageItem[]; settings: Settings };
type Store = Snapshot & {
  sources: Record<string, SourceFile>; selected: string[];
  past: Snapshot[]; future: Snapshot[];
  commit: (pages: PageItem[]) => void;
  configure: (settings: Settings) => void;
  add: (pages: PageItem[], sources: SourceFile[], at?: number) => void;
  select: (ids: string[]) => void;
  undo: () => void; redo: () => void; reset: () => void;
  restoreWorkspace: (workspace: Snapshot & { sources: Record<string, SourceFile> }) => void;
};
const snapshot = (s: Snapshot): Snapshot => ({ pages:s.pages, settings:s.settings });
export const useEditor = create<Store>((set) => ({
  pages: [], settings: DEFAULT_SETTINGS, sources: {}, selected: [], past: [], future: [],
  commit: (pages) => set(s => ({ pages, past: [...s.past.slice(-39), snapshot(s)], future: [], selected: s.selected.filter(id => pages.some(p => p.id === id)) })),
  configure: (settings) => set(s => ({ settings, past: [...s.past.slice(-39), snapshot(s)], future: [] })),
  add: (pages, sources, at) => set(s => ({ pages: [...s.pages.slice(0,at ?? s.pages.length), ...pages, ...s.pages.slice(at ?? s.pages.length)], sources: { ...s.sources, ...Object.fromEntries(sources.map(f => [f.id, f])) }, past: [...s.past.slice(-39), snapshot(s)], future: [] })),
  select: (selected) => set({ selected }),
  undo: () => set(s => s.past.length ? ({ ...s.past.at(-1)!, past: s.past.slice(0, -1), future: [snapshot(s), ...s.future], selected: [] }) : {}),
  redo: () => set(s => s.future.length ? ({ ...s.future[0], future: s.future.slice(1), past: [...s.past, snapshot(s)], selected: [] }) : {}),
  restoreWorkspace: (workspace) => set({ ...workspace, selected:[], past:[], future:[] }),
  reset: () => set({ pages:[], sources:{}, selected:[], past:[], future:[], settings:DEFAULT_SETTINGS }),
}));
