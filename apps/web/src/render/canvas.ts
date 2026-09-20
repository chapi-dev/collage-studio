import type { CollageFrame, CollagePlan, CollageStyle, Point, PhotoTransform } from '@collage/core';
import { computeSourceCrop } from '@collage/core';

export type DrawableImage = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

export interface RenderPhoto {
  source: DrawableImage;
  width: number;
  height: number;
  transform: PhotoTransform;
}

export interface DrawOptions {
  /** Draw dashed placeholders for empty cells. Disabled when exporting. */
  placeholders?: boolean;
  /** Index of the cell to highlight. */
  highlight?: number | null;
  /** Reference length used to keep overlays crisp at any preview scale. */
  overlayScale?: number;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function polygonPath(ctx: CanvasRenderingContext2D, points: Point[]): void {
  ctx.beginPath();
  if (points.length === 0) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function applyShadow(
  ctx: CanvasRenderingContext2D,
  shortEdge: number,
  strength: number,
  spread: number,
): void {
  ctx.shadowColor = `rgba(0, 0, 0, ${Math.min(0.62, 0.22 + strength * 0.45)})`;
  ctx.shadowBlur = shortEdge * spread * strength;
  ctx.shadowOffsetY = shortEdge * spread * 0.32 * strength;
}

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  frame: CollageFrame,
  photo: RenderPhoto | undefined,
  shortEdge: number,
  placeholders: boolean,
): void {
  const { rect } = frame;
  if (photo) {
    const crop = computeSourceCrop(
      { width: photo.width, height: photo.height },
      { width: rect.width, height: rect.height },
      photo.transform,
    );
    ctx.drawImage(
      photo.source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );
    return;
  }
  if (!placeholders) return;
  ctx.fillStyle = 'rgba(120, 124, 138, 0.22)';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = Math.max(1, shortEdge * 0.0025);
  ctx.setLineDash([shortEdge * 0.02, shortEdge * 0.015]);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.setLineDash([]);
}

/** Scrap of paper with a hand-torn silhouette and a pale fibrous lip. */
function drawTornFrame(
  ctx: CanvasRenderingContext2D,
  style: CollageStyle,
  frame: CollageFrame,
  photo: RenderPhoto | undefined,
  shortEdge: number,
  placeholders: boolean,
): void {
  const { paper, opening } = frame;
  if (!paper || !opening) return;

  if (style.shadow > 0) {
    ctx.save();
    applyShadow(ctx, shortEdge, style.shadow, 0.022);
    ctx.fillStyle = style.paperColor;
    polygonPath(ctx, paper);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = style.paperColor;
  polygonPath(ctx, paper);
  ctx.fill();
  // A faint darker rim reads as the thickness of the sheet.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.09)';
  ctx.lineWidth = Math.max(0.6, shortEdge * 0.0012);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  polygonPath(ctx, opening);
  ctx.clip();
  drawPhoto(ctx, frame, photo, shortEdge, placeholders);
  ctx.restore();

  ctx.save();
  polygonPath(ctx, opening);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
  ctx.lineWidth = Math.max(0.6, shortEdge * 0.0016);
  ctx.stroke();
  ctx.restore();
}

/** Instant-film card: thin margins, a deep one at the bottom, soft shadow. */
function drawPolaroidFrame(
  ctx: CanvasRenderingContext2D,
  style: CollageStyle,
  frame: CollageFrame,
  photo: RenderPhoto | undefined,
  shortEdge: number,
  placeholders: boolean,
): void {
  const { outer, rect, radius } = frame;

  if (style.shadow > 0) {
    ctx.save();
    applyShadow(ctx, shortEdge, style.shadow, 0.03);
    ctx.fillStyle = style.paperColor;
    roundRectPath(ctx, outer.x, outer.y, outer.width, outer.height, radius);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = style.paperColor;
  roundRectPath(ctx, outer.x, outer.y, outer.width, outer.height, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, radius);
  ctx.clip();
  drawPhoto(ctx, frame, photo, shortEdge, placeholders);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.lineWidth = Math.max(0.6, shortEdge * 0.0016);
  roundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, radius);
  ctx.stroke();
  ctx.restore();
}

/** The classic grid cell: rounded rectangle, optional outline. */
function drawCleanFrame(
  ctx: CanvasRenderingContext2D,
  plan: CollagePlan,
  frame: CollageFrame,
  photo: RenderPhoto | undefined,
  shortEdge: number,
  placeholders: boolean,
): void {
  const { style } = plan;
  const { rect, radius } = frame;

  if (style.shadow > 0) {
    ctx.save();
    applyShadow(ctx, shortEdge, style.shadow, 0.02);
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    roundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, radius);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  roundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, radius);
  ctx.clip();
  drawPhoto(ctx, frame, photo, shortEdge, placeholders);
  ctx.restore();

  if (plan.borderWidth > 0) {
    ctx.save();
    ctx.strokeStyle = style.borderColor;
    ctx.lineWidth = plan.borderWidth;
    roundRectPath(
      ctx,
      rect.x + plan.borderWidth / 2,
      rect.y + plan.borderWidth / 2,
      rect.width - plan.borderWidth,
      rect.height - plan.borderWidth,
      Math.max(0, radius - plan.borderWidth / 2),
    );
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Paints a collage plan. The context must already be scaled so that one unit
 * equals one output pixel; `drawCollagePreview` does that for previews.
 */
export function drawCollage(
  ctx: CanvasRenderingContext2D,
  plan: CollagePlan,
  photos: Array<RenderPhoto | undefined>,
  options: DrawOptions = {},
): void {
  const { canvas, frames, style } = plan;
  const shortEdge = Math.min(canvas.width, canvas.height);
  const placeholders = options.placeholders ?? false;

  ctx.save();
  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const frame of frames) {
    const photo = photos[frame.index];

    ctx.save();
    if (frame.rotation) {
      const cx = frame.outer.x + frame.outer.width / 2;
      const cy = frame.outer.y + frame.outer.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(frame.rotation);
      ctx.translate(-cx, -cy);
    }

    if (style.frameStyle === 'torn') {
      drawTornFrame(ctx, style, frame, photo, shortEdge, placeholders);
    } else if (style.frameStyle === 'polaroid') {
      drawPolaroidFrame(ctx, style, frame, photo, shortEdge, placeholders);
    } else {
      drawCleanFrame(ctx, plan, frame, photo, shortEdge, placeholders);
    }

    if (options.highlight === frame.index) {
      const overlay = options.overlayScale ?? 1;
      const { rect, radius } = frame;
      ctx.save();
      ctx.strokeStyle = '#6ee7ff';
      ctx.lineWidth = Math.max(2 / overlay, shortEdge * 0.004);
      roundRectPath(
        ctx,
        rect.x + ctx.lineWidth / 2,
        rect.y + ctx.lineWidth / 2,
        rect.width - ctx.lineWidth,
        rect.height - ctx.lineWidth,
        Math.max(0, radius - ctx.lineWidth / 2),
      );
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  ctx.restore();
}

/** Draws the plan into a canvas of arbitrary CSS size, handling DPR. */
export function drawCollagePreview(
  canvasEl: HTMLCanvasElement,
  plan: CollagePlan,
  photos: Array<RenderPhoto | undefined>,
  cssSize: { width: number; height: number },
  options: DrawOptions = {},
): void {
  const dpr = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
  const pixelWidth = Math.max(1, Math.round(cssSize.width * dpr));
  const pixelHeight = Math.max(1, Math.round(cssSize.height * dpr));

  if (canvasEl.width !== pixelWidth || canvasEl.height !== pixelHeight) {
    canvasEl.width = pixelWidth;
    canvasEl.height = pixelHeight;
  }
  canvasEl.style.width = `${cssSize.width}px`;
  canvasEl.style.height = `${cssSize.height}px`;

  const ctx = canvasEl.getContext('2d');
  if (!ctx) return;

  const scale = pixelWidth / plan.canvas.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pixelWidth, pixelHeight);
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawCollage(ctx, plan, photos, { ...options, overlayScale: scale });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
