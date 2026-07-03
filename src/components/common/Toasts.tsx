import { useToastStore } from '../../stores/toastStore';

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`toast ${toast.kind}`}
          onClick={() => dismiss(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
