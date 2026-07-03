import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToastStore } from '../../stores/toastStore';
import { ExtensionListEditor } from './ExtensionListEditor';
import { Spinner } from '../common/Spinner';
import type { AppConfig, DeleteMode } from '../../types';

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

  useEffect(() => {
    setDraft(config);
  }, [config]);

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
