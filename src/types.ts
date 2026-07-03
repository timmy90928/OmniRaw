// Mirrors Rust DTOs in src-tauri/src/model.rs (kept in sync by hand).

export type View = 'welcome' | 'browse' | 'cull' | 'review' | 'orphans' | 'settings';

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
}

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
