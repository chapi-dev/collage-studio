import type { CollagePlan, PhotoTransform } from '@collage/core';
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

/**
 * Paints a collage plan. The context must already be scaled so that one unit
 * equals one output pixel; `drawCollageScaled` does that for previews.
 */
export function drawCollage(
  ctx: CanvasRenderingContext2D,
  plan: CollagePlan,
  photos: Array<RenderPhoto | undefined>,
  options: DrawOptions = {},
): void {
  const { canvas, frames, style } = plan;
  const shortEdge = Math.min(canvas.width, canvas.height);

  ctx.save();
  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const frame of frames) {
    const { rect, radius } = frame;
    const photo = photos[frame.index];

    if (style.shadow > 0) {
      ctx.save();
      ctx.shadowColor = `rgba(0, 0, 0, ${Math.min(0.6, style.shadow * 0.6)})`;
      ctx.shadowBlur = shortEdge * 0.02 * style.shadow;
      ctx.shadowOffsetY = shortEdge * 0.006 * style.shadow;
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      roundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, radius);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    roundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, radius);
    ctx.clip();

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
    } else if (options.placeholders) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = Math.max(1, shortEdge * 0.0025);
      ctx.setLineDash([shortEdge * 0.02, shortEdge * 0.015]);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      ctx.setLineDash([]);
    }

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

    if (options.highlight === frame.index) {
      const overlay = options.overlayScale ?? 1;
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
