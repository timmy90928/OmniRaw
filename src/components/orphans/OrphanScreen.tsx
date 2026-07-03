import { useTranslation } from 'react-i18next';
import { EmptyState } from '../common/EmptyState';

export function OrphanScreen() {
  const { t } = useTranslation();
  return <EmptyState title={t('orphans.title')} message={t('orphans.empty')} />;
}
