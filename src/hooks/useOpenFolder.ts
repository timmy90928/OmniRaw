import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { scanFolder } from '../api/commands';
import { useLibraryStore } from '../stores/libraryStore';
import { useToastStore } from '../stores/toastStore';

/** Opens the native folder picker, then scans the chosen folder. */
export function useOpenFolder() {
  const { t } = useTranslation();
  const startScan = useLibraryStore((s) => s.startScan);
  const setScanResult = useLibraryStore((s) => s.setScanResult);
  const scanFailed = useLibraryStore((s) => s.scanFailed);
  const push = useToastStore((s) => s.push);

  return useCallback(async () => {
    const selected = await open({ directory: true });
    if (typeof selected !== 'string') return;
    startScan();
    try {
      const result = await scanFolder(selected);
      setScanResult(result);
    } catch (err) {
      console.error('scan failed', err);
      push('error', t('errors.scanFailed'));
      scanFailed();
    }
  }, [startScan, setScanResult, scanFailed, push, t]);
}
