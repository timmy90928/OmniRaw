import { useTranslation } from 'react-i18next';
import { EmptyState } from '../common/EmptyState';

export function ReviewScreen() {
  const { t } = useTranslation();
  return <EmptyState title={t('review.title')} message={t('review.empty')} />;
}
