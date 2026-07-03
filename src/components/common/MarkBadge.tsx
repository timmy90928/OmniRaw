import { useTranslation } from 'react-i18next';
import type { MarkSummary } from '../../utils/marks';

export function MarkBadge({ summary }: { summary: MarkSummary }) {
  const { t } = useTranslation();
  const label =
    summary.kind === 'pair'
      ? t('cull.markPair')
      : summary.kind === 'nonRawOnly'
        ? t('cull.markNonRawOnly')
        : summary.kind === 'rawOnly'
          ? t('cull.markRawOnly')
          : t('cull.markCustom', { count: summary.count });
  return <span className={`mark-badge ${summary.kind}`}>{label}</span>;
}
