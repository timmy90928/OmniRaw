import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';
import { useCullStore } from '../../stores/cullStore';
import { deleteFiles } from '../../api/commands';
import { onDeleteProgress } from '../../api/events';
import { EmptyState } from '../common/EmptyState';
import { GroupThumb } from '../common/GroupThumb';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { groupFiles } from '../../utils/marks';
import type { DeletionReport } from '../../types';

export function ReviewScreen() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((s) => s.scanResult);
  const setView = useLibraryStore((s) => s.setView);
  const applyDeletions = useLibraryStore((s) => s.applyDeletions);
  const marked = useCullStore((s) => s.marked);
  const markFiles = useCullStore((s) => s.markFiles);
  const toggleFile = useCullStore((s) => s.toggleFile);
  const unmark = useCullStore((s) => s.unmark);

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<DeletionReport | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void onDeleteProgress((p) => setProgress(p)).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const rows = useMemo(() => {
    if (!scanResult) return [];
    return scanResult.groups
      .filter((g) => (marked.get(g.id)?.size ?? 0) > 0)
      .map((g) => ({ group: g, paths: marked.get(g.id) as Set<string> }));
  }, [scanResult, marked]);

  const allPaths = rows.flatMap((r) => [...r.paths]);

  const commit = async () => {
    setBusy(true);
    setProgress(null);
    try {
      const result = await deleteFiles(allPaths);
      applyDeletions(result.trashed);
      rows.forEach((r) => unmark(r.group.id));
      setReport(result);
    } catch (err) {
      console.error('deletion failed', err);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  if (report) {
    return (
      <div className="review-screen">
        <h1>{t('review.title')}</h1>
        <p className="review-result">
          {t('review.resultSuccess', { count: report.trashed.length })}
        </p>
        {report.failed.length > 0 && (
          <div className="review-failed">
            <p>{t('review.resultFailed', { count: report.failed.length })}</p>
            <ul>
              {report.failed.map((f) => (
                <li key={f.path}>
                  {f.path} — {f.error}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          className="primary"
          onClick={() => {
            setReport(null);
            setView('browse');
          }}
        >
          {t('review.backToBrowse')}
        </button>
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={t('review.title')} message={t('review.empty')} />;
  }

  return (
    <div className="review-screen">
      <header className="review-header">
        <h1>{t('review.title')}</h1>
        <button type="button" className="primary danger" onClick={() => setConfirming(true)}>
          {t('review.commit', { count: allPaths.length })}
        </button>
      </header>

      <ul className="review-list">
        {rows.map(({ group, paths }) => {
          const files = groupFiles(group);
          const rawPaths = group.raws.map((f) => f.path);
          const otherPaths = group.others.map((f) => f.path);
          const both = rawPaths.length > 0 && otherPaths.length > 0;
          return (
            <li key={group.id} className="review-row">
              <GroupThumb group={group} />
              <div className="review-info">
                <span className="group-card-name">{group.baseName}</span>
                <ul className="review-file-list">
                  {files.map((f) => (
                    <li key={f.path}>
                      <label className={paths.has(f.path) ? 'file-check marked' : 'file-check'}>
                        <input
                          type="checkbox"
                          checked={paths.has(f.path)}
                          onChange={() => toggleFile(group.id, f.path)}
                        />
                        {f.fileName}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="review-modes">
                <button
                  type="button"
                  className="mode-btn"
                  onClick={() => markFiles(group.id, files.map((f) => f.path))}
                >
                  {t('cull.markPair')}
                </button>
                <button
                  type="button"
                  className="mode-btn"
                  disabled={!both}
                  onClick={() => markFiles(group.id, otherPaths)}
                >
                  {t('cull.markNonRawOnly')}
                </button>
                <button
                  type="button"
                  className="mode-btn"
                  disabled={!both}
                  onClick={() => markFiles(group.id, rawPaths)}
                >
                  {t('cull.markRawOnly')}
                </button>
                <button type="button" className="mode-btn" onClick={() => unmark(group.id)}>
                  {t('review.remove')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {confirming && (
        <ConfirmDialog
          title={t('review.confirmTitle')}
          message={t('review.confirmMessage', { files: allPaths.length, groups: rows.length })}
          confirmLabel={
            busy && progress
              ? t('review.deleting', { done: progress.done, total: progress.total })
              : t('review.confirmButton')
          }
          busy={busy}
          onConfirm={() => void commit()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
