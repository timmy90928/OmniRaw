import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getVersion } from '@tauri-apps/api/app';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useToastStore } from '../../stores/toastStore';
import changelog from '../../../CHANGELOG.md?raw';
import { getDeletionHistory } from '../../api/commands';
import type { DeletionHistory } from '../../types';

type UpdateState = 'idle' | 'checking' | 'uptodate' | 'available' | 'downloading' | 'error';

function stripInline(line: string): string {
  return line
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/\*\*([^*]+)\*\*/g, '$1'); // **text** → text
}

/** Minimal renderer for our own CHANGELOG.md — headings and bullet lists only. */
function Changelog({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split('\n');
  let bullets: string[] = [];
  const flush = (key: string) => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={key} className="about-changelog-list">
        {items.map((li, i) => (
          <li key={i}>{stripInline(li)}</li>
        ))}
      </ul>,
    );
  };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2));
      return;
    }
    flush(`ul-${i}`);
    if (line.startsWith('### ')) blocks.push(<h4 key={i}>{line.slice(4)}</h4>);
    else if (line.startsWith('## ')) blocks.push(<h3 key={i}>{line.slice(3)}</h3>);
    else if (line.startsWith('# ')) return; // document title — shown in the header already
    else if (line.length > 0) blocks.push(<p key={i}>{stripInline(line)}</p>);
  });
  flush('ul-end');
  return <div className="about-changelog">{blocks}</div>;
}

export function AboutScreen() {
  const { t } = useTranslation();
  const push = useToastStore((s) => s.push);
  const [version, setVersion] = useState('');
  const [state, setState] = useState<UpdateState>('idle');
  const [newVersion, setNewVersion] = useState('');
  const [progress, setProgress] = useState(0);
  const updateRef = useRef<Update | null>(null);
  const [history, setHistory] = useState<DeletionHistory | null>(null);

  useEffect(() => {
    void getVersion()
      .then(setVersion)
      .catch(() => setVersion(''));
  }, []);

  useEffect(() => {
    void getDeletionHistory().then(setHistory).catch(() => setHistory(null));
  }, []);

  const runCheck = async () => {
    setState('checking');
    try {
      const update = await check();
      if (update) {
        updateRef.current = update;
        setNewVersion(update.version);
        setState('available');
      } else {
        setState('uptodate');
      }
    } catch (err) {
      console.error('update check failed', err);
      setState('error');
      push('error', t('about.updateError'));
    }
  };

  const runInstall = async () => {
    const update = updateRef.current;
    if (!update) return;
    setState('downloading');
    setProgress(0);
    try {
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') total = event.data.contentLength ?? 0;
        else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (total > 0) setProgress(Math.round((downloaded / total) * 100));
        } else if (event.event === 'Finished') setProgress(100);
      });
      // Relaunch into the freshly installed version.
      await relaunch();
    } catch (err) {
      console.error('update install failed', err);
      setState('error');
      push('error', t('about.updateError'));
    }
  };

  const busy = state === 'checking' || state === 'downloading';

  return (
    <div className="settings-screen about-screen">
      <h1>{t('about.title')}</h1>

      <section className="settings-section">
        <div className="about-identity">
          <span className="about-app-name">{t('app.name')}</span>
          <span className="about-version">
            {version ? t('about.version', { version }) : t('common.loading')}
          </span>
        </div>
      </section>

      <section className="settings-section column">
        <h2 className="about-changelog-title">{t('about.deletionAudit')}</h2>
        <span className="about-status">
          {t('about.deletionOperations', { count: history?.operations.length ?? 0 })}
        </span>
        {history && (
          <dl className="audit-paths">
            <dt>{t('about.auditLog')}</dt><dd>{history.logPath}</dd>
            <dt>{t('about.auditManifest')}</dt><dd>{history.manifestPath}</dd>
          </dl>
        )}
      </section>

      <section className="settings-section column">
        <div className="about-update">
          <button type="button" className="primary" disabled={busy} onClick={() => void runCheck()}>
            {state === 'checking' ? t('about.checking') : t('about.checkUpdate')}
          </button>
          {state === 'uptodate' && <span className="about-status">{t('about.upToDate')}</span>}
          {state === 'error' && (
            <span className="about-status error">{t('about.updateError')}</span>
          )}
          {state === 'available' && (
            <div className="about-available">
              <span className="about-status">{t('about.available', { version: newVersion })}</span>
              <button type="button" className="primary" onClick={() => void runInstall()}>
                {t('about.install')}
              </button>
            </div>
          )}
          {state === 'downloading' && (
            <span className="about-status">{t('about.downloading', { percent: progress })}</span>
          )}
        </div>
        <span className="settings-hint">{t('about.updateHint')}</span>
      </section>

      <section className="settings-section column">
        <h2 className="about-changelog-title">{t('about.changelog')}</h2>
        <Changelog text={changelog} />
      </section>
    </div>
  );
}
