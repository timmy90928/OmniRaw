import { beforeEach, describe, expect, it } from 'vitest';
import { useCullStore } from './cullStore';
import type { FileEntry, PairGroup, ScanResult } from '../types';

function file(path: string, kind: FileEntry['kind']): FileEntry {
  const segments = path.split('/');
  const extensionParts = path.split('.');
  return {
    path,
    fileName: segments[segments.length - 1] ?? path,
    ext: extensionParts[extensionParts.length - 1] ?? '',
    kind,
    size: 1,
    mtimeMs: 1,
  };
}

function group(id: string, paths: string[]): PairGroup {
  const raws = paths.filter((path) => path.endsWith('.raw')).map((path) => file(path, 'raw'));
  const others = paths.filter((path) => !path.endsWith('.raw')).map((path) => file(path, 'nonRaw'));
  return {
    id,
    dir: '/photos',
    baseName: id,
    raws,
    others,
    status: raws.length > 0 && others.length > 0 ? 'complete' : raws.length > 0 ? 'rawOnly' : 'nonRawOnly',
  };
}

function result(groups: PairGroup[]): ScanResult {
  return { root: '/photos', groups, totalFiles: groups.length, skippedFiles: 0 };
}

describe('cullStore reconciliation', () => {
  beforeEach(() => {
    useCullStore.setState({ currentIndex: 0, previewIndex: 0, marked: new Map() });
  });

  it('keeps only marks that still exist and clamps the cursor', () => {
    useCullStore.setState({
      currentIndex: 4,
      marked: new Map([
        ['kept', new Set(['/photos/kept.raw', '/photos/deleted.jpg'])],
        ['vanished', new Set(['/photos/vanished.raw'])],
      ]),
    });

    useCullStore.getState().reconcileMarks(
      result([
        group('kept', ['/photos/kept.raw', '/photos/kept.jpg']),
        group('second', ['/photos/second.raw']),
      ]),
    );

    const state = useCullStore.getState();
    expect(state.currentIndex).toBe(1);
    expect([...state.marked.entries()]).toEqual([['kept', new Set(['/photos/kept.raw'])]]);
  });
});
