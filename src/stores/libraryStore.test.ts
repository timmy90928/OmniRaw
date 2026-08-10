import { beforeEach, describe, expect, it } from 'vitest';
import { useLibraryStore } from './libraryStore';
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
  return { id, dir: '/photos', baseName: id, raws, others, status: 'complete' };
}

describe('libraryStore deletion reconciliation', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      view: 'browse',
      scanRoot: '/photos',
      scanResult: null,
      scanning: false,
      scanProgress: 0,
    });
  });

  it('updates group status and removes groups emptied by deletion', () => {
    const scanResult: ScanResult = {
      root: '/photos',
      groups: [
        group('partial', ['/photos/partial.raw', '/photos/partial.jpg']),
        group('empty', ['/photos/empty.raw']),
      ],
      totalFiles: 3,
      skippedFiles: 0,
    };
    useLibraryStore.setState({ scanResult });

    useLibraryStore.getState().applyDeletions(['/photos/partial.jpg', '/photos/empty.raw']);

    expect(useLibraryStore.getState().scanResult?.groups).toEqual([
      expect.objectContaining({ id: 'partial', status: 'rawOnly', others: [] }),
    ]);
  });
});
