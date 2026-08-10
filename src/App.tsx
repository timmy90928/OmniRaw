import { useEffect, useMemo, useRef } from 'react';
import { AppShell } from './components/layout/AppShell';
import { WelcomeScreen } from './components/welcome/WelcomeScreen';
import { BrowseScreen } from './components/browse/BrowseScreen';
import { CullView } from './components/cull/CullView';
import { ReviewScreen } from './components/review/ReviewScreen';
import { OrphanScreen } from './components/orphans/OrphanScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { AboutScreen } from './components/about/AboutScreen';
import { CompareScreen } from './components/compare/CompareScreen';
import { SimilarScreen } from './components/similar/SimilarScreen';
import { useLibraryStore } from './stores/libraryStore';
import { useRefreshFolder } from './hooks/useRefreshFolder';
import { useGlobalHotkeys } from './hooks/useGlobalHotkeys';
import { onScanChanged } from './api/events';

function App() {
  const view = useLibraryStore((s) => s.view);
  const refresh = useRefreshFolder();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // App-wide F5 → re-scan the current folder (Ctrl/Cmd+R is blocked by the hook).
  const hotkeys = useMemo(() => ({ f5: () => void refresh() }), [refresh]);
  useGlobalHotkeys(hotkeys);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void onScanChanged(() => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        if (!disposed && !useLibraryStore.getState().scanning) void refresh();
      }, 700);
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      unlisten?.();
    };
  }, [refresh]);

  return (
    <AppShell>
      {view === 'welcome' && <WelcomeScreen />}
      {view === 'browse' && <BrowseScreen />}
      {view === 'cull' && <CullView />}
      {view === 'compare' && <CompareScreen />}
      {view === 'similar' && <SimilarScreen />}
      {view === 'review' && <ReviewScreen />}
      {view === 'orphans' && <OrphanScreen />}
      {view === 'settings' && <SettingsScreen />}
      {view === 'about' && <AboutScreen />}
    </AppShell>
  );
}

export default App;
