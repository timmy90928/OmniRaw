import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';

export function StatusBar() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((s) => s.scanResult);

  return (
    <footer className="status-bar">
      <span>{scanResult ? scanResult.root : t('status.ready')}</span>
      {scanResult && <span>{scanResult.groups.length} groups</span>}
    </footer>
  );
}
