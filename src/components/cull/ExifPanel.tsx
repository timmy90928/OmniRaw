import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMetadata, readXmpInfo, writeXmpRating } from '../../api/commands';
import { useCullStore } from '../../stores/cullStore';
import { groupFiles } from '../../utils/marks';
import type { ExifData, FileEntry, PairGroup, XmpInfo } from '../../types';
import { useToastStore } from '../../stores/toastStore';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function ExifPanel({
  group,
  file,
  markedSet,
}: {
  group: PairGroup;
  file: FileEntry;
  markedSet: Set<string> | undefined;
}) {
  const { t } = useTranslation();
  const setPreviewIndex = useCullStore((s) => s.setPreviewIndex);
  const toggleFile = useCullStore((s) => s.toggleFile);
  const push = useToastStore((s) => s.push);
  const [exif, setExif] = useState<ExifData | null>(null);
  const [writingRating, setWritingRating] = useState(false);
  const [xmp, setXmp] = useState<XmpInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setExif(null);
    setXmp(null);
    getMetadata(file.path)
      .then((data) => {
        if (!cancelled) setExif(data);
      })
      .catch(() => {
        if (!cancelled) setExif({});
      });
    readXmpInfo(file.path)
      .then((data) => {
        if (!cancelled) setXmp(data);
      })
      .catch(() => {
        if (!cancelled) setXmp({ path: '', exists: false });
      });
    return () => {
      cancelled = true;
    };
  }, [file.path]);

  const rows: Array<[string, string | undefined]> = [
    [t('exif.camera'), [exif?.cameraMake, exif?.cameraModel].filter(Boolean).join(' ') || undefined],
    [t('exif.lens'), exif?.lensModel],
    [t('exif.exposure'), exif?.exposureTime],
    [t('exif.aperture'), exif?.fNumber ? `f/${exif.fNumber}` : undefined],
    [t('exif.iso'), exif?.iso?.toString()],
    [t('exif.focalLength'), exif?.focalLengthMm ? `${Math.round(exif.focalLengthMm)} mm` : undefined],
    [t('exif.dateTaken'), exif?.dateTaken],
    [
      t('exif.dimensions'),
      exif?.width && exif?.height ? `${exif.width} × ${exif.height}` : undefined,
    ],
  ];

  const files = groupFiles(group);

  const rate = async (rating: number) => {
    setWritingRating(true);
    try {
      const result = await writeXmpRating(file.path, rating);
      setXmp((current) => ({
        path: result.path,
        exists: true,
        rating,
        label: current?.label,
      }));
      push('success', t(result.updatedExisting ? 'xmp.updated' : rating === -1 ? 'xmp.rejected' : 'xmp.rated', { rating }));
    } catch (error) {
      push('error', t('xmp.failed', { error: String(error) }));
    } finally {
      setWritingRating(false);
    }
  };

  return (
    <aside className="exif-panel">
      <h2>{file.fileName}</h2>
      <dl>
        <div className="exif-row">
          <dt>{t('exif.fileSize')}</dt>
          <dd>{formatSize(file.size)}</dd>
        </div>
        {rows.map(([label, value]) => (
          <div className="exif-row" key={label}>
            <dt>{label}</dt>
            <dd>{value ?? '—'}</dd>
          </div>
        ))}
      </dl>
      <div className="xmp-rating">
        <h3>{t('xmp.title')}</h3>
        <div>
          {[1, 2, 3, 4, 5].map((rating) => (
            <button key={rating} type="button" className={xmp?.rating === rating ? 'active' : ''} disabled={writingRating} onClick={() => void rate(rating)}>
              {rating}★
            </button>
          ))}
          <button type="button" className={`reject ${xmp?.rating === -1 ? 'active' : ''}`} disabled={writingRating} onClick={() => void rate(-1)}>
            {t('xmp.reject')}
          </button>
        </div>
        {xmp?.exists && <span>{t('xmp.current', { rating: xmp.rating ?? '—', label: xmp.label ?? '—' })}</span>}
        <span>{t('xmp.safeHint')}</span>
      </div>
      <div className="exif-files">
        <h3>{t('cull.groupFiles')}</h3>
        <ul>
          {files.map((f, index) => {
            const classes = [];
            if (f.path === file.path) classes.push('current');
            if (markedSet?.has(f.path)) classes.push('marked');
            return (
              <li key={f.path} className={classes.join(' ') || undefined}>
                <button
                  type="button"
                  className="exif-file-btn"
                  onClick={() => setPreviewIndex(index)}
                  title={t('cull.clickToPreview')}
                >
                  {f.fileName}
                </button>
                <input
                  type="checkbox"
                  checked={markedSet?.has(f.path) ?? false}
                  onChange={() => toggleFile(group.id, f.path)}
                  title={t('cull.toggleFileMark')}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
