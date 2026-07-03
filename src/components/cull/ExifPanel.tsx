import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMetadata } from '../../api/commands';
import type { ExifData, FileEntry, PairGroup } from '../../types';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function ExifPanel({ group, file }: { group: PairGroup; file: FileEntry }) {
  const { t } = useTranslation();
  const [exif, setExif] = useState<ExifData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setExif(null);
    getMetadata(file.path)
      .then((data) => {
        if (!cancelled) setExif(data);
      })
      .catch(() => {
        if (!cancelled) setExif({});
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
      <div className="exif-files">
        <h3>{t('cull.groupFiles')}</h3>
        <ul>
          {[...group.raws, ...group.others].map((f) => (
            <li key={f.path} className={f.path === file.path ? 'current' : undefined}>
              {f.fileName}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
