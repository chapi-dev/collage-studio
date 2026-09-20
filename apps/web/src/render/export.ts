import type { CollagePlan, ExportFormat } from '@collage/core';
import { drawCollage, type RenderPhoto } from './canvas';

const MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  png: 'PNG · lossless',
  jpeg: 'JPEG · smallest',
  webp: 'WebP · balanced',
};

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`The browser could not encode the image as ${type}.`));
      },
      type,
      quality,
    );
  });
}

/** Renders the collage at full resolution and encodes it. */
export async function renderCollageBlob(
  plan: CollagePlan,
  photos: Array<RenderPhoto | undefined>,
  format: ExportFormat,
  quality = 0.92,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = plan.canvas.width;
  canvas.height = plan.canvas.height;

  const ctx = canvas.getContext('2d', { alpha: format === 'png' });
  if (!ctx) throw new Error('This browser does not support 2D canvas rendering.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawCollage(ctx, plan, photos, { placeholders: false, highlight: null });

  try {
    return await toBlob(canvas, MIME[format], format === 'png' ? undefined : quality);
  } catch (error) {
    if (format === 'webp') {
      return toBlob(canvas, MIME.jpeg, quality);
    }
    throw error;
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function extensionFor(format: ExportFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
