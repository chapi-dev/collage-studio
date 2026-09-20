/**
 * Core value objects shared by every renderer (DOM canvas, React Native, server side).
 * Everything here is pure data: no DOM, no React, no platform APIs.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * How every cell is dressed.
 *
 * - `clean`: rounded rectangles, the classic grid collage.
 * - `torn`: scraps of paper with hand-torn edges and a white fibrous lip.
 * - `polaroid`: instant-film cards with a thick bottom margin, scattered.
 */
export type FrameStyle = 'clean' | 'torn' | 'polaroid';

export type RatioGroup = 'square' | 'portrait' | 'landscape';

export interface AspectRatio {
  /** Stable identifier persisted in project files and deep links. */
  id: string;
  /** Human readable name, e.g. "Instagram story". */
  label: string;
  /** Compact notation, e.g. "9:16". */
  shortLabel: string;
  /** Numerator of the ratio. */
  w: number;
  /** Denominator of the ratio. */
  h: number;
  group: RatioGroup;
  /** Where this ratio is typically used. */
  hint: string;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  /** Number of photos the template holds. */
  slots: number;
  /** Cells expressed in a normalised unit square (0..1 on both axes). */
  cells: Rect[];
}

export interface CollageStyle {
  /** Space between cells, as a fraction of the canvas short edge (0..0.25). */
  gutter: number;
  /** Space around the collage, as a fraction of the canvas short edge (0..0.25). */
  padding: number;
  /** Cell corner radius, as a fraction of the cell short edge (0..0.5). */
  cornerRadius: number;
  /** CSS colour used to paint the canvas behind the photos. */
  background: string;
  /** Optional outline drawn around every cell, as a fraction of the canvas short edge. */
  borderWidth: number;
  borderColor: string;
  /** Drop shadow strength for the cells (0..1). */
  shadow: number;
  /** How every cell is dressed. */
  frameStyle: FrameStyle;
  /** Paper colour for the torn and polaroid styles. */
  paperColor: string;
  /** How wild the expressive styles get: rotation, overlap and tear size (0..1). */
  scatter: number;
  /** Reroll this to get a different, but still reproducible, arrangement. */
  seed: number;
}

/**
 * How a photo is framed inside its cell. The image always covers the cell;
 * `zoom` magnifies beyond the cover scale and the offsets pan within the
 * remaining slack (-1 = fully towards the top/left, 1 = bottom/right).
 */
export interface PhotoTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface CollageFrame {
  index: number;
  /** Area the photo is drawn into, before rotation. */
  rect: Rect;
  /** Corner radius in output pixels. */
  radius: number;
  /** Rotation in radians, applied around the centre of `outer`. */
  rotation: number;
  /** Everything the cell paints, including paper margins, before rotation. */
  outer: Rect;
  /** Torn paper silhouette in output pixels. Only set by the `torn` style. */
  paper?: Point[];
  /** Photo opening inside the torn silhouette. Only set by the `torn` style. */
  opening?: Point[];
}

export interface CollagePlan {
  canvas: Size;
  frames: CollageFrame[];
  ratio: AspectRatio;
  template: LayoutTemplate;
  style: CollageStyle;
  /** Border width resolved to output pixels. */
  borderWidth: number;
}

export interface QualityPreset {
  id: string;
  label: string;
  /** Long edge of the exported image, in pixels. */
  longEdge: number;
  hint: string;
}

export type ExportFormat = 'png' | 'jpeg' | 'webp';
