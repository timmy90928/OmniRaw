import { invoke } from '@tauri-apps/api/core';
import type { AppConfig, ScanResult } from '../types';

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
