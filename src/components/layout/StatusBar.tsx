import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';
import { useCullStore } from '../../stores/cullStore';

export function StatusBar() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((s) => s.scanResult);
  const marked = useCullStore((s) => s.marked);

  return (
    <footer className="status-bar">
      <span>{scanResult ? scanResult.root : t('status.ready')}</span>
      <span className="status-right">
        {marked.size > 0 && (
          <span className="status-marked">
            {t('status.marked', {
              count: [...marked.values()].reduce((sum: number, set) => sum + set.size, 0),
            })}
          </span>
        )}
        {scanResult && t('status.groups', { count: scanResult.groups.length })}
      </span>
    </footer>
  );
}
