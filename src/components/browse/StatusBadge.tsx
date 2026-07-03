import { useTranslation } from 'react-i18next';
import type { GroupStatus } from '../../types';

const STATUS_KEY: Record<GroupStatus, string> = {
  complete: 'browse.statusComplete',
  rawOnly: 'browse.statusRawOnly',
  nonRawOnly: 'browse.statusNonRawOnly',
};

export function StatusBadge({ status }: { status: GroupStatus }) {
  const { t } = useTranslation();
  return <span className={`status-badge ${status}`}>{t(STATUS_KEY[status])}</span>;
}
