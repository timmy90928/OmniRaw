import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';
import { useCullStore } from '../../stores/cullStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useGlobalHotkeys } from '../../hooks/useGlobalHotkeys';
import { groupFiles } from '../../utils/marks';
import { EmptyState } from '../common/EmptyState';
import { PreviewPane } from './PreviewPane';
import { ExifPanel } from './ExifPanel';
import { Filmstrip } from './Filmstrip';

export function CullView() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((s) => s.scanResult);
  const setView = useLibraryStore((s) => s.setView);
  const currentIndex = useCullStore((s) => s.currentIndex);
  const previewIndex = useCullStore((s) => s.previewIndex);
  const marked = useCullStore((s) => s.marked);

  const groups = scanResult?.groups ?? [];
  const group = groups[Math.min(currentIndex, groups.length - 1)];
  const files = group ? groupFiles(group) : [];
  const file = files[previewIndex % Math.max(files.length, 1)];

  const hotkeys = useMemo((): Record<string, () => void> => {
    const s = useCullStore.getState;
    if (!group) {
      return { escape: () => setView('browse') };
    }
    const allPaths = files.map((f) => f.path);
    const rawPaths = group.raws.map((f) => f.path);
    const otherPaths = group.others.map((f) => f.path);
    const markAndAdvance = (paths: string[]) => {
      s().markFiles(group.id, paths);
      s().step(1, groups.length);
    };
    // Delete toggles: marked (any files) → unmark; otherwise mark using the
    // configured default mode (Settings), falling back to the whole group.
    const toggleDelete = () => {
      const current = s().marked.get(group.id);
      if (current && current.size > 0) {
        s().unmark(group.id);
        return;
      }
      const mode = useSettingsStore.getState().config?.defaultDeleteMode ?? 'pair';
      const both = rawPaths.length > 0 && otherPaths.length > 0;
      const paths =
        mode === 'nonRawOnly' && both ? otherPaths : mode === 'rawOnly' && both ? rawPaths : allPaths;
      markAndAdvance(paths);
    };
    const currentFile = files[s().previewIndex % files.length];
    return {
      arrowleft: () => s().step(-1, groups.length),
      arrowright: () => s().step(1, groups.length),
      arrowup: () => s().cyclePreview(files.length, -1),
      arrowdown: () => s().cyclePreview(files.length, 1),
      p: () => s().cyclePreview(files.length, 1),
      delete: toggleDelete,
      backspace: toggleDelete,
      x: toggleDelete,
      j: () => {
        // Delete-JPG-only needs both sides present to be meaningful.
        if (otherPaths.length > 0 && rawPaths.length > 0) markAndAdvance(otherPaths);
      },
      r: () => {
        if (rawPaths.length > 0 && otherPaths.length > 0) markAndAdvance(rawPaths);
      },
      ' ': () => currentFile && s().toggleFile(group.id, currentFile.path),
      u: () => s().unmark(group.id),
      enter: () => setView('review'),
      escape: () => setView('browse'),
    };
  }, [group, files, groups.length, setView]);

  useGlobalHotkeys(hotkeys);

  if (!scanResult || groups.length === 0 || !group || !file) {
    return <EmptyState title={t('cull.title')} message={t('cull.empty')} />;
  }

  const markedSet = marked.get(group.id);

  return (
    <div className="cull-view">
      <div className="cull-main">
        <PreviewPane
          group={group}
          file={file}
          fileIndex={files.indexOf(file)}
          fileCount={files.length}
          markedSet={markedSet}
        />
        <ExifPanel group={group} file={file} markedSet={markedSet} />
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
