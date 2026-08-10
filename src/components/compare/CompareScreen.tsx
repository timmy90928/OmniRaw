import { useTranslation } from 'react-i18next';
import { previewUrl } from '../../api/imageUrl';
import { useLibraryStore } from '../../stores/libraryStore';
import { representativeFile } from '../common/GroupThumb';
import { EmptyState } from '../common/EmptyState';

export function CompareScreen() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((state) => state.scanResult);
  const selected = useLibraryStore((state) => state.comparedGroupIds);
  const clear = useLibraryStore((state) => state.clearCompared);
  const setView = useLibraryStore((state) => state.setView);
  const groups = (scanResult?.groups ?? []).filter((group) => selected.has(group.id));

  if (groups.length < 2) {
    return <EmptyState title={t('compare.title')} message={t('compare.empty')} />;
  }

  return (
    <div className="compare-screen">
      <header className="compare-header">
        <div>
          <h1>{t('compare.title')}</h1>
          <p>{t('compare.hint')}</p>
        </div>
        <div>
          <button type="button" onClick={() => setView('browse')}>{t('compare.back')}</button>
          <button type="button" onClick={() => { clear(); setView('browse'); }}>{t('compare.clear')}</button>
        </div>
      </header>
      <div className={`compare-grid compare-count-${groups.length}`}>
        {groups.map((group) => {
          const file = representativeFile(group);
          return (
            <figure key={group.id} className="compare-item">
              <img src={previewUrl(file.path, file.mtimeMs)} alt={group.baseName} />
              <figcaption>
                <strong>{group.baseName}</strong>
                <span>{file.fileName}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
