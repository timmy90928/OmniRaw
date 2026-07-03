import { useTranslation } from 'react-i18next';

export function Spinner() {
  const { t } = useTranslation();
  return <div className="spinner">{t('common.loading')}</div>;
}
