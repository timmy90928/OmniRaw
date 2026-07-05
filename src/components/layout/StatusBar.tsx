import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';
import { useCullStore } from '../../stores/cullStore';
import { useRefreshFolder } from '../../hooks/useRefreshFolder';

export function StatusBar() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((s) => s.scanResult);
  const scanning = useLibraryStore((s) => s.scanning);
  const marked = useCullStore((s) => s.marked);
  const refresh = useRefreshFolder();

  return (
    <footer className="status-bar">
      <span className="status-left">
        {scanResult ? (
          <>
            <button
              type="button"
              className="status-refresh"
              onClick={() => void refresh()}
              disabled={scanning}
              title={t('status.refresh')}
              aria-label={t('status.refresh')}
            >
              ⟳
            </button>
            <span className="status-root">{scanResult.root}</span>
          </>
        ) : (
          t('status.ready')
        )}
      </span>
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
