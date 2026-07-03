import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';
import { useThumbStore } from '../../stores/thumbStore';
import { useCullStore } from '../../stores/cullStore';
import { useOpenFolder } from '../../hooks/useOpenFolder';
import { EmptyState } from '../common/EmptyState';
import { GridBrowser } from './GridBrowser';

export function BrowseScreen() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((s) => s.scanResult);
  const scanning = useLibraryStore((s) => s.scanning);
  const scanProgress = useLibraryStore((s) => s.scanProgress);
  const openFolder = useOpenFolder();

  useEffect(() => {
    if (!scanResult) return;
    // New folder → stale thumb statuses and marks no longer apply.
    useThumbStore.getState().reset();
    useCullStore.getState().clearMarks();
    useCullStore.getState().setIndex(0);
  }, [scanResult]);

  if (scanning) {
    return (
      <EmptyState title={t('browse.title')} message={t('browse.scanning', { count: scanProgress })} />
    );
  }

  if (!scanResult) {
    return (
      <div className="empty-state">
        <h1>{t('browse.title')}</h1>
        <p>{t('browse.empty')}</p>
        <button type="button" className="primary" onClick={() => void openFolder()}>
          {t('welcome.openFolder')}
        </button>
      </div>
    );
  }

  const counts = scanResult.groups.reduce(
    (acc, g) => {
      acc[g.status] += 1;
      return acc;
    },
    { complete: 0, rawOnly: 0, nonRawOnly: 0 },
  );

  return (
    <div className="browse-screen">
      <header className="browse-header">
        <h1>{t('browse.title')}</h1>
        <button type="button" className="primary" onClick={() => void openFolder()}>
          {t('welcome.openFolder')}
        </button>
      </header>
      <p className="browse-summary">
        {t('browse.summary', {
          total: scanResult.groups.length,
          complete: counts.complete,
          rawOnly: counts.rawOnly,
          nonRawOnly: counts.nonRawOnly,
          skipped: scanResult.skippedFiles,
        })}
      </p>
      <GridBrowser groups={scanResult.groups} />
    </div>
  );
}
