import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { analyzeSimilarGroups } from '../../api/commands';
import { useCullStore } from '../../stores/cullStore';
import { useLibraryStore } from '../../stores/libraryStore';
import type { SimilarityCluster } from '../../types';
import { GroupThumb } from '../common/GroupThumb';
import { EmptyState } from '../common/EmptyState';
import { Spinner } from '../common/Spinner';

export function SimilarScreen() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((state) => state.scanResult);
  const setView = useLibraryStore((state) => state.setView);
  const setIndex = useCullStore((state) => state.setIndex);
  const [clusters, setClusters] = useState<SimilarityCluster[] | null>(null);

  useEffect(() => {
    if (!scanResult) return;
    setClusters(null);
    void analyzeSimilarGroups().then(setClusters).catch(() => setClusters([]));
  }, [scanResult]);

  if (!scanResult) return <EmptyState title={t('similar.title')} message={t('similar.noFolder')} />;
  if (!clusters) return <Spinner />;
  if (clusters.length === 0) return <EmptyState title={t('similar.title')} message={t('similar.empty')} />;

  const byId = new Map(scanResult.groups.map((group, index) => [group.id, { group, index }]));
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
                <button key={id} type="button" onClick={() => { setIndex(item.index); setView('cull'); }}>
                  <GroupThumb group={item.group} />
                  <span>{item.group.baseName}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
