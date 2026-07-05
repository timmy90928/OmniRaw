import { useTranslation } from 'react-i18next';
import { previewUrl } from '../../api/imageUrl';
import { MarkBadge } from '../common/MarkBadge';
import { markSummary } from '../../utils/marks';
import { useConvertRaw } from '../../hooks/useConvertRaw';
import type { FileEntry, PairGroup } from '../../types';

export function PreviewPane({
  group,
  file,
  fileIndex,
  fileCount,
  markedSet,
}: {
  group: PairGroup;
  file: FileEntry;
  fileIndex: number;
  fileCount: number;
  markedSet: Set<string> | undefined;
}) {
  const { t } = useTranslation();
  const { convert, busyPath } = useConvertRaw();
  const fileMarked = markedSet?.has(file.path) ?? false;
  const canConvert = group.status === 'rawOnly' && file.kind === 'raw';

  return (
    <div className="preview-pane">
      <img
        key={file.path}
        className="preview-image"
        src={previewUrl(file.path, file.mtimeMs)}
        alt={group.baseName}
      />
      {canConvert && (
        <button
          type="button"
          className="convert-btn"
          disabled={busyPath !== null}
          onClick={() => void convert(file.path)}
        >
          {busyPath === file.path ? t('convert.working') : t('convert.toJpg')}
        </button>
      )}
      <div className="preview-overlay">
        <span className={`source-badge ${file.kind}`}>
          {file.fileName}
          {fileCount > 1 && ` (${fileIndex + 1}/${fileCount})`}
        </span>
        {fileMarked && <span className="mark-badge file">{t('cull.fileMarked')}</span>}
        {markedSet && markedSet.size > 0 && (
          <MarkBadge summary={markSummary(group, markedSet)} />
        )}
      </div>
    </div>
  );
}
