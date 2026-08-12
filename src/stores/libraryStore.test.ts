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
      recentFolders: [],
      comparedGroupIds: new Set(),
      browseQuery: '',
      browseFilter: 'all',
      browseSort: 'nameAsc',
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

  it('limits side-by-side comparison to four groups and toggles selections', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) useLibraryStore.getState().toggleCompared(id);
    expect([...useLibraryStore.getState().comparedGroupIds]).toEqual(['a', 'b', 'c', 'd']);
    useLibraryStore.getState().toggleCompared('b');
    expect(useLibraryStore.getState().comparedGroupIds.has('b')).toBe(false);
    useLibraryStore.getState().toggleCompared('e');
    expect(useLibraryStore.getState().comparedGroupIds.has('e')).toBe(true);
  });

  it('keeps the latest eight recent folders and persists browse preferences in state', () => {
    for (let index = 0; index < 10; index += 1) {
      useLibraryStore.getState().setScanResult({
        root: `/photos/${index}`,
        groups: [],
        totalFiles: 0,
        skippedFiles: 0,
      });
    }
    useLibraryStore.getState().setBrowseQuery('portrait');
    useLibraryStore.getState().setBrowseFilter('complete');
    useLibraryStore.getState().setBrowseSort('newest');
    const state = useLibraryStore.getState();
    expect(state.recentFolders).toHaveLength(8);
    expect(state.recentFolders[0]).toBe('/photos/9');
    expect([state.browseQuery, state.browseFilter, state.browseSort]).toEqual([
      'portrait',
      'complete',
      'newest',
    ]);
  });
});
