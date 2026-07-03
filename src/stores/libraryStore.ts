import { create } from 'zustand';
import type { View, ScanResult } from '../types';

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
}));
