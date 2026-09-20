import type { DrawableImage } from '../render/canvas';

export const ACCEPT_ATTRIBUTE = 'image/*';

/** Hard cap on the decoded source, so a 100 MP photo cannot exhaust memory. */
const MAX_SOURCE_EDGE = 6000;

export interface LoadedPhoto {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Object URL used by the thumbnails. Released by `releasePhoto`. */
  previewUrl: string;
  source: DrawableImage;
}

let counter = 0;

function nextId(): string {
  counter += 1;
  const random =
    globalThis.crypto && 'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `photo-${counter}-${random}`;
}

function resizeOptions(width: number, height: number): ImageBitmapOptions {
  const longest = Math.max(width, height);
  if (longest <= MAX_SOURCE_EDGE) return {};
  const scale = MAX_SOURCE_EDGE / longest;
  return {
    resizeWidth: Math.round(width * scale),
    resizeHeight: Math.round(height * scale),
    resizeQuality: 'high',
  };
}

async function decodeWithImageElement(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  if (typeof image.decode === 'function') {
    await image.decode();
  } else {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The image could not be decoded.'));
    });
  }
  return image;
}

export function isSupportedImage(file: File): boolean {
  if (file.type) return file.type.startsWith('image/');
  return /\.(jpe?g|png|webp|avif|gif|bmp|heic|heif)$/i.test(file.name);
}

/**
 * Decodes a file into something the canvas can draw, honouring EXIF
 * orientation and downscaling oversized originals.
 */
export async function loadPhoto(file: File): Promise<LoadedPhoto> {
  if (!isSupportedImage(file)) {
    throw new Error(`"${file.name}" is not an image file.`);
  }

  const previewUrl = URL.createObjectURL(file);

  try {
    if (typeof createImageBitmap === 'function') {
      const probe = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const options = resizeOptions(probe.width, probe.height);
      if (options.resizeWidth) {
        const resized = await createImageBitmap(probe, {
          ...options,
          imageOrientation: 'from-image',
        });
        probe.close();
        return {
          id: nextId(),
          name: file.name,
          width: resized.width,
          height: resized.height,
          previewUrl,
          source: resized,
        };
      }
      return {
        id: nextId(),
        name: file.name,
        width: probe.width,
        height: probe.height,
        previewUrl,
        source: probe,
      };
    }

    const image = await decodeWithImageElement(previewUrl);
    return {
      id: nextId(),
      name: file.name,
      width: image.naturalWidth,
      height: image.naturalHeight,
      previewUrl,
      source: image,
    };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error instanceof Error ? error : new Error(`"${file.name}" could not be read.`);
  }
}

export function releasePhoto(photo: LoadedPhoto): void {
  URL.revokeObjectURL(photo.previewUrl);
  if (typeof ImageBitmap !== 'undefined' && photo.source instanceof ImageBitmap) {
    photo.source.close();
  }
}

/** Extracts image files from a drop or paste event. */
export function filesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = data.files ? Array.from(data.files) : [];
  if (files.length > 0) return files.filter(isSupportedImage);
  return Array.from(data.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null && isSupportedImage(file));
}
