// Mirrors Rust DTOs in src-tauri/src/model.rs (kept in sync by hand).

export type View =
  | 'welcome'
  | 'browse'
  | 'cull'
  | 'compare'
  | 'similar'
  | 'review'
  | 'orphans'
  | 'settings'
  | 'about';

export type FileKind = 'raw' | 'nonRaw';

export type GroupStatus = 'complete' | 'rawOnly' | 'nonRawOnly';

export type DeleteMode = 'pair' | 'nonRawOnly' | 'rawOnly';

export interface FileEntry {
  path: string;
  fileName: string;
  ext: string;
  kind: FileKind;
  size: number;
  mtimeMs: number;
}

export interface PairGroup {
  id: string;
  dir: string;
  baseName: string;
  raws: FileEntry[];
  others: FileEntry[];
  status: GroupStatus;
}

export interface ScanResult {
  root: string;
  groups: PairGroup[];
  totalFiles: number;
  skippedFiles: number;
}

export interface AppConfig {
  rawExtensions: string[];
  nonRawExtensions: string[];
  defaultDeleteMode: DeleteMode;
  language: 'zh-TW' | 'en';
  /** Pair exported variants (IMG_0001-1.jpg / IMG_0001_edit.jpg) into the RAW's group. */
  matchExportedSuffixes: boolean;
  /** Pair matching basenames found in configured sibling folders. */
  matchSiblingFolders: boolean;
  siblingFolderNames: string[];
}

export type GroupSort = 'nameAsc' | 'nameDesc' | 'newest' | 'oldest' | 'largest';
export type GroupFilter = 'all' | GroupStatus;

export interface ExifData {
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: number;
  focalLengthMm?: number;
  dateTaken?: string;
  width?: number;
  height?: number;
}

export interface AppErrorPayload {
  code: string;
  message: string;
}

export interface DeletionRequest {
  groupId: string;
  mode: DeleteMode;
}

export interface FailedItem {
  path: string;
  error: string;
}

export interface DeletionReport {
  trashed: string[];
  failed: FailedItem[];
}

export interface DeletionOperation {
  timestampMs: number;
  scanRoot: string;
  requested: string[];
  trashed: string[];
  failed: FailedItem[];
}

export interface DeletionHistory {
  operations: DeletionOperation[];
  logPath: string;
  manifestPath: string;
}

export interface XmpWriteResult {
  path: string;
  rating: number;
}

export type SimilarityKind = 'burst' | 'nearDuplicate';

export interface SimilarityCluster {
  id: string;
  kind: SimilarityKind;
  groupIds: string[];
  score: number;
}
