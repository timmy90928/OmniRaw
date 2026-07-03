import { useEffect } from 'react';

type HotkeyMap = Record<string, (event: KeyboardEvent) => void>;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

/**
 * Binds window-level hotkeys. Keys are `KeyboardEvent.key` values,
 * lowercased for letters (e.g. 'x', 'arrowleft', 'enter', 'escape').
 * Ignored while typing in form fields.
 */
export function useGlobalHotkeys(handlers: HotkeyMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      const handler = handlers[event.key.toLowerCase()];
      if (handler) {
        event.preventDefault();
        handler(event);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers, enabled]);
}
