import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';
import { deleteFiles } from '../../api/commands';
import { EmptyState } from '../common/EmptyState';
import { GroupThumb } from '../common/GroupThumb';
import { ConfirmDialog } from '../common/ConfirmDialog';
import type { PairGroup } from '../../types';

function orphanPaths(group: PairGroup): string[] {
  return [...group.raws, ...group.others].map((f) => f.path);
}

function OrphanSection({
  title,
  groups,
  selected,
  onToggle,
  onSelectAll,
}: {
  title: string;
  groups: PairGroup[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[], select: boolean) => void;
}) {
  const { t } = useTranslation();
  const ids = groups.map((g) => g.id);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));

  return (
    <section className="orphan-section">
      <header>
        <h2>
          {title} ({groups.length})
        </h2>
        {groups.length > 0 && (
          <button type="button" onClick={() => onSelectAll(ids, !allSelected)}>
            {allSelected ? t('orphans.deselectAll') : t('orphans.selectAll')}
          </button>
        )}
      </header>
      {groups.length === 0 ? (
        <p className="orphan-none">{t('orphans.none')}</p>
      ) : (
        <ul className="orphan-list">
          {groups.map((group) => (
            <li key={group.id}>
              <label className="orphan-row">
                <input
                  type="checkbox"
                  checked={selected.has(group.id)}
                  onChange={() => onToggle(group.id)}
                />
                <GroupThumb group={group} />
                <div className="review-info">
                  <span className="group-card-name">{group.baseName}</span>
                  <span className="review-files">
                    {[...group.raws, ...group.others].map((f) => f.fileName).join(', ')}
                  </span>
                </div>
                <span className="group-dir">{group.dir}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OrphanScreen() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((s) => s.scanResult);
  const applyDeletions = useLibraryStore((s) => s.applyDeletions);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failedCount, setFailedCount] = useState<number | null>(null);

  const rawOrphans = useMemo(
    () => scanResult?.groups.filter((g) => g.status === 'rawOnly') ?? [],
    [scanResult],
  );
  const jpgOrphans = useMemo(
    () => scanResult?.groups.filter((g) => g.status === 'nonRawOnly') ?? [],
    [scanResult],
  );

  if (!scanResult || (rawOrphans.length === 0 && jpgOrphans.length === 0)) {
    return <EmptyState title={t('orphans.title')} message={t('orphans.empty')} />;
  }

  const allGroups = [...rawOrphans, ...jpgOrphans];
  const selectedPaths = allGroups
    .filter((g) => selected.has(g.id))
    .flatMap(orphanPaths);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAll = (ids: string[], select: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
      return next;
    });

  const commit = async () => {
    setBusy(true);
    try {
      const report = await deleteFiles(selectedPaths);
      applyDeletions(report.trashed);
      setFailedCount(report.failed.length);
      setSelected(new Set());
    } catch (err) {
      console.error('orphan deletion failed', err);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="orphan-screen">
      <header className="review-header">
        <h1>{t('orphans.title')}</h1>
        <button
          type="button"
          className="primary danger"
          disabled={selectedPaths.length === 0}
          onClick={() => setConfirming(true)}
        >
          {t('orphans.deleteSelected', { count: selectedPaths.length })}
        </button>
      </header>
      {failedCount !== null && failedCount > 0 && (
        <p className="review-failed">{t('review.resultFailed', { count: failedCount })}</p>
      )}
      <OrphanSection
        title={t('orphans.rawSection')}
        groups={rawOrphans}
        selected={selected}
        onToggle={toggle}
        onSelectAll={selectAll}
      />
      <OrphanSection
        title={t('orphans.jpgSection')}
        groups={jpgOrphans}
        selected={selected}
        onToggle={toggle}
        onSelectAll={selectAll}
      />
      {confirming && (
        <ConfirmDialog
          title={t('review.confirmTitle')}
          message={t('orphans.confirmMessage', { files: selectedPaths.length })}
          confirmLabel={t('review.confirmButton')}
          busy={busy}
          onConfirm={() => void commit()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
