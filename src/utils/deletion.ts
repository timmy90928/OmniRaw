/**
 * Matches the backend `NETWORK_UNSUPPORTED` marker (see
 * src-tauri/src/commands/delete.rs) on a `FailedItem.error`, so the UI can show
 * a translated "network share has no Recycle Bin" hint instead of the raw text.
 */
export function isNetworkFailure(errorMessage: string): boolean {
  return errorMessage.startsWith('network-unsupported:');
}
