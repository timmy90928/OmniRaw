import { invoke } from '@tauri-apps/api/core';
import type {
  AppConfig,
  DeletionReport,
  DeletionHistory,
  DeletionRequest,
  ExifData,
  ScanResult,
  XmpWriteResult,
  SimilarityCluster,
  XmpInfo,
  CacheStats,
  StorageLocations,
} from '../types';

export function scanFolder(root: string): Promise<ScanResult> {
  return invoke<ScanResult>('scan_folder', { root });
}

export function refreshChangedPaths(paths: string[]): Promise<ScanResult> {
  return invoke<ScanResult>('refresh_changed_paths', { paths });
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

export function resetConfig(): Promise<AppConfig> {
  return invoke<AppConfig>('reset_config');
}

export function commitDeletions(requests: DeletionRequest[]): Promise<DeletionReport> {
  return invoke<DeletionReport>('commit_deletions', { requests });
}

export function deleteFiles(paths: string[]): Promise<DeletionReport> {
  return invoke<DeletionReport>('delete_files', { paths });
}

export function getDeletionHistory(): Promise<DeletionHistory> {
  return invoke<DeletionHistory>('get_deletion_history');
}

export function writeXmpRating(path: string, rating: number): Promise<XmpWriteResult> {
  return invoke<XmpWriteResult>('write_xmp_rating', { path, rating });
}

export function readXmpInfo(path: string): Promise<XmpInfo> {
  return invoke<XmpInfo>('read_xmp_info', { path });
}

export function analyzeSimilarGroups(): Promise<SimilarityCluster[]> {
  return invoke<SimilarityCluster[]>('analyze_similar_groups');
}

export function cancelSimilarityAnalysis(): Promise<void> {
  return invoke<void>('cancel_similarity_analysis');
}

export function getCacheStats(): Promise<CacheStats> {
  return invoke<CacheStats>('get_cache_stats');
}

export function getStorageLocations(): Promise<StorageLocations> {
  return invoke<StorageLocations>('get_storage_locations');
}

export function clearMediaCache(): Promise<CacheStats> {
  return invoke<CacheStats>('clear_media_cache');
}

/** Exports a RAW's embedded preview to a sibling JPG; resolves to the new path. */
export function convertRawToJpg(path: string): Promise<string> {
  return invoke<string>('convert_raw_to_jpg', { path });
}

const metadataCache = new Map<string, ExifData>();

export async function getMetadata(path: string): Promise<ExifData> {
  const cached = metadataCache.get(path);
  if (cached) return cached;
  const data = await invoke<ExifData>('get_metadata', { path });
  metadataCache.set(path, data);
  return data;
}
