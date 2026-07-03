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
