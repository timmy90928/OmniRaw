import type { FileEntry, PairGroup } from '../types';

/** Preview/cycle order: non-RAW first (camera JPG, exports), then RAW. */
export function groupFiles(group: PairGroup): FileEntry[] {
  return [...group.others, ...group.raws];
}

export type MarkSummary =
  | { kind: 'pair' }
  | { kind: 'nonRawOnly' }
  | { kind: 'rawOnly' }
  | { kind: 'custom'; count: number };

/** Classifies a marked-file set for badge display. */
export function markSummary(group: PairGroup, paths: Set<string>): MarkSummary {
  const raws = group.raws.map((f) => f.path);
  const others = group.others.map((f) => f.path);
  const all = raws.length + others.length;

  if (paths.size === all && all > 0) return { kind: 'pair' };
  const equals = (list: string[]) =>
    list.length > 0 && paths.size === list.length && list.every((p) => paths.has(p));
  if (equals(others) && raws.length > 0) return { kind: 'nonRawOnly' };
  if (equals(raws) && others.length > 0) return { kind: 'rawOnly' };
  return { kind: 'custom', count: paths.size };
}
