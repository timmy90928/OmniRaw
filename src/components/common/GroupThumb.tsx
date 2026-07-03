import { useThumbStore } from '../../stores/thumbStore';
import { thumbUrl } from '../../api/imageUrl';
import type { FileEntry, PairGroup } from '../../types';

/** Non-RAW decodes faster; fall back to the RAW's embedded preview. */
export function representativeFile(group: PairGroup): FileEntry {
  return group.others[0] ?? group.raws[0];
}

export function GroupThumb({ group }: { group: PairGroup }) {
  const file = representativeFile(group);
  const status = useThumbStore((s) => s.status.get(file.path));

  if (status === 'error') {
    return <div className="group-thumb placeholder">{file.ext.toUpperCase()}</div>;
  }
  return (
    <img
      className="group-thumb"
      loading="lazy"
      src={thumbUrl(file.path, file.mtimeMs)}
      alt={group.baseName}
      onError={(e) => {
        (e.target as HTMLImageElement).style.visibility = 'hidden';
      }}
    />
  );
}
