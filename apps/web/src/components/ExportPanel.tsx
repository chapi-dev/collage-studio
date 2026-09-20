import { useState } from 'react';
import {
  canvasSizeForQuality,
  createPlan,
  getQuality,
  getRatio,
  suggestFileName,
  type ExportFormat,
} from '@collage/core';
import { useActiveLayout, useStudio } from '../state/store';
import type { RenderPhoto } from '../render/canvas';
import {
  downloadBlob,
  extensionFor,
  FORMAT_LABELS,
  formatBytes,
  renderCollageBlob,
} from '../render/export';
import { ChipGroup, Section } from './ui';

const FORMATS: ExportFormat[] = ['png', 'jpeg', 'webp'];

export function ExportPanel() {
  const photos = useStudio((state) => state.photos);
  const ratioId = useStudio((state) => state.ratioId);
  const style = useStudio((state) => state.style);
  const qualityId = useStudio((state) => state.qualityId);
  const format = useStudio((state) => state.format);
  const setFormat = useStudio((state) => state.setFormat);
  const setError = useStudio((state) => state.setError);
  const layout = useActiveLayout();

  const [busy, setBusy] = useState(false);
  const [lastSize, setLastSize] = useState<number | null>(null);

  const ratio = getRatio(ratioId);
  const size = canvasSizeForQuality(ratio, qualityId);
  const ready = photos.length > 0;

  const handleExport = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const plan = createPlan({
        ratio,
        template: layout,
        style,
        longEdge: getQuality(qualityId).longEdge,
      });
      const renderPhotos: Array<RenderPhoto | undefined> = plan.frames.map((frame) => {
        const photo = photos[frame.index];
        if (!photo) return undefined;
        return {
          source: photo.source,
          width: photo.width,
          height: photo.height,
          transform: photo.transform,
        };
      });
      const blob = await renderCollageBlob(plan, renderPhotos, format);
      setLastSize(blob.size);
      downloadBlob(blob, `${suggestFileName(ratio.shortLabel)}.${extensionFor(format)}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The collage could not be exported.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Export" hint={`${size.width} × ${size.height} px`}>
      <ChipGroup
        options={FORMATS.map((item) => ({
          id: item,
          label: item.toUpperCase(),
          title: FORMAT_LABELS[item],
        }))}
        value={format}
        onChange={(value) => setFormat(value as ExportFormat)}
        ariaLabel="Export format"
      />

      <button
        type="button"
        className="button button--primary button--block"
        onClick={() => void handleExport()}
        disabled={!ready || busy}
      >
        {busy ? 'Rendering…' : 'Download collage'}
      </button>

      <p className="hint">
        {lastSize !== null
          ? `Last export: ${formatBytes(lastSize)}.`
          : 'Rendered at full resolution on your device. No upload, no watermark.'}
      </p>
    </Section>
  );
}
