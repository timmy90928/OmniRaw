import { create } from 'zustand';
import type { View, ScanResult, GroupStatus } from '../types';

interface LibraryState {
  view: View;
  scanRoot: string | null;
  scanResult: ScanResult | null;
  scanning: boolean;
  scanProgress: number;
  setView: (view: View) => void;
  startScan: () => void;
  setScanProgress: (scannedFiles: number) => void;
  setScanResult: (result: ScanResult) => void;
  scanFailed: () => void;
  /** Removes trashed files from groups in place — no rescan needed. */
  applyDeletions: (trashedPaths: string[]) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  view: 'welcome',
  scanRoot: null,
  scanResult: null,
  scanning: false,
  scanProgress: 0,
  setView: (view) => set({ view }),
  startScan: () => set({ scanning: true, scanProgress: 0 }),
  setScanProgress: (scannedFiles) => set({ scanProgress: scannedFiles }),
  setScanResult: (result) =>
    set({ scanRoot: result.root, scanResult: result, scanning: false, view: 'browse' }),
  scanFailed: () => set({ scanning: false }),
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
      return { scanResult: { ...s.scanResult, groups } };
    }),
}));
