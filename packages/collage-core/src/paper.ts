/**
 * Deterministic paper geometry for the expressive frame styles.
 *
 * Everything here is pure maths so the canvas renderer, the export pipeline and
 * React Native all produce the exact same collage from the same seed.
 */

import type { Point, Rect } from './types.js';

/** Small, fast, fully deterministic PRNG (mulberry32). */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixes integers into one stable seed (FNV-1a). */
export function mixSeed(...parts: number[]): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    hash = (hash ^ (Math.round(part) >>> 0)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Value noise that wraps around at t = 1, so a closed outline has no seam where
 * the last sample meets the first one.
 */
function periodicNoise(seed: number, knots: number): (t: number) => number {
  const random = createRandom(seed);
  const values: number[] = [];
  for (let i = 0; i < knots; i += 1) values.push(random() * 2 - 1);
  return (t) => {
    const wrapped = ((t % 1) + 1) % 1;
    const scaled = wrapped * knots;
    const index = Math.floor(scaled);
    const frac = scaled - index;
    const a = values[index % knots];
    const b = values[(index + 1) % knots];
    const smooth = frac * frac * (3 - 2 * frac);
    return a + (b - a) * smooth;
  };
}

/** Point on `rect` for edge 0..3 (top, right, bottom, left) at fraction `u`. */
function edgePoint(rect: Rect, edge: number, u: number): Point {
  switch (edge) {
    case 0:
      return { x: rect.x + rect.width * u, y: rect.y };
    case 1:
      return { x: rect.x + rect.width, y: rect.y + rect.height * u };
    case 2:
      return { x: rect.x + rect.width * (1 - u), y: rect.y + rect.height };
    default:
      return { x: rect.x, y: rect.y + rect.height * (1 - u) };
  }
}

const EDGE_NORMALS: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export interface TornEdges {
  /** Silhouette of the paper scrap. */
  paper: Point[];
  /** Opening the photo is clipped to, inset by the white lip. */
  opening: Point[];
}

/**
 * Builds a hand-torn silhouette around `paperRect` plus a matching opening
 * around `openingRect`.
 *
 * Both polygons are walked with the same parameterisation and share the same
 * noise samples, so the white lip between them keeps an even width all the way
 * around instead of pinching at the corners.
 */
export function tornEdges(
  paperRect: Rect,
  openingRect: Rect,
  seed: number,
  amplitude: number,
): TornEdges {
  const shortEdge = Math.max(1, Math.min(paperRect.width, paperRect.height));
  const lengths = [paperRect.width, paperRect.height, paperRect.width, paperRect.height];
  // Roughly one sample every 2.5% of the short edge keeps the tear jagged
  // without exploding the point count on very large exports.
  const step = Math.max(2, shortEdge * 0.025);

  const coarse = periodicNoise(seed, 9);
  const mid = periodicNoise(mixSeed(seed, 0x5bf0), 29);
  const fine = periodicNoise(mixSeed(seed, 0x9e37), 97);
  const grain = createRandom(mixSeed(seed, 0x2545));

  const paper: Point[] = [];
  const opening: Point[] = [];

  let walked = 0;
  const perimeter = lengths[0] + lengths[1] + lengths[2] + lengths[3];

  for (let edge = 0; edge < 4; edge += 1) {
    const length = lengths[edge];
    const samples = Math.max(3, Math.round(length / step));
    const normal = EDGE_NORMALS[edge];

    for (let i = 0; i < samples; i += 1) {
      const u = i / samples;
      const t = (walked + length * u) / perimeter;
      // Three octaves plus per-sample grain: the low ones make the edge
      // wander, the high ones make it look ripped rather than merely wavy.
      const wander = coarse(t) * 0.52 + mid(t) * 0.34;
      const rip = fine(t) * 0.42 + (grain() - 0.5) * 0.7;
      const offset = (wander + rip) * amplitude + amplitude * 0.4;

      const outerPoint = edgePoint(paperRect, edge, u);
      const innerPoint = edgePoint(openingRect, edge, u);
      paper.push({ x: outerPoint.x + normal.x * offset, y: outerPoint.y + normal.y * offset });
      opening.push({ x: innerPoint.x + normal.x * offset, y: innerPoint.y + normal.y * offset });
    }
    walked += length;
  }

  return { paper, opening };
}

/** Axis-aligned bounding box of a polygon. */
export function boundsOf(points: Point[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Scales a rectangle around its own centre. */
export function scaleRect(rect: Rect, factor: number): Rect {
  const width = rect.width * factor;
  const height = rect.height * factor;
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

/** Grows (or shrinks, with a negative amount) a rectangle on every side. */
export function expandRect(rect: Rect, amount: number): Rect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: Math.max(1, rect.width + amount * 2),
    height: Math.max(1, rect.height + amount * 2),
  };
}

/** Serialises a polygon to an SVG path, for renderers without a 2D context. */
export function toSvgPath(points: Point[]): string {
  if (points.length === 0) return '';
  const head = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  const tail = points
    .slice(1)
    .map((point) => `L${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join('');
  return `${head}${tail}Z`;
}
