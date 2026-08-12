import { create } from 'zustand';
import type { View, ScanResult, GroupStatus, GroupFilter, GroupSort } from '../types';

interface PersistedLibraryState {
  view: View;
  scanRoot: string | null;
  recentFolders: string[];
  comparedGroupIds: string[];
  browseQuery: string;
  browseFilter: GroupFilter;
  browseSort: GroupSort;
}

function loadPersisted(): PersistedLibraryState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('omniraw.library-session.v1') ?? 'null');
  } catch {
    return null;
  }
}

const persisted = loadPersisted();

interface LibraryState {
  view: View;
  scanRoot: string | null;
  scanResult: ScanResult | null;
  scanning: boolean;
  scanProgress: number;
  recentFolders: string[];
  comparedGroupIds: Set<string>;
  browseQuery: string;
  browseFilter: GroupFilter;
  browseSort: GroupSort;
  setView: (view: View) => void;
  startScan: () => void;
  setScanProgress: (scannedFiles: number) => void;
  setScanResult: (result: ScanResult) => void;
  scanFailed: () => void;
  toggleCompared: (groupId: string) => void;
  clearCompared: () => void;
  forgetRecent: (root: string) => void;
  setBrowseQuery: (query: string) => void;
  setBrowseFilter: (filter: GroupFilter) => void;
  setBrowseSort: (sort: GroupSort) => void;
  /** Removes trashed files from groups in place — no rescan needed. */
  applyDeletions: (trashedPaths: string[]) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  view: persisted?.view ?? 'welcome',
  scanRoot: persisted?.scanRoot ?? null,
  scanResult: null,
  scanning: false,
  scanProgress: 0,
  recentFolders: persisted?.recentFolders ?? [],
  comparedGroupIds: new Set(persisted?.comparedGroupIds ?? []),
  browseQuery: persisted?.browseQuery ?? '',
  browseFilter: persisted?.browseFilter ?? 'all',
  browseSort: persisted?.browseSort ?? 'nameAsc',
  setView: (view) => set({ view }),
  startScan: () => set({ scanning: true, scanProgress: 0 }),
  setScanProgress: (scannedFiles) => set({ scanProgress: scannedFiles }),
  setScanResult: (result) =>
    set((s) => ({
      scanRoot: result.root,
      scanResult: result,
      scanning: false,
      recentFolders: [result.root, ...s.recentFolders.filter((root) => root !== result.root)].slice(0, 8),
      comparedGroupIds: new Set(
        [...s.comparedGroupIds].filter((id) => result.groups.some((group) => group.id === id)),
      ),
      // Opening a new/different folder jumps to Browse; an in-place refresh of
      // the same root keeps the user on whatever screen they were on.
      view: s.scanRoot === result.root ? s.view : 'browse',
    })),
  scanFailed: () => set((state) => ({ scanning: false, view: state.scanResult ? state.view : 'welcome' })),
  toggleCompared: (groupId) =>
    set((s) => {
      const next = new Set(s.comparedGroupIds);
      if (next.has(groupId)) next.delete(groupId);
      else if (next.size < 4) next.add(groupId);
      return { comparedGroupIds: next };
    }),
  clearCompared: () => set({ comparedGroupIds: new Set() }),
  forgetRecent: (root) =>
    set((state) => ({
      recentFolders: state.recentFolders.filter((candidate) => candidate !== root),
      scanRoot: state.scanRoot === root && !state.scanResult ? null : state.scanRoot,
    })),
  setBrowseQuery: (browseQuery) => set({ browseQuery }),
  setBrowseFilter: (browseFilter) => set({ browseFilter }),
  setBrowseSort: (browseSort) => set({ browseSort }),
  applyDeletions: (trashedPaths) =>
    set((s) => {
      if (!s.scanResult || trashedPaths.length === 0) return {};
      const removed = new Set(trashedPaths);
      const groups = s.scanResult.groups
        .map((g) => ({
          ...g,
          raws: g.raws.filter((f) => !removed.has(f.path)),
          others: g.others.filter((f) => !removed.has(f.path)),
        }))
        .filter((g) => g.raws.length + g.others.length > 0)
        .map((g) => {
          const status: GroupStatus =
            g.raws.length > 0 && g.others.length > 0
              ? 'complete'
              : g.raws.length > 0
                ? 'rawOnly'
                : 'nonRawOnly';
          return { ...g, status };
        });
      const presentIds = new Set(groups.map((group) => group.id));
      return {
        scanResult: { ...s.scanResult, groups },
        comparedGroupIds: new Set([...s.comparedGroupIds].filter((id) => presentIds.has(id))),
      };
    }),
}));

if (typeof localStorage !== 'undefined') {
  useLibraryStore.subscribe((state) => {
    const value: PersistedLibraryState = {
      view: state.view,
      scanRoot: state.scanRoot,
      recentFolders: state.recentFolders,
      comparedGroupIds: [...state.comparedGroupIds],
      browseQuery: state.browseQuery,
      browseFilter: state.browseFilter,
      browseSort: state.browseSort,
    };
    localStorage.setItem('omniraw.library-session.v1', JSON.stringify(value));
  });
}
