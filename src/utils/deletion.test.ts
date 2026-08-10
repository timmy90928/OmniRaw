import { describe, expect, it } from 'vitest';
import type { FileEntry, PairGroup } from '../types';
import {
  isNetworkFailure,
  remainingPathsAfterDeletion,
  remainingSelectedGroupIds,
} from './deletion';

function file(path: string, kind: FileEntry['kind'] = 'nonRaw'): FileEntry {
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
  return {
    id,
    dir: '/photos',
    baseName: id,
    raws: [],
    others: paths.map((path) => file(path)),
    status: 'nonRawOnly',
  };
}

describe('deletion state helpers', () => {
  it('recognizes the backend network-share marker', () => {
    expect(isNetworkFailure('network-unsupported: no recycle bin')).toBe(true);
    expect(isNetworkFailure('permission denied')).toBe(false);
  });

  it('removes only paths confirmed as trashed', () => {
    expect(
      remainingPathsAfterDeletion(['/photos/a.jpg', '/photos/b.jpg'], ['/photos/a.jpg']),
    ).toEqual(['/photos/b.jpg']);
  });

  it('keeps only selected groups with undeleted files', () => {
    const groups = [
      group('a', ['/photos/a-1.jpg', '/photos/a-2.jpg']),
      group('b', ['/photos/b.jpg']),
      group('c', ['/photos/c.jpg']),
    ];

    expect(
      remainingSelectedGroupIds(
        groups,
        new Set(['a', 'b']),
        ['/photos/a-1.jpg', '/photos/b.jpg'],
      ),
    ).toEqual(new Set(['a']));
  });
});
