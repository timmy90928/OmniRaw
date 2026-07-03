import { AppShell } from './components/layout/AppShell';
import { WelcomeScreen } from './components/welcome/WelcomeScreen';
import { BrowseScreen } from './components/browse/BrowseScreen';
import { CullView } from './components/cull/CullView';
import { ReviewScreen } from './components/review/ReviewScreen';
import { OrphanScreen } from './components/orphans/OrphanScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { useLibraryStore } from './stores/libraryStore';

function App() {
  const view = useLibraryStore((s) => s.view);

  return (
    <AppShell>
      {view === 'welcome' && <WelcomeScreen />}
      {view === 'browse' && <BrowseScreen />}
      {view === 'cull' && <CullView />}
      {view === 'review' && <ReviewScreen />}
      {view === 'orphans' && <OrphanScreen />}
      {view === 'settings' && <SettingsScreen />}
    </AppShell>
  );
}

export default App;
