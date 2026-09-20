/** Single source of truth for the mobile visual language. */
export const colors = {
  bg: '#0b0d12',
  surface: '#141922',
  surfaceAlt: '#1c2330',
  border: '#262e3c',
  borderStrong: '#39445a',
  text: '#e9edf5',
  muted: '#93a0b8',
  accent: '#5b8cff',
  accentSoft: 'rgba(91, 140, 255, 0.16)',
  onAccent: '#05080f',
  danger: '#ff6b6b',
  success: '#3ddc97',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;
