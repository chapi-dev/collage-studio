import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { ExportFormat } from '@collage/core';

interface FormatDescriptor {
  viewShot: 'png' | 'jpg';
  mimeType: string;
  uti: string;
  extension: string;
}

/**
 * Mobile only exposes the two formats every device can encode and share.
 * WebP is intentionally left out: react-native-view-shot cannot produce it on iOS.
 */
export const MOBILE_FORMATS: Record<'png' | 'jpeg', FormatDescriptor> = {
  png: { viewShot: 'png', mimeType: 'image/png', uti: 'public.png', extension: 'png' },
  jpeg: { viewShot: 'jpg', mimeType: 'image/jpeg', uti: 'public.jpeg', extension: 'jpg' },
};

export function describeFormat(format: ExportFormat): FormatDescriptor {
  return format === 'jpeg' ? MOBILE_FORMATS.jpeg : MOBILE_FORMATS.png;
}

/**
 * Rasterises the offscreen collage view.
 *
 * The view is laid out in density independent points at `canvasPixels / pixelRatio`,
 * so the captured bitmap lands exactly on the requested export resolution on
 * both platforms without any resampling.
 */
export async function renderCollage(
  ref: RefObject<View | null>,
  format: ExportFormat,
  quality = 0.92,
): Promise<string> {
  const target = ref.current;
  if (!target) {
    throw new Error('The collage is not ready yet. Try again in a moment.');
  }

  const descriptor = describeFormat(format);
  return captureRef(target, {
    format: descriptor.viewShot,
    quality,
    result: 'tmpfile',
    // renderInContext is the only iOS strategy that can rasterise views larger
    // than the screen, which is exactly what the offscreen export canvas is.
    useRenderInContext: Platform.OS === 'ios',
  });
}

export async function saveToLibrary(uri: string): Promise<void> {
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) {
    throw new Error('Allow photo library access to save your collage.');
  }
  await Asset.create(uri);
}

export async function shareCollage(uri: string, format: ExportFormat): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  const descriptor = describeFormat(format);
  await Sharing.shareAsync(uri, {
    mimeType: descriptor.mimeType,
    UTI: descriptor.uti,
    dialogTitle: 'Share your collage',
  });
}
