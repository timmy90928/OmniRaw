import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import './styles/app.css';
import { onScanProgress, onThumbReady, onThumbError } from './api/events';
import { useLibraryStore } from './stores/libraryStore';
import { useThumbStore } from './stores/thumbStore';

// Tauri events land outside the React tree; write straight into the stores.
void onScanProgress(({ scannedFiles }) => {
  useLibraryStore.getState().setScanProgress(scannedFiles);
});
void onThumbReady(({ path }) => {
  useThumbStore.getState().setStatus(path, 'ready');
});
void onThumbError(({ path, message }) => {
  console.warn('thumbnail failed:', path, message);
  useThumbStore.getState().setStatus(path, 'error');
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
