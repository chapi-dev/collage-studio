import type { AspectRatio, QualityPreset } from './types.js';

/**
 * Curated list of output ratios. Ordered the way they are presented in the UI:
 * square first, then portrait (social/stories), then landscape (feed/desktop).
 */
export const ASPECT_RATIOS: AspectRatio[] = [
  {
    id: '1-1',
    label: 'Square',
    shortLabel: '1:1',
    w: 1,
    h: 1,
    group: 'square',
    hint: 'Instagram post, profile grid',
  },
  {
    id: '4-5',
    label: 'Portrait',
    shortLabel: '4:5',
    w: 4,
    h: 5,
    group: 'portrait',
    hint: 'Instagram portrait, best feed reach',
  },
  {
    id: '2-3',
    label: 'Photo portrait',
    shortLabel: '2:3',
    w: 2,
    h: 3,
    group: 'portrait',
    hint: '10x15 cm print, Pinterest',
  },
  {
    id: '3-4',
    label: 'Classic portrait',
    shortLabel: '3:4',
    w: 3,
    h: 4,
    group: 'portrait',
    hint: 'Tablet, 15x20 cm print',
  },
  {
    id: '9-16',
    label: 'Story',
    shortLabel: '9:16',
    w: 9,
    h: 16,
    group: 'portrait',
    hint: 'Stories, Reels, TikTok, Shorts',
  },
  {
    id: '4-3',
    label: 'Classic landscape',
    shortLabel: '4:3',
    w: 4,
    h: 3,
    group: 'landscape',
    hint: 'Camera default, presentations',
  },
  {
    id: '3-2',
    label: 'Photo landscape',
    shortLabel: '3:2',
    w: 3,
    h: 2,
    group: 'landscape',
    hint: 'DSLR frame, 15x10 cm print',
  },
  {
    id: '16-9',
    label: 'Widescreen',
    shortLabel: '16:9',
    w: 16,
    h: 9,
    group: 'landscape',
    hint: 'YouTube, desktop wallpaper, slides',
  },
  {
    id: '21-9',
    label: 'Cinematic',
    shortLabel: '21:9',
    w: 21,
    h: 9,
    group: 'landscape',
    hint: 'Ultrawide banner, cover image',
  },
];

export const DEFAULT_RATIO_ID = '1-1';

export function getRatio(id: string): AspectRatio {
  return ASPECT_RATIOS.find((ratio) => ratio.id === id) ?? ASPECT_RATIOS[0];
}

export function ratioValue(ratio: AspectRatio): number {
  return ratio.w / ratio.h;
}

/** Export resolutions. `longEdge` is applied to whichever axis is longer. */
export const QUALITY_PRESETS: QualityPreset[] = [
  { id: 'social', label: 'Social', longEdge: 1080, hint: 'Feed and stories, small files' },
  { id: 'high', label: 'High', longEdge: 2048, hint: 'Retina screens, cropping headroom' },
  { id: 'print', label: 'Print', longEdge: 3200, hint: 'Photo prints up to A4 at 300 dpi' },
  { id: 'max', label: 'Maximum', longEdge: 4096, hint: 'Archive master, large posters' },
];

export const DEFAULT_QUALITY_ID = 'high';

export function getQuality(id: string): QualityPreset {
  return QUALITY_PRESETS.find((preset) => preset.id === id) ?? QUALITY_PRESETS[1];
}
