import { useTranslation } from 'react-i18next';
import { previewUrl } from '../../api/imageUrl';
import { MarkBadge } from '../common/MarkBadge';
import type { DeleteMode, FileEntry, PairGroup } from '../../types';

export function PreviewPane({
  group,
  file,
  mark,
}: {
  group: PairGroup;
  file: FileEntry;
  mark: DeleteMode | undefined;
}) {
  const { t } = useTranslation();
  const isRawSource = file.kind === 'raw';

  return (
    <div className="preview-pane">
      <img
        key={file.path}
        className="preview-image"
        src={previewUrl(file.path, file.mtimeMs)}
        alt={group.baseName}
      />
      <div className="preview-overlay">
        <span className={`source-badge ${file.kind}`}>
          {isRawSource ? t('cull.sourceRaw', { ext: file.ext.toUpperCase() }) : file.ext.toUpperCase()}
        </span>
        {mark && <MarkBadge mode={mark} />}
      </div>
    </div>
  );
}
