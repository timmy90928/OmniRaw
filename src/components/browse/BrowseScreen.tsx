import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';
import { useThumbStore } from '../../stores/thumbStore';
import { useOpenFolder } from '../../hooks/useOpenFolder';
import { EmptyState } from '../common/EmptyState';
import { GroupThumb, representativeFile } from '../common/GroupThumb';
import { requestThumbnails } from '../../api/commands';
import type { GroupStatus } from '../../types';

/** Pre-warm the first screenfuls; scrolling loads the rest lazily. */
const PREWARM_COUNT = 100;

const STATUS_KEY: Record<GroupStatus, string> = {
  complete: 'browse.statusComplete',
  rawOnly: 'browse.statusRawOnly',
  nonRawOnly: 'browse.statusNonRawOnly',
};

export function BrowseScreen() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((s) => s.scanResult);
  const scanning = useLibraryStore((s) => s.scanning);
  const scanProgress = useLibraryStore((s) => s.scanProgress);
  const openFolder = useOpenFolder();

  useEffect(() => {
    if (!scanResult) return;
    useThumbStore.getState().reset();
    const paths = scanResult.groups
      .slice(0, PREWARM_COUNT)
      .map((g) => representativeFile(g).path);
    void requestThumbnails(paths);
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
      {/* M4 replaces this text list with the virtualized thumbnail grid */}
      <ul className="group-list">
        {scanResult.groups.map((group) => (
          <li key={group.id} className="group-row">
            <GroupThumb group={group} />
            <span className={`status-badge ${group.status}`}>{t(STATUS_KEY[group.status])}</span>
            <span className="group-name">{group.baseName}</span>
            <span className="group-files">
              {[...group.raws, ...group.others].map((f) => f.ext).join(' + ')}
            </span>
            <span className="group-dir">{group.dir}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
