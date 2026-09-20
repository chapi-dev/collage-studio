import { getQuality, ratioValue } from './aspect-ratios.js';
import type {
  AspectRatio,
  CollageFrame,
  CollagePlan,
  CollageStyle,
  LayoutTemplate,
  PhotoTransform,
  Rect,
  Size,
} from './types.js';

export const DEFAULT_TRANSFORM: PhotoTransform = Object.freeze({
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
});

export const MAX_ZOOM = 4;

export const DEFAULT_STYLE: CollageStyle = Object.freeze({
  gutter: 0.015,
  padding: 0.025,
  cornerRadius: 0.03,
  background: '#0f1115',
  borderWidth: 0,
  borderColor: '#ffffff',
  shadow: 0,
});

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Rounds to an even integer so encoders (JPEG/WebP) never pad the output. */
function toEven(value: number): number {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

/**
 * Pixel dimensions for a ratio at a given quality preset. The long edge always
 * matches the preset so a 9:16 story and a 16:9 banner share the same detail.
 */
export function computeCanvasSize(ratio: AspectRatio, longEdge: number): Size {
  const safeEdge = clamp(Math.round(longEdge), 64, 8192);
  const value = ratioValue(ratio);
  if (value >= 1) {
    return { width: toEven(safeEdge), height: toEven(safeEdge / value) };
  }
  return { width: toEven(safeEdge * value), height: toEven(safeEdge) };
}

export function canvasSizeForQuality(ratio: AspectRatio, qualityId: string): Size {
  return computeCanvasSize(ratio, getQuality(qualityId).longEdge);
}

function insetRect(rect: Rect, inset: number): Rect {
  const width = Math.max(1, rect.width - inset * 2);
  const height = Math.max(1, rect.height - inset * 2);
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

/**
 * Turns a normalised template into pixel rectangles.
 *
 * Outer padding and inner gutters are independent: every cell is inset by half
 * a gutter, and the drawing area is expanded by the same amount so the outer
 * margin stays exactly `padding` while the space between cells is exactly
 * `gutter`.
 */
export function resolveFrames(
  template: LayoutTemplate,
  canvas: Size,
  style: CollageStyle,
): CollageFrame[] {
  const shortEdge = Math.min(canvas.width, canvas.height);
  const gutter = clamp(style.gutter, 0, 0.25) * shortEdge;
  const padding = Math.max(clamp(style.padding, 0, 0.25) * shortEdge, gutter / 2);
  const bleed = gutter / 2;

  const area: Rect = {
    x: padding - bleed,
    y: padding - bleed,
    width: Math.max(1, canvas.width - (padding - bleed) * 2),
    height: Math.max(1, canvas.height - (padding - bleed) * 2),
  };

  const radiusFactor = clamp(style.cornerRadius, 0, 0.5);

  return template.cells.map((cell, index) => {
    const raw: Rect = {
      x: area.x + cell.x * area.width,
      y: area.y + cell.y * area.height,
      width: cell.width * area.width,
      height: cell.height * area.height,
    };
    const rect = insetRect(raw, bleed);
    return {
      index,
      rect,
      radius: radiusFactor * Math.min(rect.width, rect.height),
    };
  });
}

export function createPlan(options: {
  ratio: AspectRatio;
  template: LayoutTemplate;
  style: CollageStyle;
  longEdge: number;
}): CollagePlan {
  const canvas = computeCanvasSize(options.ratio, options.longEdge);
  const shortEdge = Math.min(canvas.width, canvas.height);
  return {
    canvas,
    frames: resolveFrames(options.template, canvas, options.style),
    ratio: options.ratio,
    template: options.template,
    style: options.style,
    borderWidth: clamp(options.style.borderWidth, 0, 0.05) * shortEdge,
  };
}

export function normaliseTransform(transform: Partial<PhotoTransform> | undefined): PhotoTransform {
  return {
    zoom: clamp(transform?.zoom ?? 1, 1, MAX_ZOOM),
    offsetX: clamp(transform?.offsetX ?? 0, -1, 1),
    offsetY: clamp(transform?.offsetY ?? 0, -1, 1),
  };
}

/**
 * Source rectangle (in image pixels) that must be drawn into a cell so the
 * photo covers it completely, honouring zoom and pan.
 */
export function computeSourceCrop(
  source: Size,
  frame: Size,
  transform: Partial<PhotoTransform> = DEFAULT_TRANSFORM,
): Rect {
  const safe = normaliseTransform(transform);
  const sourceWidth = Math.max(1, source.width);
  const sourceHeight = Math.max(1, source.height);
  const frameWidth = Math.max(1, frame.width);
  const frameHeight = Math.max(1, frame.height);

  const coverScale = Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight);
  const scale = coverScale * safe.zoom;

  const cropWidth = Math.min(sourceWidth, frameWidth / scale);
  const cropHeight = Math.min(sourceHeight, frameHeight / scale);

  const slackX = (sourceWidth - cropWidth) / 2;
  const slackY = (sourceHeight - cropHeight) / 2;

  return {
    x: slackX + safe.offsetX * slackX,
    y: slackY + safe.offsetY * slackY,
    width: cropWidth,
    height: cropHeight,
  };
}

/**
 * Equivalent of `computeSourceCrop` for renderers that cannot crop the source
 * (React Native `<Image>`): returns the size and translation of an image laid
 * out with `resizeMode="cover"` inside a clipping container.
 */
export function computeCoverLayout(
  source: Size,
  frame: Size,
  transform: Partial<PhotoTransform> = DEFAULT_TRANSFORM,
): { width: number; height: number; translateX: number; translateY: number } {
  const safe = normaliseTransform(transform);
  const sourceWidth = Math.max(1, source.width);
  const sourceHeight = Math.max(1, source.height);
  const frameWidth = Math.max(1, frame.width);
  const frameHeight = Math.max(1, frame.height);

  const scale = Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight) * safe.zoom;
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const slackX = (width - frameWidth) / 2;
  const slackY = (height - frameHeight) / 2;

  return {
    width,
    height,
    translateX: -safe.offsetX * slackX,
    translateY: -safe.offsetY * slackY,
  };
}

/** Largest rectangle with `ratio` that fits inside `bounds`. */
export function fitContain(bounds: Size, ratio: AspectRatio): Size {
  const value = ratioValue(ratio);
  const byWidth = { width: bounds.width, height: bounds.width / value };
  if (byWidth.height <= bounds.height) return byWidth;
  return { width: bounds.height * value, height: bounds.height };
}

/** Index of the frame under a point, or -1. Topmost cell wins. */
export function hitTest(frames: CollageFrame[], x: number, y: number): number {
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const { rect } = frames[i];
    if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
      return frames[i].index;
    }
  }
  return -1;
}
