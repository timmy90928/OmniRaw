import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function ExtensionListEditor({
  label,
  extensions,
  onChange,
}: {
  label: string;
  extensions: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  const add = () => {
    const ext = draft.trim().replace(/^\./, '').toLowerCase();
    if (ext && !extensions.includes(ext)) {
      onChange([...extensions, ext]);
    }
    setDraft('');
  };

  return (
    <div className="ext-editor">
      <span className="ext-editor-label">{label}</span>
      <div className="ext-chips">
        {extensions.map((ext) => (
          <span key={ext} className="ext-chip">
            {ext}
            <button
              type="button"
              aria-label={t('settings.removeExtension', { ext })}
              onClick={() => onChange(extensions.filter((e) => e !== ext))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={t('settings.addExtension')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
      </div>
    </div>
  );
}
