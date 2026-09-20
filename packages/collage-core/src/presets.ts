import type { CollageStyle } from './types.js';
import { DEFAULT_STYLE } from './geometry.js';

export interface StylePreset {
  id: string;
  label: string;
  /** Swatch used in the UI selector. */
  swatch: string;
  style: CollageStyle;
}

/** Curated looks. Each one is a complete, ready to export style. */
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'seamless',
    label: 'Seamless',
    swatch: '#111318',
    style: {
      ...DEFAULT_STYLE,
      gutter: 0,
      padding: 0,
      cornerRadius: 0,
      background: '#111318',
    },
  },
  {
    id: 'studio',
    label: 'Studio',
    swatch: '#0f1115',
    style: { ...DEFAULT_STYLE },
  },
  {
    id: 'polaroid',
    label: 'Polaroid',
    swatch: '#ffffff',
    style: {
      ...DEFAULT_STYLE,
      gutter: 0.028,
      padding: 0.045,
      cornerRadius: 0.01,
      background: '#ffffff',
      shadow: 0.35,
    },
  },
  {
    id: 'soft',
    label: 'Soft',
    swatch: '#f3ece4',
    style: {
      ...DEFAULT_STYLE,
      gutter: 0.022,
      padding: 0.032,
      cornerRadius: 0.12,
      background: '#f3ece4',
    },
  },
  {
    id: 'bold',
    label: 'Bold',
    swatch: '#ff4d3d',
    style: {
      ...DEFAULT_STYLE,
      gutter: 0.03,
      padding: 0.04,
      cornerRadius: 0.02,
      background: '#ff4d3d',
    },
  },
  {
    id: 'frame',
    label: 'Framed',
    swatch: '#1b1d24',
    style: {
      ...DEFAULT_STYLE,
      gutter: 0.02,
      padding: 0.05,
      cornerRadius: 0,
      background: '#1b1d24',
      borderWidth: 0.004,
      borderColor: '#e8c37a',
    },
  },
];

export const DEFAULT_STYLE_PRESET_ID = 'studio';

export function getStylePreset(id: string): StylePreset {
  return STYLE_PRESETS.find((preset) => preset.id === id) ?? STYLE_PRESETS[1];
}

/** Background colours offered in the colour picker. */
export const BACKGROUND_SWATCHES: string[] = [
  '#000000',
  '#0f1115',
  '#1b1d24',
  '#3a3f4b',
  '#6b7280',
  '#ffffff',
  '#f3ece4',
  '#f6d7c4',
  '#ffd166',
  '#ff4d3d',
  '#ef476f',
  '#8b5cf6',
  '#118ab2',
  '#06d6a0',
  '#2b5d3b',
  '#1d3557',
];

export function suggestFileName(ratioShortLabel: string, date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join('');
  return `collage-${ratioShortLabel.replace(':', 'x')}-${stamp}`;
}
