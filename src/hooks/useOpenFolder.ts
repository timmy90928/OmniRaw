import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { scanFolder } from '../api/commands';
import { useLibraryStore } from '../stores/libraryStore';

/** Opens the native folder picker, then scans the chosen folder. */
export function useOpenFolder() {
  const startScan = useLibraryStore((s) => s.startScan);
  const setScanResult = useLibraryStore((s) => s.setScanResult);
  const scanFailed = useLibraryStore((s) => s.scanFailed);

  return useCallback(async () => {
    const selected = await open({ directory: true });
    if (typeof selected !== 'string') return;
    startScan();
    try {
      const result = await scanFolder(selected);
      setScanResult(result);
    } catch (err) {
      console.error('scan failed', err);
      scanFailed();
    }
  }, [startScan, setScanResult, scanFailed]);
}
