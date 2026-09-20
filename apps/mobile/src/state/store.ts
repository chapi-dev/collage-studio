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

export interface MobilePhoto {
  id: string;
  uri: string;
  width: number;
  height: number;
  transform: PhotoTransform;
}

/** Shape returned by expo-image-picker, narrowed to what the editor needs. */
export interface PickedAsset {
  uri: string;
  width: number;
  height: number;
  assetId?: string | null;
  fileName?: string | null;
}

interface StudioState {
  photos: MobilePhoto[];
  ratioId: string;
  layoutId: string | null;
  stylePresetId: string | null;
  style: CollageStyle;
  qualityId: string;
  format: ExportFormat;
  selected: number | null;
  error: string | null;

  addAssets: (assets: PickedAsset[]) => void;
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

let sequence = 0;

function toPhoto(asset: PickedAsset): MobilePhoto {
  sequence += 1;
  return {
    id: `${asset.assetId ?? asset.uri}#${sequence}`,
    uri: asset.uri,
    width: Math.max(1, Math.round(asset.width)),
    height: Math.max(1, Math.round(asset.height)),
    transform: { ...DEFAULT_TRANSFORM },
  };
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
  error: null,

  addAssets: (assets) => {
    if (assets.length === 0) return;
    const room = MAX_PHOTOS - get().photos.length;
    if (room <= 0) {
      set({ error: `A collage holds up to ${MAX_PHOTOS} photos. Remove one to add another.` });
      return;
    }

    const accepted = assets.slice(0, room).map(toPhoto);
    const skipped = assets.length - accepted.length;

    set((state) => {
      const photos = [...state.photos, ...accepted];
      return {
        photos,
        layoutId: reconcileLayout(photos.length, state.layoutId),
        error:
          skipped > 0 ? `Only ${MAX_PHOTOS} photos fit in one collage; ${skipped} skipped.` : null,
      };
    });
  },

  removePhoto: (id) =>
    set((state) => {
      const photos = state.photos.filter((photo) => photo.id !== id);
      return {
        photos,
        layoutId: reconcileLayout(photos.length, state.layoutId),
        selected: null,
      };
    }),

  movePhoto: (from, to) =>
    set((state) => {
      if (from === to || from < 0 || to < 0) return state;
      if (from >= state.photos.length || to >= state.photos.length) return state;
      const photos = [...state.photos];
      const [moved] = photos.splice(from, 1);
      photos.splice(to, 0, moved);
      return { photos, selected: to };
    }),

  shufflePhotos: () =>
    set((state) => {
      const photos = [...state.photos];
      for (let i = photos.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [photos[i], photos[j]] = [photos[j], photos[i]];
      }
      return { photos, selected: null };
    }),

  clearPhotos: () => set({ photos: [], selected: null, layoutId: null, error: null }),

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
    set((state) => ({
      photos: state.photos.map((photo, i) =>
        i === index
          ? { ...photo, transform: normaliseTransform({ ...photo.transform, ...patch }) }
          : photo,
      ),
    })),

  nudgeTransform: (index, dx, dy) =>
    set((state) => ({
      photos: state.photos.map((photo, i) => {
        if (i !== index) return photo;
        return {
          ...photo,
          transform: normaliseTransform({
            zoom: photo.transform.zoom,
            offsetX: clamp(photo.transform.offsetX + dx, -1, 1),
            offsetY: clamp(photo.transform.offsetY + dy, -1, 1),
          }),
        };
      }),
    })),

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
