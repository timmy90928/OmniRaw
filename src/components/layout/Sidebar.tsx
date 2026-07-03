import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';
import type { View } from '../../types';

const NAV_ITEMS: { view: View; labelKey: string }[] = [
  { view: 'browse', labelKey: 'nav.browse' },
  { view: 'cull', labelKey: 'nav.cull' },
  { view: 'review', labelKey: 'nav.review' },
  { view: 'orphans', labelKey: 'nav.orphans' },
  { view: 'settings', labelKey: 'nav.settings' },
];

export function Sidebar() {
  const { t } = useTranslation();
  const view = useLibraryStore((s) => s.view);
  const setView = useLibraryStore((s) => s.setView);

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">{t('app.name')}</div>
      <ul className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <li key={item.view}>
            <button
              type="button"
              className={view === item.view ? 'nav-item active' : 'nav-item'}
              onClick={() => setView(item.view)}
            >
              {t(item.labelKey)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
