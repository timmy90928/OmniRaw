import { useMemo } from 'react';
import { AppShell } from './components/layout/AppShell';
import { WelcomeScreen } from './components/welcome/WelcomeScreen';
import { BrowseScreen } from './components/browse/BrowseScreen';
import { CullView } from './components/cull/CullView';
import { ReviewScreen } from './components/review/ReviewScreen';
import { OrphanScreen } from './components/orphans/OrphanScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { AboutScreen } from './components/about/AboutScreen';
import { useLibraryStore } from './stores/libraryStore';
import { useRefreshFolder } from './hooks/useRefreshFolder';
import { useGlobalHotkeys } from './hooks/useGlobalHotkeys';

function App() {
  const view = useLibraryStore((s) => s.view);
  const refresh = useRefreshFolder();

  // App-wide F5 → re-scan the current folder (Ctrl/Cmd+R is blocked by the hook).
  const hotkeys = useMemo(() => ({ f5: () => void refresh() }), [refresh]);
  useGlobalHotkeys(hotkeys);

  return (
    <AppShell>
      {view === 'welcome' && <WelcomeScreen />}
      {view === 'browse' && <BrowseScreen />}
      {view === 'cull' && <CullView />}
      {view === 'review' && <ReviewScreen />}
      {view === 'orphans' && <OrphanScreen />}
      {view === 'settings' && <SettingsScreen />}
      {view === 'about' && <AboutScreen />}
    </AppShell>
  );
}

export default App;
