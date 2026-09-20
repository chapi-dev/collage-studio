import type { LayoutTemplate, Rect } from './types.js';

interface BandSpec {
  /** Number of cells inside the band. */
  count: number;
  /** Relative thickness of the band. Defaults to 1. */
  weight?: number;
  /** Relative widths of the cells inside the band. Defaults to equal shares. */
  shares?: number[];
}

function distribute(weights: number[]): number[] {
  const sum = weights.reduce((acc, value) => acc + value, 0);
  return weights.map((value) => value / sum);
}

/** Builds cells from horizontal bands stacked top to bottom. */
function fromRows(bands: BandSpec[]): Rect[] {
  const heights = distribute(bands.map((band) => band.weight ?? 1));
  const cells: Rect[] = [];
  let y = 0;
  bands.forEach((band, bandIndex) => {
    const height = heights[bandIndex];
    const widths = distribute(band.shares ?? new Array(band.count).fill(1));
    let x = 0;
    for (let i = 0; i < band.count; i += 1) {
      cells.push({ x, y, width: widths[i], height });
      x += widths[i];
    }
    y += height;
  });
  return cells;
}

/** Builds cells from vertical bands laid out left to right. */
function fromColumns(bands: BandSpec[]): Rect[] {
  return fromRows(bands).map((cell) => ({
    x: cell.y,
    y: cell.x,
    width: cell.height,
    height: cell.width,
  }));
}

function template(id: string, name: string, cells: Rect[]): LayoutTemplate {
  return { id, name, slots: cells.length, cells };
}

const GOLDEN = 1.618;

/** Hand-tuned templates, indexed by the number of photos they hold. */
const CURATED: Record<number, LayoutTemplate[]> = {
  1: [template('single', 'Single frame', fromRows([{ count: 1 }]))],
  2: [
    template('split-v', 'Side by side', fromColumns([{ count: 1 }, { count: 1 }])),
    template('split-h', 'Stacked', fromRows([{ count: 1 }, { count: 1 }])),
    template('hero-left-1', 'Hero left', fromColumns([{ count: 1, weight: GOLDEN }, { count: 1 }])),
    template('hero-top-1', 'Hero top', fromRows([{ count: 1, weight: GOLDEN }, { count: 1 }])),
  ],
  3: [
    template('cols-3', 'Three columns', fromColumns([{ count: 1 }, { count: 1 }, { count: 1 }])),
    template('rows-3', 'Three rows', fromRows([{ count: 1 }, { count: 1 }, { count: 1 }])),
    template('hero-left-2', 'Hero left', fromColumns([{ count: 1, weight: GOLDEN }, { count: 2 }])),
    template('hero-top-2', 'Hero top', fromRows([{ count: 1, weight: GOLDEN }, { count: 2 }])),
    template(
      'hero-bottom-2',
      'Hero bottom',
      fromRows([{ count: 2 }, { count: 1, weight: GOLDEN }]),
    ),
    template(
      'strip-3',
      'Wide centre',
      fromRows([{ count: 1 }, { count: 1, weight: 1.6 }, { count: 1 }]),
    ),
  ],
  4: [
    template('grid-2x2', 'Grid 2x2', fromRows([{ count: 2 }, { count: 2 }])),
    template(
      'cols-4',
      'Four columns',
      fromColumns([{ count: 1 }, { count: 1 }, { count: 1 }, { count: 1 }]),
    ),
    template(
      'rows-4',
      'Four rows',
      fromRows([{ count: 1 }, { count: 1 }, { count: 1 }, { count: 1 }]),
    ),
    template('hero-left-3', 'Hero left', fromColumns([{ count: 1, weight: 1.75 }, { count: 3 }])),
    template('hero-top-3', 'Hero top', fromRows([{ count: 1, weight: 1.75 }, { count: 3 }])),
    template('one-three', 'Banner + trio', fromRows([{ count: 1, weight: 1.1 }, { count: 3 }])),
  ],
  5: [
    template('hero-top-4', 'Hero top', fromRows([{ count: 1, weight: 1.9 }, { count: 4 }])),
    template('hero-left-4', 'Hero left', fromColumns([{ count: 1, weight: 1.9 }, { count: 4 }])),
    template('two-three', 'Two over three', fromRows([{ count: 2, weight: 1.15 }, { count: 3 }])),
    template('three-two', 'Three over two', fromRows([{ count: 3 }, { count: 2, weight: 1.15 }])),
    template('pinwheel-5', 'Pinwheel', fromColumns([{ count: 2, weight: 1.35 }, { count: 3 }])),
  ],
  6: [
    template('grid-3x2', 'Grid 3x2', fromRows([{ count: 3 }, { count: 3 }])),
    template('grid-2x3', 'Grid 2x3', fromRows([{ count: 2 }, { count: 2 }, { count: 2 }])),
    template('hero-top-5', 'Hero top', fromRows([{ count: 1, weight: 1.7 }, { count: 5 }])),
    template('two-four', 'Two over four', fromRows([{ count: 2, weight: 1.3 }, { count: 4 }])),
    template('mosaic-6', 'Mosaic', [
      { x: 0, y: 0, width: 0.66, height: 0.66 },
      { x: 0.66, y: 0, width: 0.34, height: 0.33 },
      { x: 0.66, y: 0.33, width: 0.34, height: 0.33 },
      { x: 0, y: 0.66, width: 0.33, height: 0.34 },
      { x: 0.33, y: 0.66, width: 0.33, height: 0.34 },
      { x: 0.66, y: 0.66, width: 0.34, height: 0.34 },
    ]),
  ],
  7: [
    template('four-three', 'Four over three', fromRows([{ count: 4 }, { count: 3 }])),
    template(
      'hero-top-6',
      'Hero top',
      fromRows([{ count: 1, weight: 1.9 }, { count: 3 }, { count: 3 }]),
    ),
    template('three-four', 'Three over four', fromRows([{ count: 3, weight: 1.2 }, { count: 4 }])),
    template('mosaic-7', 'Mosaic', [
      { x: 0, y: 0, width: 0.6, height: 0.5 },
      { x: 0.6, y: 0, width: 0.4, height: 0.25 },
      { x: 0.6, y: 0.25, width: 0.4, height: 0.25 },
      { x: 0, y: 0.5, width: 0.25, height: 0.5 },
      { x: 0.25, y: 0.5, width: 0.25, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.25, height: 0.5 },
      { x: 0.75, y: 0.5, width: 0.25, height: 0.5 },
    ]),
  ],
  8: [
    template('grid-4x2', 'Grid 4x2', fromRows([{ count: 4 }, { count: 4 }])),
    template(
      'grid-2x4',
      'Grid 2x4',
      fromRows([{ count: 2 }, { count: 2 }, { count: 2 }, { count: 2 }]),
    ),
    template(
      'hero-top-7',
      'Hero top',
      fromRows([{ count: 1, weight: 1.8 }, { count: 3 }, { count: 4 }]),
    ),
    template('three-three-two', 'Cascade', fromRows([{ count: 3 }, { count: 3 }, { count: 2 }])),
  ],
  9: [
    template('grid-3x3', 'Grid 3x3', fromRows([{ count: 3 }, { count: 3 }, { count: 3 }])),
    template(
      'hero-top-8',
      'Hero top',
      fromRows([{ count: 1, weight: 2 }, { count: 4 }, { count: 4 }]),
    ),
    template(
      'magazine-9',
      'Magazine',
      fromColumns([{ count: 3 }, { count: 3, weight: 1.5 }, { count: 3 }]),
    ),
  ],
};

/** Even grid for an arbitrary number of photos; the last row stretches to fill. */
export function autoGrid(count: number, columns?: number): LayoutTemplate {
  const safeCount = Math.max(1, Math.floor(count));
  const cols = Math.max(1, columns ?? Math.ceil(Math.sqrt(safeCount)));
  const rows = Math.ceil(safeCount / cols);
  const bands: BandSpec[] = [];
  let remaining = safeCount;
  for (let r = 0; r < rows; r += 1) {
    const inRow = Math.min(cols, remaining);
    bands.push({ count: inRow });
    remaining -= inRow;
  }
  return template(`auto-${cols}x${rows}`, `Grid ${cols}x${rows}`, fromRows(bands));
}

/** Balanced mosaic for an arbitrary number of photos. */
export function autoRows(count: number): LayoutTemplate {
  const safeCount = Math.max(1, Math.floor(count));
  const rows = Math.max(1, Math.round(Math.sqrt(safeCount / 1.4)));
  const base = Math.floor(safeCount / rows);
  const extra = safeCount % rows;
  const bands: BandSpec[] = [];
  for (let r = 0; r < rows; r += 1) {
    bands.push({ count: base + (r < extra ? 1 : 0) });
  }
  return template(`auto-rows-${safeCount}`, `Mosaic ${safeCount}`, fromRows(bands));
}

export const MAX_PHOTOS = 12;

/**
 * Every layout available for a given photo count, curated first and then
 * generated fallbacks so any count between 1 and MAX_PHOTOS is supported.
 */
export function getLayouts(count: number): LayoutTemplate[] {
  const safeCount = Math.min(MAX_PHOTOS, Math.max(1, Math.floor(count)));
  const curated = CURATED[safeCount] ?? [];
  const generated: LayoutTemplate[] = [];
  const seen = new Set(curated.map((item) => item.id));

  const candidates = [autoGrid(safeCount), autoRows(safeCount)];
  for (let cols = 2; cols <= 4; cols += 1) {
    if (safeCount > cols) candidates.push(autoGrid(safeCount, cols));
  }
  candidates.push(autoGrid(safeCount, 1));

  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    generated.push(candidate);
  }

  return [...curated, ...generated];
}

export function getLayout(count: number, id: string | undefined): LayoutTemplate {
  const layouts = getLayouts(count);
  return layouts.find((layout) => layout.id === id) ?? layouts[0];
}
