use serde::{Deserialize, Serialize};

// Mirrored by hand in src/types.ts — keep both sides in sync.

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileKind {
    Raw,
    NonRaw,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GroupStatus {
    Complete,
    RawOnly,
    NonRawOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeleteMode {
    Pair,
    NonRawOnly,
    RawOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub path: String,
    pub file_name: String,
    pub ext: String,
    pub kind: FileKind,
    pub size: u64,
    pub mtime_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairGroup {
    /// `logical dir + "|" + lowercase(basename)` — stable across rescans.
    pub id: String,
    pub dir: String,
    pub base_name: String,
    pub raws: Vec<FileEntry>,
    pub others: Vec<FileEntry>,
    pub status: GroupStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub root: String,
    pub groups: Vec<PairGroup>,
    pub total_files: usize,
    pub skipped_files: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletionRequest {
    pub group_id: String,
    pub mode: DeleteMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FailedItem {
    pub path: String,
    pub error: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletionReport {
    pub trashed: Vec<String>,
    pub failed: Vec<FailedItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletionOperation {
    pub timestamp_ms: u128,
    pub scan_root: String,
    pub requested: Vec<String>,
    pub trashed: Vec<String>,
    pub failed: Vec<FailedItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletionHistory {
    pub operations: Vec<DeletionOperation>,
    pub log_path: String,
    pub manifest_path: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExifData {
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub lens_model: Option<String>,
    pub exposure_time: Option<String>,
    pub f_number: Option<String>,
    pub iso: Option<u32>,
    pub focal_length_mm: Option<f32>,
    pub date_taken: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SimilarityKind {
    Burst,
    NearDuplicate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimilarityCluster {
    pub id: String,
    pub kind: SimilarityKind,
    pub group_ids: Vec<String>,
    pub score: f32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStats {
    pub files: usize,
    pub bytes: u64,
    pub limit_bytes: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct XmpInfo {
    pub path: String,
    pub exists: bool,
    pub rating: Option<i8>,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct XmpWriteResult {
    pub path: String,
    pub rating: i8,
    pub updated_existing: bool,
    pub backup_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageLocations {
    pub executable_file: String,
    pub config_file: String,
    pub app_data_dir: String,
    pub app_local_data_dir: String,
    pub app_cache_dir: String,
    pub app_log_dir: String,
    pub webview_profile_dir: String,
    pub session_storage_dir: String,
    pub session_storage_keys: Vec<String>,
    pub thumbnail_cache_dir: String,
    pub preview_cache_dir: String,
    pub similarity_cache_file: String,
    pub deletion_log_file: String,
    pub deletion_manifest_file: String,
    pub updater_temp_dir: String,
    pub active_scan_root: Option<String>,
}
