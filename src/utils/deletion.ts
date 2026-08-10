import type { PairGroup } from '../types';

/**
 * Matches the backend `NETWORK_UNSUPPORTED` marker (see
 * src-tauri/src/commands/delete.rs) on a `FailedItem.error`, so the UI can show
 * a translated "network share has no Recycle Bin" hint instead of the raw text.
 */
export function isNetworkFailure(errorMessage: string): boolean {
  return errorMessage.startsWith('network-unsupported:');
}

/** Removes only paths the backend confirmed were moved to the Recycle Bin. */
export function remainingPathsAfterDeletion(
  requestedPaths: Iterable<string>,
  trashedPaths: Iterable<string>,
): string[] {
  const trashed = new Set(trashedPaths);
  return [...requestedPaths].filter((path) => !trashed.has(path));
}

/** Keeps selected orphan groups that still contain at least one undeleted file. */
export function remainingSelectedGroupIds(
  groups: PairGroup[],
  selectedGroupIds: Iterable<string>,
  trashedPaths: Iterable<string>,
): Set<string> {
  const selected = new Set(selectedGroupIds);
  const trashed = new Set(trashedPaths);
  return new Set(
    groups
      .filter(
        (group) =>
          selected.has(group.id) &&
          [...group.raws, ...group.others].some((file) => !trashed.has(file.path)),
      )
      .map((group) => group.id),
  );
}
