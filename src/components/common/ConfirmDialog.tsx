import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="dialog-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{message}</p>
        {children}
        <div className="dialog-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={danger ? 'primary danger' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
