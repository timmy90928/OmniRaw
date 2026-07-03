import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { Toasts } from '../common/Toasts';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <main className="app-content">{children}</main>
        <StatusBar />
      </div>
      <Toasts />
    </div>
  );
}
