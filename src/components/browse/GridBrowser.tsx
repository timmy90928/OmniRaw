import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../../stores/libraryStore';
import { useCullStore } from '../../stores/cullStore';
import { requestThumbnails } from '../../api/commands';
import { GroupThumb, representativeFile } from '../common/GroupThumb';
import { StatusBadge } from './StatusBadge';
import { MarkBadge } from '../common/MarkBadge';
import type { PairGroup } from '../../types';

const CELL_WIDTH = 200;
const CELL_HEIGHT = 236; // 200px image + label strip
const GAP = 12;

export function GridBrowser({ groups }: { groups: PairGroup[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  const setIndex = useCullStore((s) => s.setIndex);
  const marked = useCullStore((s) => s.marked);
  const setView = useLibraryStore((s) => s.setView);
  const { t } = useTranslation();

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const update = () =>
      setColumns(Math.max(2, Math.floor((el.clientWidth + GAP) / (CELL_WIDTH + GAP))));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rowCount = Math.ceil(groups.length / columns);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CELL_HEIGHT + GAP,
    overscan: 3,
  });
  const virtualRows = virtualizer.getVirtualItems();

  const firstRow = virtualRows[0]?.index ?? 0;
  const lastRow = virtualRows[virtualRows.length - 1]?.index ?? 0;

  useEffect(() => {
    // Warm the queue for what's on screen; lazy <img> covers the rest.
    const visible = groups
      .slice(firstRow * columns, (lastRow + 1) * columns)
      .map((g) => representativeFile(g).path);
    if (visible.length > 0) void requestThumbnails(visible);
  }, [firstRow, lastRow, columns, groups]);

  const openCull = (index: number) => {
    setIndex(index);
    setView('cull');
  };

  return (
    <div ref={parentRef} className="grid-browser">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualRows.map((row) => (
          <div
            key={row.key}
            className="grid-row"
            style={{ transform: `translateY(${row.start}px)` }}
          >
            {groups
              .slice(row.index * columns, (row.index + 1) * columns)
              .map((group, i) => {
                const index = row.index * columns + i;
                const mark = marked.get(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    className={mark ? 'group-card marked' : 'group-card'}
                    style={{ width: CELL_WIDTH }}
                    onClick={() => openCull(index)}
                    title={group.baseName}
                  >
                    <div className="group-card-image">
                      <GroupThumb group={group} />
                      {mark && <MarkBadge mode={mark} />}
                    </div>
                    <div className="group-card-label">
                      <span className="group-card-name">{group.baseName}</span>
                      <StatusBadge status={group.status} />
                    </div>
                  </button>
                );
              })}
          </div>
        ))}
      </div>
      {groups.length === 0 && <p className="browse-summary">{t('browse.empty')}</p>}
    </div>
  );
}
