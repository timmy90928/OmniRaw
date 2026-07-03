import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
] as const;

export function SettingsScreen() {
  const { t, i18n } = useTranslation();

  return (
    <div className="settings-screen">
      <h1>{t('settings.title')}</h1>
      <section className="settings-section">
        <label htmlFor="language-select">{t('settings.language')}</label>
        <select
          id="language-select"
          value={i18n.language}
          onChange={(e) => void i18n.changeLanguage(e.target.value)}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </section>
    </div>
  );
}
