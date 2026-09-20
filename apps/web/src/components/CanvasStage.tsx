import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_ZOOM,
  clamp,
  createPlan,
  deltaToFrameSpace,
  fitContain,
  getQuality,
  getRatio,
  hitTest,
} from '@collage/core';
import { useActiveLayout, useStudio } from '../state/store';
import { drawCollagePreview, type RenderPhoto } from '../render/canvas';
import { filesFromDataTransfer } from '../lib/images';

interface DragState {
  pointerId: number;
  index: number;
  lastX: number;
  lastY: number;
}

export function CanvasStage() {
  const photos = useStudio((state) => state.photos);
  const ratioId = useStudio((state) => state.ratioId);
  const style = useStudio((state) => state.style);
  const qualityId = useStudio((state) => state.qualityId);
  const selected = useStudio((state) => state.selected);
  const select = useStudio((state) => state.select);
  const patchTransform = useStudio((state) => state.patchTransform);
  const nudgeTransform = useStudio((state) => state.nudgeTransform);
  const resetTransform = useStudio((state) => state.resetTransform);
  const addFiles = useStudio((state) => state.addFiles);
  const layout = useActiveLayout();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [box, setBox] = useState({ width: 0, height: 0 });
  const [dropping, setDropping] = useState(false);

  const ratio = useMemo(() => getRatio(ratioId), [ratioId]);
  const plan = useMemo(
    () =>
      createPlan({
        ratio,
        template: layout,
        style,
        longEdge: getQuality(qualityId).longEdge,
      }),
    [ratio, layout, style, qualityId],
  );

  const renderPhotos = useMemo<Array<RenderPhoto | undefined>>(
    () =>
      plan.frames.map((frame) => {
        const photo = photos[frame.index];
        if (!photo) return undefined;
        return {
          source: photo.source,
          width: photo.width,
          height: photo.height,
          transform: photo.transform,
        };
      }),
    [plan, photos],
  );

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const display = useMemo(() => {
    if (box.width < 2 || box.height < 2) return { width: 0, height: 0 };
    return fitContain(box, ratio);
  }, [box, ratio]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || display.width < 2) return;
    drawCollagePreview(canvas, plan, renderPhotos, display, {
      placeholders: true,
      highlight: selected,
    });
  }, [plan, renderPhotos, display, selected]);

  const toPlanCoords = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return null;
      const scale = plan.canvas.width / rect.width;
      return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale, scale };
    },
    [plan],
  );

  const panBy = useCallback(
    (index: number, dxCss: number, dyCss: number, scale: number) => {
      const photo = photos[index];
      const frame = plan.frames[index];
      if (!photo || !frame) return;

      const frameWidth = frame.rect.width;
      const frameHeight = frame.rect.height;
      const cover =
        Math.max(frameWidth / photo.width, frameHeight / photo.height) * photo.transform.zoom;
      const slackX = (photo.width - frameWidth / cover) / 2;
      const slackY = (photo.height - frameHeight / cover) / 2;

      // Tilted cells pan along their own axes, not the canvas ones.
      const local = deltaToFrameSpace(frame, dxCss * scale, dyCss * scale);

      const deltaX = slackX > 0.01 ? -local.x / (cover * slackX) : 0;
      const deltaY = slackY > 0.01 ? -local.y / (cover * slackY) : 0;
      if (deltaX === 0 && deltaY === 0) return;
      nudgeTransform(index, deltaX, deltaY);
    },
    [photos, plan, nudgeTransform],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = toPlanCoords(event.clientX, event.clientY);
    if (!point) return;
    const index = hitTest(plan.frames, point.x, point.y);
    select(index >= 0 ? index : null);
    if (index < 0 || !photos[index]) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      index,
      lastX: event.clientX,
      lastY: event.clientY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = toPlanCoords(event.clientX, event.clientY);
    if (!point) return;
    panBy(drag.index, event.clientX - drag.lastX, event.clientY - drag.lastY, point.scale);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
  };

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  // React attaches wheel listeners passively, so zoom needs a native listener.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      const point = toPlanCoords(event.clientX, event.clientY);
      if (!point) return;
      const index = hitTest(plan.frames, point.x, point.y);
      if (index < 0) return;
      const photo = useStudio.getState().photos[index];
      if (!photo) return;
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0016);
      patchTransform(index, { zoom: clamp(photo.transform.zoom * factor, 1, MAX_ZOOM) });
      select(index);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [plan, patchTransform, select, toPlanCoords]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (selected === null || !photos[selected]) return;
    const step = event.shiftKey ? 0.12 : 0.03;
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = map[event.key];
    if (delta) {
      event.preventDefault();
      nudgeTransform(selected, delta[0], delta[1]);
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      patchTransform(selected, { zoom: clamp(photos[selected].transform.zoom * 1.1, 1, MAX_ZOOM) });
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      patchTransform(selected, { zoom: clamp(photos[selected].transform.zoom / 1.1, 1, MAX_ZOOM) });
    }
    if (event.key === '0' || event.key === 'Escape') {
      event.preventDefault();
      resetTransform(selected);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropping(false);
    const files = filesFromDataTransfer(event.dataTransfer);
    if (files.length > 0) void addFiles(files);
  };

  return (
    <div
      className={`stage${dropping ? ' stage--dropping' : ''}`}
      ref={wrapperRef}
      onDragOver={(event) => {
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label="Collage preview. Click a cell to select it, drag to reposition, scroll to zoom."
    >
      {display.width > 2 ? (
        <canvas
          ref={canvasRef}
          className="stage__canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => selected !== null && resetTransform(selected)}
        />
      ) : null}

      {photos.length === 0 ? (
        <div className="stage__empty">
          <p className="stage__empty-title">Drop your photos here</p>
          <p className="stage__empty-body">
            Or use <strong>Add photos</strong>. Nothing is uploaded: every pixel stays in this
            browser.
          </p>
        </div>
      ) : null}
    </div>
  );
}
