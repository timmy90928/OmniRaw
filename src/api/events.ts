import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface ScanProgressPayload {
  scannedFiles: number;
}

export function onScanProgress(
  handler: (payload: ScanProgressPayload) => void,
): Promise<UnlistenFn> {
  return listen<ScanProgressPayload>('scan://progress', (event) => handler(event.payload));
}
