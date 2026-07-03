import { useTranslation } from 'react-i18next';
import type { DeleteMode } from '../../types';

const MARK_KEY: Record<DeleteMode, string> = {
  pair: 'cull.markPair',
  nonRawOnly: 'cull.markNonRawOnly',
  rawOnly: 'cull.markRawOnly',
};

export function MarkBadge({ mode }: { mode: DeleteMode }) {
  const { t } = useTranslation();
  return <span className={`mark-badge ${mode}`}>{t(MARK_KEY[mode])}</span>;
}
