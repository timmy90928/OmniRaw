import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';
import { useCullStore } from '../../stores/cullStore';
import { useGlobalHotkeys } from '../../hooks/useGlobalHotkeys';
import { EmptyState } from '../common/EmptyState';
import { PreviewPane } from './PreviewPane';
import { ExifPanel } from './ExifPanel';
import { Filmstrip } from './Filmstrip';
import type { FileEntry, PairGroup } from '../../types';
import type { PreviewSource } from '../../stores/cullStore';

/** File shown in the big preview, honoring the RAW↔JPG source toggle. */
export function previewFile(group: PairGroup, source: PreviewSource): FileEntry {
  if (source === 'raw') return group.raws[0] ?? group.others[0];
  return group.others[0] ?? group.raws[0];
}

export function CullView() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((s) => s.scanResult);
  const setView = useLibraryStore((s) => s.setView);
  const currentIndex = useCullStore((s) => s.currentIndex);
  const previewSource = useCullStore((s) => s.previewSource);
  const marked = useCullStore((s) => s.marked);

  const groups = scanResult?.groups ?? [];
  const group = groups[Math.min(currentIndex, groups.length - 1)];

  const hotkeys = useMemo(() => {
    const s = useCullStore.getState;
    return {
      arrowleft: () => s().step(-1, groups.length),
      arrowright: () => s().step(1, groups.length),
      x: () => group && s().mark(group.id, 'pair'),
      j: () => {
        // Delete-JPG-only needs both sides present to be meaningful.
        if (group && group.others.length > 0 && group.raws.length > 0) {
          s().mark(group.id, 'nonRawOnly');
        }
      },
      r: () => {
        if (group && group.raws.length > 0 && group.others.length > 0) {
          s().mark(group.id, 'rawOnly');
        }
      },
      u: () => group && s().unmark(group.id),
      p: () => group && group.raws.length > 0 && group.others.length > 0 && s().toggleSource(),
      enter: () => setView('review'),
      escape: () => setView('browse'),
    };
  }, [group, groups.length, setView]);

  useGlobalHotkeys(hotkeys);

  if (!scanResult || groups.length === 0 || !group) {
    return <EmptyState title={t('cull.title')} message={t('cull.empty')} />;
  }

  const file = previewFile(group, previewSource);
  const mark = marked.get(group.id);

  return (
    <div className="cull-view">
      <div className="cull-main">
        <PreviewPane group={group} file={file} mark={mark} />
        <ExifPanel group={group} file={file} />
      </div>
      <div className="cull-hint">
        <span>{t('cull.hotkeys')}</span>
        <span className="cull-position">
          {currentIndex + 1} / {groups.length}
        </span>
      </div>
      <Filmstrip groups={groups} currentIndex={currentIndex} />
    </div>
  );
}
