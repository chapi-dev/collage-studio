import { getQuality, ratioValue } from './aspect-ratios.js';
import { createRandom, expandRect, mixSeed, scaleRect, tornEdges } from './paper.js';
import type {
  AspectRatio,
  CollageFrame,
  CollagePlan,
  CollageStyle,
  LayoutTemplate,
  PhotoTransform,
  Point,
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
  frameStyle: 'clean',
  paperColor: '#fdfbf7',
  scatter: 0.5,
  seed: 1,
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
 *
 * The expressive frame styles then dress each cell: `torn` wraps it in a
 * hand-torn paper scrap and `polaroid` turns it into a rotated instant-film
 * card. Both are driven by `style.seed`, so the same settings always rebuild
 * the exact same collage.
 */
export function resolveFrames(
  template: LayoutTemplate,
  canvas: Size,
  style: CollageStyle,
): CollageFrame[] {
  const shortEdge = Math.min(canvas.width, canvas.height);
  const frameStyle = style.frameStyle ?? 'clean';
  const scatter = clamp(style.scatter ?? 0, 0, 1);
  const seed = Math.round(style.seed ?? 1);

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
    const base = insetRect(raw, bleed);
    const random = createRandom(mixSeed(seed, index));

    if (frameStyle === 'polaroid') {
      return containFrame(polaroidFrame(index, base, scatter, random), canvas);
    }
    if (frameStyle === 'torn') {
      return containFrame(tornFrame(index, base, scatter, seed, random), canvas);
    }

    return {
      index,
      rect: base,
      radius: radiusFactor * Math.min(base.width, base.height),
      rotation: 0,
      outer: base,
    };
  });
}

/** Axis-aligned bounding box of a rectangle rotated around its own centre. */
function rotatedBounds(rect: Rect, rotation: number): Rect {
  if (!rotation) return rect;
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  const width = rect.width * cos + rect.height * sin;
  const height = rect.width * sin + rect.height * cos;
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

/** Slides a frame back inside the canvas so tilted cards never get sliced. */
function containFrame(frame: CollageFrame, canvas: Size): CollageFrame {
  const bounds = rotatedBounds(frame.outer, frame.rotation);
  let dx = 0;
  let dy = 0;

  if (bounds.width <= canvas.width) {
    if (bounds.x < 0) dx = -bounds.x;
    else if (bounds.x + bounds.width > canvas.width) dx = canvas.width - bounds.x - bounds.width;
  }
  if (bounds.height <= canvas.height) {
    if (bounds.y < 0) dy = -bounds.y;
    else if (bounds.y + bounds.height > canvas.height)
      dy = canvas.height - bounds.y - bounds.height;
  }
  if (dx === 0 && dy === 0) return frame;

  const move = (rect: Rect): Rect => ({ ...rect, x: rect.x + dx, y: rect.y + dy });
  const movePoints = (points?: Point[]) =>
    points?.map((point) => ({ x: point.x + dx, y: point.y + dy }));

  return {
    ...frame,
    rect: move(frame.rect),
    outer: move(frame.outer),
    paper: movePoints(frame.paper),
    opening: movePoints(frame.opening),
  };
}

/**
 * Instant-film card: even margins on three sides, a deep one at the bottom.
 * Cards grow past their cell and tilt so they overlap like a handful of prints
 * dropped on a table.
 */
function polaroidFrame(
  index: number,
  base: Rect,
  scatter: number,
  random: () => number,
): CollageFrame {
  const outer = scaleRect(base, 1 + scatter * 0.14);
  const unit = Math.min(outer.width, outer.height);
  const side = unit * 0.055;
  const bottom = Math.min(unit * 0.17, Math.max(side, outer.height - side - unit * 0.25));

  const rect: Rect = {
    x: outer.x + side,
    y: outer.y + side,
    width: Math.max(1, outer.width - side * 2),
    height: Math.max(1, outer.height - side - bottom),
  };

  return {
    index,
    rect,
    radius: unit * 0.008,
    rotation: scatter > 0 ? (random() * 2 - 1) * scatter * 0.16 : 0,
    outer,
  };
}

/** Scrap of paper: torn silhouette, white lip, barely tilted. */
function tornFrame(
  index: number,
  base: Rect,
  scatter: number,
  seed: number,
  random: () => number,
): CollageFrame {
  const unit = Math.min(base.width, base.height);
  const amplitude = unit * (0.03 + scatter * 0.055);
  const lip = unit * (0.028 + scatter * 0.03);

  const paperRect = scaleRect(base, 1 + scatter * 0.05);
  const openingRect = insetRect(paperRect, lip);
  const { paper, opening } = tornEdges(
    paperRect,
    openingRect,
    mixSeed(seed, index, 0x7a17),
    amplitude,
  );

  return {
    index,
    rect: openingRect,
    radius: 0,
    rotation: scatter > 0 ? (random() * 2 - 1) * scatter * 0.06 : 0,
    outer: expandRect(paperRect, amplitude),
    paper,
    opening,
  };
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

/**
 * Maps a canvas point into a frame's own, unrotated coordinate system so hit
 * testing and dragging keep working on tilted cells.
 */
export function toFrameSpace(frame: CollageFrame, x: number, y: number): Point {
  if (!frame.rotation) return { x, y };
  const cx = frame.outer.x + frame.outer.width / 2;
  const cy = frame.outer.y + frame.outer.height / 2;
  const cos = Math.cos(-frame.rotation);
  const sin = Math.sin(-frame.rotation);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

/** Rotates a canvas-space delta into a frame's own coordinate system. */
export function rotateDelta(rotation: number, dx: number, dy: number): Point {
  if (!rotation) return { x: dx, y: dy };
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/** Rotates a canvas-space delta into a frame's own coordinate system. */
export function deltaToFrameSpace(frame: CollageFrame, dx: number, dy: number): Point {
  return rotateDelta(frame.rotation, dx, dy);
}

/** Index of the frame under a point, or -1. Topmost cell wins. */
export function hitTest(frames: CollageFrame[], x: number, y: number): number {
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const frame = frames[i];
    const { rect } = frame;
    const point = toFrameSpace(frame, x, y);
    if (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    ) {
      return frame.index;
    }
  }
  return -1;
}
