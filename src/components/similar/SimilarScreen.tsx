import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { analyzeSimilarGroups, cancelSimilarityAnalysis } from '../../api/commands';
import { onSimilarityProgress, type SimilarityProgressPayload } from '../../api/events';
import { useCullStore } from '../../stores/cullStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useToastStore } from '../../stores/toastStore';
import type { SimilarityCluster } from '../../types';
import { GroupThumb } from '../common/GroupThumb';
import { EmptyState } from '../common/EmptyState';

export function SimilarScreen() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((state) => state.scanResult);
  const setView = useLibraryStore((state) => state.setView);
  const setIndex = useCullStore((state) => state.setIndex);
  const markFiles = useCullStore((state) => state.markFiles);
  const unmark = useCullStore((state) => state.unmark);
  const push = useToastStore((state) => state.push);
  const [clusters, setClusters] = useState<SimilarityCluster[] | null>(null);
  const [progress, setProgress] = useState<SimilarityProgressPayload | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!scanResult) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    setClusters(null);
    setCancelled(false);
    setProgress(null);
    void onSimilarityProgress((payload) => {
      if (!disposed) setProgress(payload);
    }).then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    });
    void analyzeSimilarGroups()
      .then((result) => {
        if (!disposed) setClusters(result);
      })
      .catch((error) => {
        if (!disposed && !String(error).toLowerCase().includes('cancel')) {
          console.error('similarity analysis failed', error);
          setClusters([]);
        }
      });
    return () => {
      disposed = true;
      unlisten?.();
      void cancelSimilarityAnalysis();
    };
  }, [scanResult]);

  if (!scanResult) return <EmptyState title={t('similar.title')} message={t('similar.noFolder')} />;
  if (!clusters) {
    const percent = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="similar-progress">
        <h1>{t('similar.title')}</h1>
        <progress max={100} value={percent} />
        <p>{t(progress?.stage === 'grouping' ? 'similar.grouping' : 'similar.hashing', { done: progress?.done ?? 0, total: progress?.total ?? scanResult.groups.length })}</p>
        <button type="button" onClick={() => {
          setCancelled(true);
          void cancelSimilarityAnalysis().then(() => setClusters([]));
        }}>{t('common.cancel')}</button>
      </div>
    );
  }
  if (clusters.length === 0) {
    return <EmptyState title={t('similar.title')} message={t(cancelled ? 'similar.cancelled' : 'similar.empty')} />;
  }

  const byId = new Map(scanResult.groups.map((group, index) => [group.id, { group, index }]));
  const keepAndMarkRest = (cluster: SimilarityCluster, keeperId: string) => {
    for (const groupId of cluster.groupIds) {
      const item = byId.get(groupId);
      if (!item) continue;
      if (groupId === keeperId) unmark(groupId);
      else markFiles(groupId, [...item.group.raws, ...item.group.others].map((file) => file.path));
    }
    push('success', t('similar.markedRest', { count: cluster.groupIds.length - 1 }));
  };

  return (
    <div className="similar-screen">
      <header><h1>{t('similar.title')}</h1><p>{t('similar.hint')}</p></header>
      {clusters.map((cluster) => (
        <section key={cluster.id} className="similar-cluster">
          <div className="similar-cluster-title">
            <strong>{t(`similar.${cluster.kind}`)}</strong>
            <span>{t('similar.score', { score: Math.round(cluster.score * 100) })}</span>
          </div>
          <div className="similar-items">
            {cluster.groupIds.map((id) => {
              const item = byId.get(id);
              if (!item) return null;
              return (
                <article key={id} className="similar-item">
                  <button type="button" className="similar-preview" onClick={() => { setIndex(item.index); setView('cull'); }}>
                    <GroupThumb group={item.group} />
                    <span>{item.group.baseName}</span>
                  </button>
                  <button type="button" className="similar-keeper" onClick={() => keepAndMarkRest(cluster, id)}>{t('similar.keepThis')}</button>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
