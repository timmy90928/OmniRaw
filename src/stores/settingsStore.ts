import { create } from 'zustand';
import i18n from '../i18n';
import { getConfig, setConfig, resetConfig } from '../api/commands';
import type { AppConfig } from '../types';

interface SettingsState {
  config: AppConfig | null;
  load: () => Promise<void>;
  /** Persists via backend validation; returns an error message on failure. */
  save: (config: AppConfig) => Promise<string | null>;
  restoreDefaults: () => Promise<void>;
}

function applyLanguage(config: AppConfig) {
  if (i18n.language !== config.language) {
    void i18n.changeLanguage(config.language);
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  config: null,
  load: async () => {
    const config = await getConfig();
    applyLanguage(config);
    set({ config });
  },
  save: async (config) => {
    try {
      const saved = await setConfig(config);
      applyLanguage(saved);
      set({ config: saved });
      return null;
    } catch (err) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
      return message;
    }
  },
  restoreDefaults: async () => {
    const config = await resetConfig();
    applyLanguage(config);
    set({ config });
  },
}));
