import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { previewUrl } from '../../api/imageUrl';
import { useLibraryStore } from '../../stores/libraryStore';
import { representativeFile } from '../common/GroupThumb';
import { EmptyState } from '../common/EmptyState';
import { ZoomableImage, type ViewTransform } from '../common/ZoomableImage';

type CompareMode = 'side' | 'overlay' | 'blink';

export function CompareScreen() {
  const { t } = useTranslation();
  const scanResult = useLibraryStore((state) => state.scanResult);
  const selected = useLibraryStore((state) => state.comparedGroupIds);
  const clear = useLibraryStore((state) => state.clearCompared);
  const setView = useLibraryStore((state) => state.setView);
  const groups = (scanResult?.groups ?? []).filter((group) => selected.has(group.id));
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const [mode, setMode] = useState<CompareMode>('side');
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [blinkIndex, setBlinkIndex] = useState(0);

  useEffect(() => setTransform({ scale: 1, x: 0, y: 0 }), [selected]);
  useEffect(() => {
    if (mode !== 'blink') return;
    const timer = setInterval(() => setBlinkIndex((index) => (index + 1) % 2), 500);
    return () => clearInterval(timer);
  }, [mode]);

  if (groups.length < 2) {
    return <EmptyState title={t('compare.title')} message={t('compare.empty')} />;
  }

  const twoImageMode = groups.length === 2 && mode !== 'side';
  const visibleGroups = twoImageMode ? groups.slice(0, 2) : groups;

  return (
    <div className="compare-screen">
      <header className="compare-header">
        <div><h1>{t('compare.title')}</h1><p>{t('compare.hint')}</p></div>
        <div>
          <button type="button" className={mode === 'side' ? 'active' : ''} onClick={() => setMode('side')}>{t('compare.side')}</button>
          <button type="button" disabled={groups.length !== 2} className={mode === 'overlay' ? 'active' : ''} onClick={() => setMode('overlay')}>{t('compare.overlay')}</button>
          <button type="button" disabled={groups.length !== 2} className={mode === 'blink' ? 'active' : ''} onClick={() => setMode('blink')}>{t('compare.blink')}</button>
          <button type="button" onClick={() => setView('browse')}>{t('compare.back')}</button>
          <button type="button" onClick={() => { clear(); setView('browse'); }}>{t('compare.clear')}</button>
        </div>
      </header>
      {mode === 'overlay' && groups.length === 2 && (
        <label className="overlay-opacity">
          {t('compare.opacity')}
          <input type="range" min="0" max="100" value={overlayOpacity} onChange={(event) => setOverlayOpacity(Number(event.target.value))} />
          {overlayOpacity}%
        </label>
      )}
      {mode === 'overlay' && groups.length === 2 ? (
        <div className="compare-overlay-stage">
          {visibleGroups.map((group, index) => {
            const file = representativeFile(group);
            return (
              <div key={group.id} className="compare-overlay-layer" style={{ opacity: index === 0 ? 1 : overlayOpacity / 100 }}>
                <ZoomableImage src={previewUrl(file.path, file.mtimeMs)} alt={group.baseName} transform={transform} onTransform={setTransform} controls={index === 1} />
              </div>
            );
          })}
        </div>
      ) : mode === 'blink' && groups.length === 2 ? (
        <figure className="compare-item compare-blink">
          {(() => {
            const group = groups[blinkIndex];
            const file = representativeFile(group);
            return <ZoomableImage src={previewUrl(file.path, file.mtimeMs)} alt={group.baseName} transform={transform} onTransform={setTransform} />;
          })()}
          <figcaption><strong>{groups[blinkIndex].baseName}</strong><span>{t('compare.blinkHint')}</span></figcaption>
        </figure>
      ) : (
        <div className={`compare-grid compare-count-${groups.length}`}>
          {visibleGroups.map((group) => {
            const file = representativeFile(group);
            return (
              <figure key={group.id} className="compare-item">
                <ZoomableImage src={previewUrl(file.path, file.mtimeMs)} alt={group.baseName} transform={transform} onTransform={setTransform} />
                <figcaption><strong>{group.baseName}</strong><span>{file.fileName}</span></figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}
