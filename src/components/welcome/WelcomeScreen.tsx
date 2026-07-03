import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';
import { useOpenFolder } from '../../hooks/useOpenFolder';

export function WelcomeScreen() {
  const { t } = useTranslation();
  const scanning = useLibraryStore((s) => s.scanning);
  const scanProgress = useLibraryStore((s) => s.scanProgress);
  const openFolder = useOpenFolder();

  return (
    <div className="empty-state welcome">
      <h1>{t('welcome.title')}</h1>
      <p>{t('welcome.subtitle')}</p>
      <button type="button" className="primary" disabled={scanning} onClick={() => void openFolder()}>
        {scanning
          ? t('browse.scanning', { count: scanProgress })
          : t('welcome.openFolder')}
      </button>
    </div>
  );
}
