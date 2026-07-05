import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertRawToJpg } from '../api/commands';
import { useToastStore } from '../stores/toastStore';
import { useRefreshFolder } from './useRefreshFolder';

/**
 * Converts a RAW file to a sibling JPG, then refreshes the folder so the group
 * flips from RAW-only to paired. `busyPath` is the RAW currently converting
 * (null when idle) — use it to disable the triggering button.
 */
export function useConvertRaw() {
  const { t } = useTranslation();
  const push = useToastStore((s) => s.push);
  const refresh = useRefreshFolder();
  const [busyPath, setBusyPath] = useState<string | null>(null);

  const convert = useCallback(
    async (rawPath: string) => {
      if (busyPath) return;
      setBusyPath(rawPath);
      try {
        const output = await convertRawToJpg(rawPath);
        const name = output.replace(/^.*[\\/]/, '');
        push('success', t('convert.success', { name }));
        await refresh();
      } catch (err) {
        console.error('convert failed', err);
        push('error', t('convert.failed'));
      } finally {
        setBusyPath(null);
      }
    },
    [busyPath, push, t, refresh],
  );

  return { convert, busyPath };
}
