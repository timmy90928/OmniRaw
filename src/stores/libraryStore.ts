import { create } from 'zustand';
import type { View, ScanResult, GroupStatus } from '../types';

interface LibraryState {
  view: View;
  scanRoot: string | null;
  scanResult: ScanResult | null;
  scanning: boolean;
  scanProgress: number;
  comparedGroupIds: Set<string>;
  setView: (view: View) => void;
  startScan: () => void;
  setScanProgress: (scannedFiles: number) => void;
  setScanResult: (result: ScanResult) => void;
  scanFailed: () => void;
  toggleCompared: (groupId: string) => void;
  clearCompared: () => void;
  /** Removes trashed files from groups in place — no rescan needed. */
  applyDeletions: (trashedPaths: string[]) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  view: 'welcome',
  scanRoot: null,
  scanResult: null,
  scanning: false,
  scanProgress: 0,
  comparedGroupIds: new Set(),
  setView: (view) => set({ view }),
  startScan: () => set({ scanning: true, scanProgress: 0 }),
  setScanProgress: (scannedFiles) => set({ scanProgress: scannedFiles }),
  setScanResult: (result) =>
    set((s) => ({
      scanRoot: result.root,
      scanResult: result,
      scanning: false,
      // Opening a new/different folder jumps to Browse; an in-place refresh of
      // the same root keeps the user on whatever screen they were on.
      view: s.scanRoot === result.root ? s.view : 'browse',
    })),
  scanFailed: () => set({ scanning: false }),
  toggleCompared: (groupId) =>
    set((s) => {
      const next = new Set(s.comparedGroupIds);
      if (next.has(groupId)) next.delete(groupId);
      else if (next.size < 4) next.add(groupId);
      return { comparedGroupIds: next };
    }),
  clearCompared: () => set({ comparedGroupIds: new Set() }),
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
