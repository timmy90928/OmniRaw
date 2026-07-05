import { useEffect, useRef } from 'react';
import { useCullStore } from '../../stores/cullStore';
import { requestThumbnails } from '../../api/commands';
import { GroupThumb, representativeFile } from '../common/GroupThumb';
import type { PairGroup } from '../../types';

export function Filmstrip({
  groups,
  currentIndex,
}: {
  groups: PairGroup[];
  currentIndex: number;
}) {
  const setIndex = useCullStore((s) => s.setIndex);
  const marked = useCullStore((s) => s.marked);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-index="${currentIndex}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [currentIndex]);

  // Window the strip so huge folders don't flood the DOM.
  const WINDOW = 25;
  const start = Math.max(0, currentIndex - WINDOW);
  const end = Math.min(groups.length, currentIndex + WINDOW + 1);

  useEffect(() => {
    // Warm thumbnails for the windowed strip instead of generating them
    // one-by-one on demand as each <img> scrolls into view.
    const paths = groups.slice(start, end).map((g) => representativeFile(g).path);
    if (paths.length > 0) void requestThumbnails(paths);
  }, [start, end, groups]);

  return (
    <div ref={stripRef} className="filmstrip">
      {groups.slice(start, end).map((group, offset) => {
        const index = start + offset;
        const classes = ['filmstrip-item'];
        if (index === currentIndex) classes.push('current');
        if (marked.has(group.id)) classes.push('marked');
        return (
          <button
            key={group.id}
            type="button"
            data-index={index}
            className={classes.join(' ')}
            onClick={() => setIndex(index)}
            title={group.baseName}
          >
            <GroupThumb group={group} />
          </button>
        );
      })}
    </div>
  );
}
