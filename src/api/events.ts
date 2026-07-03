import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface ScanProgressPayload {
  scannedFiles: number;
}

export function onScanProgress(
  handler: (payload: ScanProgressPayload) => void,
): Promise<UnlistenFn> {
  return listen<ScanProgressPayload>('scan://progress', (event) => handler(event.payload));
}

export interface ThumbReadyPayload {
  path: string;
}

export interface ThumbErrorPayload {
  path: string;
  message: string;
}

export function onThumbReady(handler: (payload: ThumbReadyPayload) => void): Promise<UnlistenFn> {
  return listen<ThumbReadyPayload>('thumb://ready', (event) => handler(event.payload));
}

export function onThumbError(handler: (payload: ThumbErrorPayload) => void): Promise<UnlistenFn> {
  return listen<ThumbErrorPayload>('thumb://error', (event) => handler(event.payload));
}

export interface DeleteProgressPayload {
  done: number;
  total: number;
}

export function onDeleteProgress(
  handler: (payload: DeleteProgressPayload) => void,
): Promise<UnlistenFn> {
  return listen<DeleteProgressPayload>('delete://progress', (event) => handler(event.payload));
}
