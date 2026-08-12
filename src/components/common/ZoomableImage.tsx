import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { useTranslation } from 'react-i18next';

export interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

const FIT: ViewTransform = { scale: 1, x: 0, y: 0 };

export function ZoomableImage({
  src,
  alt,
  transform,
  onTransform,
  controls = true,
  className = '',
}: {
  src: string;
  alt: string;
  transform?: ViewTransform;
  onTransform?: (next: ViewTransform) => void;
  controls?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [internal, setInternal] = useState<ViewTransform>(FIT);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const value = transform ?? internal;
  const update = (next: ViewTransform) => {
    if (onTransform) onTransform(next);
    else setInternal(next);
  };

  useEffect(() => {
    if (!transform) setInternal(FIT);
  }, [src, transform]);

  const zoom = (factor: number) =>
    update({ ...value, scale: Math.min(12, Math.max(0.25, value.scale * factor)) });

  const actualPixels = () => {
    const viewport = viewportRef.current;
    if (!viewport || !naturalSize.width || !naturalSize.height) return;
    const fitScale = Math.min(
      viewport.clientWidth / naturalSize.width,
      viewport.clientHeight / naturalSize.height,
      1,
    );
    update({ scale: Math.min(12, 1 / Math.max(fitScale, 0.001)), x: 0, y: 0 });
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || value.scale <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: value.x,
      originY: value.y,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    update({
      ...value,
      x: drag.originX + event.clientX - drag.x,
      y: drag.originY + event.clientY - drag.y,
    });
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <div
      ref={viewportRef}
      className={`zoom-viewport ${value.scale > 1 ? 'zoomed' : ''} ${className}`.trim()}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onDoubleClick={() => update(FIT)}
    >
      <img
        key={src}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(event) =>
          setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
        }
        style={{ transform: `translate(${value.x}px, ${value.y}px) scale(${value.scale})` }}
      />
      {controls && (
        <div className="zoom-controls" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => zoom(1 / 1.25)} aria-label={t('viewer.zoomOut')}>−</button>
          <button type="button" onClick={() => update(FIT)}>{t('viewer.fit')}</button>
          <button type="button" onClick={actualPixels}>{t('viewer.actual')}</button>
          <button type="button" onClick={() => zoom(1.25)} aria-label={t('viewer.zoomIn')}>＋</button>
          <span>{Math.round(value.scale * 100)}%</span>
        </div>
      )}
    </div>
  );
}
