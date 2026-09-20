import { describe, expect, it } from 'vitest';
import {
  ASPECT_RATIOS,
  MAX_PHOTOS,
  autoGrid,
  computeCanvasSize,
  computeCoverLayout,
  computeSourceCrop,
  createPlan,
  DEFAULT_STYLE,
  getLayout,
  getLayouts,
  getQuality,
  getRatio,
  hitTest,
  normaliseTransform,
  resolveFrames,
  STYLE_PRESETS,
  suggestFileName,
} from '../src/index.js';

const EPSILON = 1e-6;

describe('aspect ratios', () => {
  it('exposes unique ids and sane ratios', () => {
    const ids = new Set(ASPECT_RATIOS.map((ratio) => ratio.id));
    expect(ids.size).toBe(ASPECT_RATIOS.length);
    for (const ratio of ASPECT_RATIOS) {
      expect(ratio.w).toBeGreaterThan(0);
      expect(ratio.h).toBeGreaterThan(0);
      expect(ratio.shortLabel).toBe(`${ratio.w}:${ratio.h}`);
    }
  });

  it('falls back to the first ratio for unknown ids', () => {
    expect(getRatio('does-not-exist').id).toBe(ASPECT_RATIOS[0].id);
  });

  it('keeps the long edge at the requested quality', () => {
    for (const ratio of ASPECT_RATIOS) {
      const size = computeCanvasSize(ratio, 2048);
      expect(Math.max(size.width, size.height)).toBe(2048);
      expect(size.width % 2).toBe(0);
      expect(size.height % 2).toBe(0);
      const actual = size.width / size.height;
      expect(Math.abs(actual - ratio.w / ratio.h)).toBeLessThan(0.01);
    }
  });

  it('clamps absurd long edges', () => {
    expect(computeCanvasSize(getRatio('1-1'), 1_000_000).width).toBe(8192);
    expect(computeCanvasSize(getRatio('1-1'), -5).width).toBe(64);
  });

  it('resolves quality presets with a fallback', () => {
    expect(getQuality('social').longEdge).toBe(1080);
    expect(getQuality('nope').longEdge).toBe(2048);
  });
});

describe('layout templates', () => {
  const allTemplates = Array.from({ length: MAX_PHOTOS }, (_, i) => getLayouts(i + 1)).flat();

  it('offers at least one layout for every supported photo count', () => {
    for (let count = 1; count <= MAX_PHOTOS; count += 1) {
      expect(getLayouts(count).length).toBeGreaterThan(0);
    }
  });

  it('never returns duplicate ids for the same photo count', () => {
    for (let count = 1; count <= MAX_PHOTOS; count += 1) {
      const ids = getLayouts(count).map((layout) => layout.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('declares the right number of slots', () => {
    for (let count = 1; count <= MAX_PHOTOS; count += 1) {
      for (const layout of getLayouts(count)) {
        expect(layout.slots).toBe(count);
        expect(layout.cells).toHaveLength(count);
      }
    }
  });

  it('tiles the unit square exactly', () => {
    for (const layout of allTemplates) {
      const area = layout.cells.reduce((acc, cell) => acc + cell.width * cell.height, 0);
      expect(Math.abs(area - 1)).toBeLessThan(1e-3);
      for (const cell of layout.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(-EPSILON);
        expect(cell.y).toBeGreaterThanOrEqual(-EPSILON);
        expect(cell.x + cell.width).toBeLessThanOrEqual(1 + EPSILON);
        expect(cell.y + cell.height).toBeLessThanOrEqual(1 + EPSILON);
        expect(cell.width).toBeGreaterThan(0);
        expect(cell.height).toBeGreaterThan(0);
      }
    }
  });

  it('never overlaps two cells', () => {
    for (const layout of allTemplates) {
      for (let i = 0; i < layout.cells.length; i += 1) {
        for (let j = i + 1; j < layout.cells.length; j += 1) {
          const a = layout.cells[i];
          const b = layout.cells[j];
          const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          expect(Math.min(overlapX, overlapY)).toBeLessThan(1e-6);
        }
      }
    }
  });

  it('falls back to the first layout for unknown ids', () => {
    expect(getLayout(4, 'nope').id).toBe(getLayouts(4)[0].id);
    expect(getLayout(4, 'grid-2x2').id).toBe('grid-2x2');
  });

  it('clamps the photo count to the supported range', () => {
    expect(getLayouts(0)[0].slots).toBe(1);
    expect(getLayouts(999)[0].slots).toBe(MAX_PHOTOS);
  });

  it('builds even auto grids', () => {
    const grid = autoGrid(6, 3);
    expect(grid.cells).toHaveLength(6);
    expect(grid.cells[0].width).toBeCloseTo(1 / 3, 6);
    expect(grid.cells[0].height).toBeCloseTo(1 / 2, 6);
  });
});

describe('frame resolution', () => {
  const canvas = { width: 1000, height: 1000 };

  it('keeps the outer padding and the inner gutter independent', () => {
    const style = { ...DEFAULT_STYLE, padding: 0.05, gutter: 0.02 };
    const frames = resolveFrames(getLayout(4, 'grid-2x2'), canvas, style);

    expect(frames[0].rect.x).toBeCloseTo(50, 4);
    expect(frames[0].rect.y).toBeCloseTo(50, 4);
    expect(frames[3].rect.x + frames[3].rect.width).toBeCloseTo(950, 4);
    expect(frames[3].rect.y + frames[3].rect.height).toBeCloseTo(950, 4);

    const horizontalGap = frames[1].rect.x - (frames[0].rect.x + frames[0].rect.width);
    const verticalGap = frames[2].rect.y - (frames[0].rect.y + frames[0].rect.height);
    expect(horizontalGap).toBeCloseTo(20, 4);
    expect(verticalGap).toBeCloseTo(20, 4);
  });

  it('produces edge to edge frames with no padding and no gutter', () => {
    const style = { ...DEFAULT_STYLE, padding: 0, gutter: 0 };
    const frames = resolveFrames(getLayout(2, 'split-v'), canvas, style);
    expect(frames[0].rect.x).toBeCloseTo(0, 4);
    expect(frames[0].rect.width).toBeCloseTo(500, 4);
    expect(frames[1].rect.x + frames[1].rect.width).toBeCloseTo(1000, 4);
  });

  it('raises the padding so a large gutter never bleeds outside the canvas', () => {
    const style = { ...DEFAULT_STYLE, padding: 0, gutter: 0.1 };
    const frames = resolveFrames(getLayout(4, 'grid-2x2'), canvas, style);
    for (const frame of frames) {
      expect(frame.rect.x).toBeGreaterThanOrEqual(-EPSILON);
      expect(frame.rect.y).toBeGreaterThanOrEqual(-EPSILON);
      expect(frame.rect.x + frame.rect.width).toBeLessThanOrEqual(1000 + EPSILON);
      expect(frame.rect.y + frame.rect.height).toBeLessThanOrEqual(1000 + EPSILON);
    }
  });

  it('scales the corner radius with the smallest cell edge', () => {
    const style = { ...DEFAULT_STYLE, cornerRadius: 0.5, padding: 0, gutter: 0 };
    const frames = resolveFrames(getLayout(4, 'grid-2x2'), canvas, style);
    expect(frames[0].radius).toBeCloseTo(250, 4);
  });

  it('builds a complete plan', () => {
    const plan = createPlan({
      ratio: getRatio('9-16'),
      template: getLayout(3, 'hero-top-2'),
      style: DEFAULT_STYLE,
      longEdge: 1920,
    });
    expect(plan.canvas.height).toBe(1920);
    expect(plan.canvas.width).toBe(1080);
    expect(plan.frames).toHaveLength(3);
  });
});

describe('photo framing', () => {
  it('covers the cell exactly at zoom 1', () => {
    const crop = computeSourceCrop({ width: 4000, height: 3000 }, { width: 500, height: 500 });
    expect(crop.width).toBeCloseTo(3000, 4);
    expect(crop.height).toBeCloseTo(3000, 4);
    expect(crop.x).toBeCloseTo(500, 4);
    expect(crop.y).toBeCloseTo(0, 4);
  });

  it('pans within the available slack only', () => {
    const source = { width: 4000, height: 3000 };
    const frame = { width: 500, height: 500 };
    const left = computeSourceCrop(source, frame, { zoom: 1, offsetX: -1, offsetY: 0 });
    const right = computeSourceCrop(source, frame, { zoom: 1, offsetX: 1, offsetY: 0 });
    expect(left.x).toBeCloseTo(0, 4);
    expect(right.x + right.width).toBeCloseTo(4000, 4);
  });

  it('never pans on the axis that has no slack', () => {
    const crop = computeSourceCrop(
      { width: 4000, height: 3000 },
      { width: 500, height: 500 },
      { zoom: 1, offsetX: 0, offsetY: 1 },
    );
    expect(crop.y).toBeCloseTo(0, 4);
    expect(crop.height).toBeCloseTo(3000, 4);
  });

  it('shrinks the crop as the zoom grows', () => {
    const source = { width: 1000, height: 1000 };
    const frame = { width: 500, height: 500 };
    const base = computeSourceCrop(source, frame, { zoom: 1, offsetX: 0, offsetY: 0 });
    const zoomed = computeSourceCrop(source, frame, { zoom: 2, offsetX: 0, offsetY: 0 });
    expect(base.width).toBeCloseTo(1000, 4);
    expect(zoomed.width).toBeCloseTo(500, 4);
    expect(zoomed.x).toBeCloseTo(250, 4);
  });

  it('clamps the transform to a usable range', () => {
    expect(normaliseTransform({ zoom: 0.1, offsetX: -9, offsetY: 9 })).toEqual({
      zoom: 1,
      offsetX: -1,
      offsetY: 1,
    });
    expect(normaliseTransform(undefined)).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
    expect(normaliseTransform({ zoom: Number.NaN }).zoom).toBe(1);
  });

  it('matches the cover layout used by native renderers', () => {
    const source = { width: 4000, height: 3000 };
    const frame = { width: 500, height: 500 };
    const layout = computeCoverLayout(source, frame, { zoom: 1, offsetX: -1, offsetY: 0 });
    expect(layout.height).toBeCloseTo(500, 4);
    expect(layout.width).toBeCloseTo(666.6667, 3);
    expect(layout.translateX).toBeCloseTo((layout.width - frame.width) / 2, 4);
  });

  it('survives degenerate sizes', () => {
    const crop = computeSourceCrop({ width: 0, height: 0 }, { width: 0, height: 0 });
    expect(crop.width).toBeGreaterThan(0);
    expect(Number.isFinite(crop.x)).toBe(true);
  });
});

describe('hit testing', () => {
  it('returns the cell under the point, or -1', () => {
    const frames = resolveFrames(
      getLayout(4, 'grid-2x2'),
      { width: 1000, height: 1000 },
      {
        ...DEFAULT_STYLE,
        padding: 0,
        gutter: 0,
      },
    );
    expect(hitTest(frames, 10, 10)).toBe(0);
    expect(hitTest(frames, 990, 10)).toBe(1);
    expect(hitTest(frames, 990, 990)).toBe(3);
    expect(hitTest(frames, -10, 10)).toBe(-1);
  });
});

describe('presets', () => {
  it('exposes unique style preset ids', () => {
    const ids = STYLE_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds a deterministic file name', () => {
    const name = suggestFileName('9:16', new Date(2026, 0, 2, 3, 4));
    expect(name).toBe('collage-9x16-202601020304');
  });
});
