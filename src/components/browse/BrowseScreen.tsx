import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';
import { useThumbStore } from '../../stores/thumbStore';
import { useCullStore } from '../../stores/cullStore';
import { useOpenFolder } from '../../hooks/useOpenFolder';
import { EmptyState } from '../common/EmptyState';
import { GridBrowser } from './GridBrowser';
import type { GroupFilter, GroupSort } from '../../types';

function groupSize(group: NonNullable<ReturnType<typeof useLibraryStore.getState>['scanResult']>['groups'][number]) {
  return [...group.raws, ...group.others].reduce((sum, file) => sum + file.size, 0);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = -1;
  do {
    size /= 1024;
    unit += 1;
  } while (size >= 1024 && unit < units.length - 1);
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
}

export function BrowseScreen() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((s) => s.scanResult);
  const scanning = useLibraryStore((s) => s.scanning);
  const scanProgress = useLibraryStore((s) => s.scanProgress);
  const openFolder = useOpenFolder();
  const marked = useCullStore((s) => s.marked);
  const compared = useLibraryStore((s) => s.comparedGroupIds);
  const setView = useLibraryStore((s) => s.setView);
  const prevRootRef = useRef<string | null>(null);
  const query = useLibraryStore((s) => s.browseQuery);
  const filter = useLibraryStore((s) => s.browseFilter);
  const sort = useLibraryStore((s) => s.browseSort);
  const setQuery = useLibraryStore((s) => s.setBrowseQuery);
  const setFilter = useLibraryStore((s) => s.setBrowseFilter);
  const setSort = useLibraryStore((s) => s.setBrowseSort);

  useEffect(() => {
    if (!scanResult) return;
    // Only a new/changed folder invalidates thumbs and marks. An in-place
    // refresh of the same root reuses them (marks already reconciled).
    if (prevRootRef.current === scanResult.root) return;
    prevRootRef.current = scanResult.root;
    useThumbStore.getState().reset();
  }, [scanResult]);

  // Hooks must run in the same order while `scanning` changes. Keeping this
  // memo before the loading/empty early returns prevents a white-screen React
  // crash when a folder scan completes.
  const visible = useMemo(() => {
    if (!scanResult) return [];
    const needle = query.trim().toLocaleLowerCase();
    return scanResult.groups
      .map((group, originalIndex) => ({ group, originalIndex }))
      .filter(({ group }) => filter === 'all' || group.status === filter)
      .filter(({ group }) => {
        if (!needle) return true;
        return (
          group.baseName.toLocaleLowerCase().includes(needle) ||
          group.dir.toLocaleLowerCase().includes(needle) ||
          [...group.raws, ...group.others].some((file) =>
            file.fileName.toLocaleLowerCase().includes(needle),
          )
        );
      })
      .sort((a, b) => {
        const aFiles = [...a.group.raws, ...a.group.others];
        const bFiles = [...b.group.raws, ...b.group.others];
        const newest = (files: typeof aFiles) => Math.max(...files.map((f) => f.mtimeMs), 0);
        if (sort === 'nameDesc') return b.group.baseName.localeCompare(a.group.baseName);
        if (sort === 'newest') return newest(bFiles) - newest(aFiles);
        if (sort === 'oldest') return newest(aFiles) - newest(bFiles);
        if (sort === 'largest') return groupSize(b.group) - groupSize(a.group);
        return a.group.baseName.localeCompare(b.group.baseName);
      });
  }, [filter, query, scanResult, sort]);

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

  const libraryBytes = scanResult.groups.reduce((sum, group) => sum + groupSize(group), 0);
  const reclaimableBytes = scanResult.groups.reduce((sum, group) => {
    const paths = marked.get(group.id);
    if (!paths) return sum;
    return (
      sum +
      [...group.raws, ...group.others]
        .filter((file) => paths.has(file.path))
        .reduce((fileSum, file) => fileSum + file.size, 0)
    );
  }, 0);

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
      <div className="browse-stats" aria-label={t('browse.storageStats')}>
        <span>{t('browse.librarySize', { size: formatBytes(libraryBytes) })}</span>
        <span className={reclaimableBytes > 0 ? 'reclaimable active' : 'reclaimable'}>
          {t('browse.reclaimable', { size: formatBytes(reclaimableBytes) })}
        </span>
      </div>
      <div className="browse-toolbar">
        <input
          type="search"
          value={query}
          placeholder={t('browse.searchPlaceholder')}
          aria-label={t('browse.searchPlaceholder')}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select value={filter} onChange={(event) => setFilter(event.target.value as GroupFilter)}>
          <option value="all">{t('browse.filterAll')}</option>
          <option value="complete">{t('statusLabels.complete')}</option>
          <option value="rawOnly">{t('statusLabels.rawOnly')}</option>
          <option value="nonRawOnly">{t('statusLabels.nonRawOnly')}</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as GroupSort)}>
          <option value="nameAsc">{t('browse.sortNameAsc')}</option>
          <option value="nameDesc">{t('browse.sortNameDesc')}</option>
          <option value="newest">{t('browse.sortNewest')}</option>
          <option value="oldest">{t('browse.sortOldest')}</option>
          <option value="largest">{t('browse.sortLargest')}</option>
        </select>
        <button type="button" disabled={compared.size < 2} onClick={() => setView('compare')}>
          {t('browse.compareSelected', { count: compared.size })}
        </button>
      </div>
      <GridBrowser entries={visible} />
    </div>
  );
}
