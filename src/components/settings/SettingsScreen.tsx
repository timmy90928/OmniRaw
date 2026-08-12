import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToastStore } from '../../stores/toastStore';
import { ExtensionListEditor } from './ExtensionListEditor';
import { Spinner } from '../common/Spinner';
import type { AppConfig, DeleteMode } from '../../types';
import type { CacheStats } from '../../types';
import { clearMediaCache, getCacheStats } from '../../api/commands';
import { useThumbStore } from '../../stores/thumbStore';

const LANGUAGES = [
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
] as const;

const DELETE_MODES: DeleteMode[] = ['pair', 'nonRawOnly', 'rawOnly'];

export function SettingsScreen() {
  const { t } = useTranslation();
  const config = useSettingsStore((s) => s.config);
  const save = useSettingsStore((s) => s.save);
  const restoreDefaults = useSettingsStore((s) => s.restoreDefaults);
  const push = useToastStore((s) => s.push);
  const [draft, setDraft] = useState<AppConfig | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  useEffect(() => {
    void getCacheStats().then(setCacheStats).catch(() => setCacheStats(null));
  }, [config?.cacheLimitMb]);

  if (!draft) return <Spinner />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(config);

  const apply = async (next: AppConfig) => {
    const error = await save(next);
    if (error) {
      push('error', t('settings.saveFailed', { error }));
    } else {
      push('success', t('settings.saved'));
    }
  };

  return (
    <div className="settings-screen">
      <h1>{t('settings.title')}</h1>

      <section className="settings-section">
        <label htmlFor="language-select">{t('settings.language')}</label>
        <select
          id="language-select"
          value={draft.language}
          onChange={(e) => {
            const next = { ...draft, language: e.target.value as AppConfig['language'] };
            setDraft(next);
            void apply(next);
          }}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </section>

      <section className="settings-section column">
        <label className="settings-check" htmlFor="sibling-folder-toggle">
          <input
            id="sibling-folder-toggle"
            type="checkbox"
            checked={draft.matchSiblingFolders}
            onChange={(event) =>
              setDraft({ ...draft, matchSiblingFolders: event.target.checked })
            }
          />
          {t('settings.matchSiblingFolders')}
        </label>
        <input
          type="text"
          value={draft.siblingFolderNames.join(', ')}
          aria-label={t('settings.siblingFolderNames')}
          onChange={(event) =>
            setDraft({
              ...draft,
              siblingFolderNames: event.target.value.split(',').map((name) => name.trim()),
            })
          }
        />
        <span className="settings-hint">{t('settings.matchSiblingFoldersHint')}</span>
        <button type="button" className="primary" disabled={!dirty} onClick={() => void apply(draft)}>
          {t('settings.savePairing')}
        </button>
      </section>

      <section className="settings-section">
        <label htmlFor="delete-mode-select">{t('settings.defaultDeleteMode')}</label>
        <select
          id="delete-mode-select"
          value={draft.defaultDeleteMode}
          onChange={(e) => {
            const next = { ...draft, defaultDeleteMode: e.target.value as DeleteMode };
            setDraft(next);
            void apply(next);
          }}
        >
          {DELETE_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {t(
                mode === 'pair'
                  ? 'cull.markPair'
                  : mode === 'nonRawOnly'
                    ? 'cull.markNonRawOnly'
                    : 'cull.markRawOnly',
              )}
            </option>
          ))}
        </select>
        <span className="settings-hint">{t('settings.defaultDeleteModeHint')}</span>
      </section>

      <section className="settings-section">
        <label htmlFor="suffix-toggle">{t('settings.matchExportedSuffixes')}</label>
        <input
          id="suffix-toggle"
          type="checkbox"
          checked={draft.matchExportedSuffixes}
          onChange={(e) => {
            const next = { ...draft, matchExportedSuffixes: e.target.checked };
            setDraft(next);
            void apply(next);
          }}
        />
        <span className="settings-hint">{t('settings.matchExportedSuffixesHint')}</span>
      </section>

      <section className="settings-section column">
        <h2>{t('settings.similarityTitle')}</h2>
        <label>
          {t('settings.burstWindow')}
          <input type="number" min={100} max={60000} step={100} value={draft.similarityBurstWindowMs} onChange={(event) => setDraft({ ...draft, similarityBurstWindowMs: Number(event.target.value) })} />
        </label>
        <label>
          {t('settings.similarityWindow')}
          <input type="number" min={draft.similarityBurstWindowMs} max={600000} step={1000} value={draft.similarityWindowMs} onChange={(event) => setDraft({ ...draft, similarityWindowMs: Number(event.target.value) })} />
        </label>
        <label>
          {t('settings.hashDistance')}
          <input type="range" min={0} max={32} value={draft.similarityHashDistance} onChange={(event) => setDraft({ ...draft, similarityHashDistance: Number(event.target.value) })} />
          <span>{draft.similarityHashDistance}</span>
        </label>
        <span className="settings-hint">{t('settings.similarityHint')}</span>
        <button type="button" className="primary" disabled={!dirty} onClick={() => void apply(draft)}>{t('settings.saveSimilarity')}</button>
      </section>

      <section className="settings-section column">
        <h2>{t('settings.cacheTitle')}</h2>
        <label>
          {t('settings.cacheLimit')}
          <input type="number" min={128} max={32768} step={128} value={draft.cacheLimitMb} onChange={(event) => setDraft({ ...draft, cacheLimitMb: Number(event.target.value) })} />
        </label>
        <span className="settings-hint">
          {cacheStats
            ? t('settings.cacheUsage', { files: cacheStats.files, size: (cacheStats.bytes / 1024 / 1024).toFixed(1), limit: (cacheStats.limitBytes / 1024 / 1024).toFixed(0) })
            : t('common.loading')}
        </span>
        <span className="settings-hint">{t('settings.cacheClearHint')}</span>
        <div className="settings-actions">
          <button type="button" className="primary" disabled={!dirty} onClick={() => void apply(draft)}>{t('settings.saveCache')}</button>
          <button type="button" onClick={() => void clearMediaCache().then((stats) => { useThumbStore.getState().reset(); setCacheStats(stats); push('success', t('settings.cacheCleared')); }).catch((error) => push('error', t('settings.cacheClearFailed', { error: String(error) })))}>{t('settings.clearCache')}</button>
        </div>
      </section>

      <section className="settings-section column">
        <ExtensionListEditor
          label={t('settings.rawExtensions')}
          extensions={draft.rawExtensions}
          onChange={(rawExtensions) => setDraft({ ...draft, rawExtensions })}
        />
        <ExtensionListEditor
          label={t('settings.nonRawExtensions')}
          extensions={draft.nonRawExtensions}
          onChange={(nonRawExtensions) => setDraft({ ...draft, nonRawExtensions })}
        />
        <div className="settings-actions">
          <button
            type="button"
            className="primary"
            disabled={!dirty}
            onClick={() => void apply(draft)}
          >
            {t('settings.saveExtensions')}
          </button>
          <button
            type="button"
            onClick={() => {
              void restoreDefaults().then(() => push('success', t('settings.restored')));
            }}
          >
            {t('settings.restoreDefaults')}
          </button>
        </div>
        <span className="settings-hint">{t('settings.rescanHint')}</span>
      </section>
    </div>
  );
}
