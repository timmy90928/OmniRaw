import { invoke } from '@tauri-apps/api/core';
import type { AppConfig, ExifData, ScanResult } from '../types';

export function scanFolder(root: string): Promise<ScanResult> {
  return invoke<ScanResult>('scan_folder', { root });
}

export function getConfig(): Promise<AppConfig> {
  return invoke<AppConfig>('get_config');
}

export function setConfig(config: AppConfig): Promise<AppConfig> {
  return invoke<AppConfig>('set_config', { config });
}

export function requestThumbnails(paths: string[]): Promise<void> {
  return invoke<void>('request_thumbnails', { paths });
}

export function clearThumbnailQueue(): Promise<void> {
  return invoke<void>('clear_thumbnail_queue');
}

const metadataCache = new Map<string, ExifData>();

export async function getMetadata(path: string): Promise<ExifData> {
  const cached = metadataCache.get(path);
  if (cached) return cached;
  const data = await invoke<ExifData>('get_metadata', { path });
  metadataCache.set(path, data);
  return data;
}
