import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { refreshChangedPaths, scanFolder } from '../api/commands';
import { useLibraryStore } from '../stores/libraryStore';
import { useCullStore } from '../stores/cullStore';
import { useToastStore } from '../stores/toastStore';

/**
 * Re-scans the currently open folder in place — no folder picker. Marks for
 * files that still exist are preserved; the current screen is kept. No-op when
 * nothing is open or a scan is already running.
 */
export function useRefreshFolder() {
  const { t } = useTranslation();
  const push = useToastStore((s) => s.push);

  return useCallback(async (changedPaths?: string[]) => {
    const { scanRoot, scanning } = useLibraryStore.getState();
    if (!scanRoot || scanning) return;
    useLibraryStore.getState().startScan();
    try {
      const result = changedPaths?.length
        ? await refreshChangedPaths(changedPaths)
        : await scanFolder(scanRoot);
      useCullStore.getState().restoreForScan(result);
      useLibraryStore.getState().setScanResult(result);
    } catch (err) {
      console.error('refresh failed', err);
      push('error', t('errors.scanFailed'));
      useLibraryStore.getState().scanFailed();
    }
  }, [push, t]);
}
