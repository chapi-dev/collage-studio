import { create } from 'zustand';
import {
  DEFAULT_QUALITY_ID,
  DEFAULT_RATIO_ID,
  DEFAULT_STYLE_PRESET_ID,
  DEFAULT_TRANSFORM,
  MAX_PHOTOS,
  clamp,
  getLayout,
  getLayouts,
  getStylePreset,
  normaliseTransform,
  type CollageStyle,
  type ExportFormat,
  type PhotoTransform,
} from '@collage/core';
import { loadPhoto, releasePhoto, type LoadedPhoto } from '../lib/images';

export interface PhotoEntry extends LoadedPhoto {
  transform: PhotoTransform;
}

interface StudioState {
  photos: PhotoEntry[];
  ratioId: string;
  layoutId: string | null;
  stylePresetId: string | null;
  style: CollageStyle;
  qualityId: string;
  format: ExportFormat;
  selected: number | null;
  loading: boolean;
  error: string | null;

  addFiles: (files: File[]) => Promise<void>;
  removePhoto: (id: string) => void;
  movePhoto: (from: number, to: number) => void;
  shufflePhotos: () => void;
  clearPhotos: () => void;

  setRatio: (ratioId: string) => void;
  setLayout: (layoutId: string) => void;
  cycleLayout: (direction: 1 | -1) => void;

  applyStylePreset: (presetId: string) => void;
  patchStyle: (patch: Partial<CollageStyle>) => void;

  setQuality: (qualityId: string) => void;
  setFormat: (format: ExportFormat) => void;

  select: (index: number | null) => void;
  patchTransform: (index: number, patch: Partial<PhotoTransform>) => void;
  nudgeTransform: (index: number, dx: number, dy: number) => void;
  resetTransform: (index: number) => void;
  resetAllTransforms: () => void;

  setError: (message: string | null) => void;
}

function withTransform(photo: LoadedPhoto): PhotoEntry {
  return { ...photo, transform: { ...DEFAULT_TRANSFORM } };
}

/** Keeps the selected layout valid when the number of photos changes. */
function reconcileLayout(count: number, layoutId: string | null): string | null {
  if (count === 0) return layoutId;
  const layouts = getLayouts(count);
  if (layoutId && layouts.some((layout) => layout.id === layoutId)) return layoutId;
  return layouts[0].id;
}

export const useStudio = create<StudioState>((set, get) => ({
  photos: [],
  ratioId: DEFAULT_RATIO_ID,
  layoutId: null,
  stylePresetId: DEFAULT_STYLE_PRESET_ID,
  style: { ...getStylePreset(DEFAULT_STYLE_PRESET_ID).style },
  qualityId: DEFAULT_QUALITY_ID,
  format: 'png',
  selected: null,
  loading: false,
  error: null,

  addFiles: async (files) => {
    const candidates = files.slice(0, MAX_PHOTOS);
    if (candidates.length === 0) return;

    const room = MAX_PHOTOS - get().photos.length;
    if (room <= 0) {
      set({ error: `A collage holds up to ${MAX_PHOTOS} photos. Remove one to add another.` });
      return;
    }

    set({ loading: true, error: null });
    const accepted: PhotoEntry[] = [];
    const failures: string[] = [];

    for (const file of candidates.slice(0, room)) {
      try {
        accepted.push(withTransform(await loadPhoto(file)));
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }

    const skipped = candidates.length - room;
    set((state) => {
      const photos = [...state.photos, ...accepted];
      return {
        photos,
        layoutId: reconcileLayout(photos.length, state.layoutId),
        loading: false,
        error:
          failures[0] ??
          (skipped > 0
            ? `Only ${MAX_PHOTOS} photos fit in one collage; ${skipped} skipped.`
            : null),
      };
    });
  },

  removePhoto: (id) => {
    set((state) => {
      const target = state.photos.find((photo) => photo.id === id);
      if (target) releasePhoto(target);
      const photos = state.photos.filter((photo) => photo.id !== id);
      return {
        photos,
        layoutId: reconcileLayout(photos.length, state.layoutId),
        selected: null,
      };
    });
  },

  movePhoto: (from, to) => {
    set((state) => {
      if (from === to || from < 0 || to < 0) return state;
      if (from >= state.photos.length || to >= state.photos.length) return state;
      const photos = [...state.photos];
      const [moved] = photos.splice(from, 1);
      photos.splice(to, 0, moved);
      return { photos, selected: to };
    });
  },

  shufflePhotos: () => {
    set((state) => {
      const photos = [...state.photos];
      for (let i = photos.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [photos[i], photos[j]] = [photos[j], photos[i]];
      }
      return { photos, selected: null };
    });
  },

  clearPhotos: () => {
    get().photos.forEach(releasePhoto);
    set({ photos: [], selected: null, layoutId: null, error: null });
  },

  setRatio: (ratioId) => set({ ratioId }),

  setLayout: (layoutId) => set({ layoutId }),

  cycleLayout: (direction) => {
    const { photos, layoutId } = get();
    if (photos.length === 0) return;
    const layouts = getLayouts(photos.length);
    const current = Math.max(
      0,
      layouts.findIndex((layout) => layout.id === (layoutId ?? layouts[0].id)),
    );
    const next = (current + direction + layouts.length) % layouts.length;
    set({ layoutId: layouts[next].id });
  },

  applyStylePreset: (presetId) =>
    set({ stylePresetId: presetId, style: { ...getStylePreset(presetId).style } }),

  patchStyle: (patch) =>
    set((state) => ({ style: { ...state.style, ...patch }, stylePresetId: null })),

  setQuality: (qualityId) => set({ qualityId }),
  setFormat: (format) => set({ format }),

  select: (index) => set({ selected: index }),

  patchTransform: (index, patch) =>
    set((state) => {
      const photos = state.photos.map((photo, i) =>
        i === index
          ? { ...photo, transform: normaliseTransform({ ...photo.transform, ...patch }) }
          : photo,
      );
      return { photos };
    }),

  nudgeTransform: (index, dx, dy) =>
    set((state) => {
      const photos = state.photos.map((photo, i) => {
        if (i !== index) return photo;
        return {
          ...photo,
          transform: normaliseTransform({
            zoom: photo.transform.zoom,
            offsetX: clamp(photo.transform.offsetX + dx, -1, 1),
            offsetY: clamp(photo.transform.offsetY + dy, -1, 1),
          }),
        };
      });
      return { photos };
    }),

  resetTransform: (index) =>
    set((state) => ({
      photos: state.photos.map((photo, i) =>
        i === index ? { ...photo, transform: { ...DEFAULT_TRANSFORM } } : photo,
      ),
    })),

  resetAllTransforms: () =>
    set((state) => ({
      photos: state.photos.map((photo) => ({ ...photo, transform: { ...DEFAULT_TRANSFORM } })),
    })),

  setError: (message) => set({ error: message }),
}));

/** Layout currently in use, always valid for the current photo count. */
export function useActiveLayout() {
  const count = useStudio((state) => state.photos.length);
  const layoutId = useStudio((state) => state.layoutId);
  return getLayout(Math.max(1, count), layoutId ?? undefined);
}
