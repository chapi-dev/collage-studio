import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PHOTOS, MAX_ZOOM, getLayouts } from '@collage/core';
import type { LoadedPhoto } from '../src/lib/images';

const decoded: LoadedPhoto[] = [];

vi.mock('../src/lib/images', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/images')>('../src/lib/images');
  return {
    ...actual,
    loadPhoto: vi.fn(async (file: File) => {
      const photo: LoadedPhoto = {
        id: `mock-${decoded.length}-${file.name}`,
        name: file.name,
        width: 4000,
        height: 3000,
        previewUrl: `blob:${file.name}`,
        source: {} as LoadedPhoto['source'],
      };
      decoded.push(photo);
      return photo;
    }),
    releasePhoto: vi.fn(),
  };
});

const { useStudio } = await import('../src/state/store');

function fakeFiles(count: number): File[] {
  return Array.from(
    { length: count },
    (_, i) => new File([new Uint8Array([1, 2, 3])], `photo-${i}.jpg`, { type: 'image/jpeg' }),
  );
}

describe('studio store', () => {
  beforeEach(() => {
    decoded.length = 0;
    useStudio.getState().clearPhotos();
    useStudio.setState({ ratioId: '1-1', qualityId: 'high', format: 'png', error: null });
    useStudio.getState().applyStylePreset('studio');
  });

  it('starts empty with sensible defaults', () => {
    const state = useStudio.getState();
    expect(state.photos).toHaveLength(0);
    expect(state.ratioId).toBe('1-1');
    expect(state.format).toBe('png');
  });

  it('adds photos and picks a valid layout', async () => {
    await useStudio.getState().addFiles(fakeFiles(4));
    const state = useStudio.getState();
    expect(state.photos).toHaveLength(4);
    expect(state.layoutId).toBe(getLayouts(4)[0].id);
  });

  it('re-selects a layout when the photo count changes', async () => {
    await useStudio.getState().addFiles(fakeFiles(4));
    useStudio.getState().setLayout('grid-2x2');
    await useStudio.getState().addFiles(fakeFiles(1));
    const state = useStudio.getState();
    expect(state.photos).toHaveLength(5);
    expect(getLayouts(5).some((layout) => layout.id === state.layoutId)).toBe(true);
  });

  it('keeps the chosen layout when it is still valid', async () => {
    await useStudio.getState().addFiles(fakeFiles(4));
    useStudio.getState().setLayout('hero-left-3');
    useStudio.setState({ ratioId: '9-16' });
    expect(useStudio.getState().layoutId).toBe('hero-left-3');
  });

  it('never accepts more than the maximum number of photos', async () => {
    await useStudio.getState().addFiles(fakeFiles(MAX_PHOTOS + 4));
    expect(useStudio.getState().photos).toHaveLength(MAX_PHOTOS);
    await useStudio.getState().addFiles(fakeFiles(1));
    expect(useStudio.getState().photos).toHaveLength(MAX_PHOTOS);
    expect(useStudio.getState().error).toContain(String(MAX_PHOTOS));
  });

  it('reorders photos', async () => {
    await useStudio.getState().addFiles(fakeFiles(3));
    const before = useStudio.getState().photos.map((photo) => photo.name);
    useStudio.getState().movePhoto(0, 2);
    const after = useStudio.getState().photos.map((photo) => photo.name);
    expect(after).toEqual([before[1], before[2], before[0]]);
  });

  it('ignores out of range reorders', async () => {
    await useStudio.getState().addFiles(fakeFiles(2));
    const before = useStudio.getState().photos.map((photo) => photo.name);
    useStudio.getState().movePhoto(0, 9);
    expect(useStudio.getState().photos.map((photo) => photo.name)).toEqual(before);
  });

  it('removes a photo and clears the selection', async () => {
    await useStudio.getState().addFiles(fakeFiles(3));
    const target = useStudio.getState().photos[1];
    useStudio.getState().select(1);
    useStudio.getState().removePhoto(target.id);
    expect(useStudio.getState().photos).toHaveLength(2);
    expect(useStudio.getState().selected).toBeNull();
  });

  it('clamps transforms to the supported range', async () => {
    await useStudio.getState().addFiles(fakeFiles(1));
    useStudio.getState().patchTransform(0, { zoom: 99, offsetX: 5 });
    expect(useStudio.getState().photos[0].transform).toEqual({
      zoom: MAX_ZOOM,
      offsetX: 1,
      offsetY: 0,
    });
    useStudio.getState().resetTransform(0);
    expect(useStudio.getState().photos[0].transform.zoom).toBe(1);
  });

  it('nudges within bounds', async () => {
    await useStudio.getState().addFiles(fakeFiles(1));
    useStudio.getState().nudgeTransform(0, -5, 0.5);
    expect(useStudio.getState().photos[0].transform.offsetX).toBe(-1);
    expect(useStudio.getState().photos[0].transform.offsetY).toBeCloseTo(0.5, 5);
  });

  it('cycles through the layouts in both directions', async () => {
    await useStudio.getState().addFiles(fakeFiles(3));
    const layouts = getLayouts(3);
    useStudio.getState().setLayout(layouts[0].id);
    useStudio.getState().cycleLayout(1);
    expect(useStudio.getState().layoutId).toBe(layouts[1].id);
    useStudio.getState().cycleLayout(-1);
    expect(useStudio.getState().layoutId).toBe(layouts[0].id);
    useStudio.getState().cycleLayout(-1);
    expect(useStudio.getState().layoutId).toBe(layouts[layouts.length - 1].id);
  });

  it('drops the preset marker when a style value is edited by hand', () => {
    useStudio.getState().applyStylePreset('polaroid');
    expect(useStudio.getState().stylePresetId).toBe('polaroid');
    useStudio.getState().patchStyle({ gutter: 0.05 });
    expect(useStudio.getState().stylePresetId).toBeNull();
    expect(useStudio.getState().style.gutter).toBe(0.05);
  });

  it('keeps every photo after a shuffle', async () => {
    await useStudio.getState().addFiles(fakeFiles(6));
    const before = useStudio
      .getState()
      .photos.map((photo) => photo.id)
      .sort();
    useStudio.getState().shufflePhotos();
    const after = useStudio
      .getState()
      .photos.map((photo) => photo.id)
      .sort();
    expect(after).toEqual(before);
  });
});
