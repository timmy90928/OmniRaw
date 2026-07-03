import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import './styles/app.css';
import { onScanProgress } from './api/events';
import { useLibraryStore } from './stores/libraryStore';

// Tauri events land outside the React tree; write straight into the store.
void onScanProgress(({ scannedFiles }) => {
  useLibraryStore.getState().setScanProgress(scannedFiles);
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
