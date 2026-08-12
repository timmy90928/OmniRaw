import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';
import { useOpenFolder } from '../../hooks/useOpenFolder';

export function WelcomeScreen() {
  const { t } = useTranslation();
  const scanning = useLibraryStore((s) => s.scanning);
  const scanProgress = useLibraryStore((s) => s.scanProgress);
  const recentFolders = useLibraryStore((s) => s.recentFolders);
  const forgetRecent = useLibraryStore((s) => s.forgetRecent);
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
      {recentFolders.length > 0 && (
        <section className="recent-folders">
          <h2>{t('welcome.recentFolders')}</h2>
          <ul>
            {recentFolders.map((root) => (
              <li key={root}>
                <button type="button" disabled={scanning} onClick={() => void openFolder(root)}>
                  {root}
                </button>
                <button
                  type="button"
                  className="recent-forget"
                  aria-label={t('welcome.forgetFolder', { root })}
                  onClick={() => forgetRecent(root)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
