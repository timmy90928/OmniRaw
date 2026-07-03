import { useTranslation } from 'react-i18next';
import { EmptyState } from '../common/EmptyState';

export function CullView() {
  const { t } = useTranslation();
  return <EmptyState title={t('cull.title')} message={t('cull.empty')} />;
}
