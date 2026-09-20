import {
  BACKGROUND_SWATCHES,
  MAX_ZOOM,
  PAPER_SWATCHES,
  STYLE_PRESETS,
  type FrameStyle,
} from '@collage/core';
import { useStudio } from '../state/store';
import { ChipGroup, Section, Slider, Swatches } from './ui';

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const FRAME_STYLES: Array<{ id: FrameStyle; label: string }> = [
  { id: 'torn', label: 'Torn paper' },
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'clean', label: 'Clean' },
];

export function StylePanel() {
  const style = useStudio((state) => state.style);
  const stylePresetId = useStudio((state) => state.stylePresetId);
  const applyStylePreset = useStudio((state) => state.applyStylePreset);
  const patchStyle = useStudio((state) => state.patchStyle);
  const shuffleSeed = useStudio((state) => state.shuffleSeed);

  const expressive = style.frameStyle !== 'clean';

  return (
    <Section
      title="Style"
      hint="Presets, paper and spacing"
      action={
        expressive ? (
          <div className="section__actions">
            <button type="button" className="button button--ghost" onClick={shuffleSeed}>
              Reshuffle
            </button>
          </div>
        ) : undefined
      }
    >
      <ChipGroup
        options={STYLE_PRESETS.map((preset) => ({ id: preset.id, label: preset.label }))}
        value={stylePresetId}
        onChange={applyStylePreset}
        ariaLabel="Style preset"
      />

      <div className="format__group">
        <span className="format__group-label">Frame</span>
        <ChipGroup
          options={FRAME_STYLES}
          value={style.frameStyle}
          onChange={(frameStyle) => patchStyle({ frameStyle: frameStyle as FrameStyle })}
          ariaLabel="Frame style"
        />
      </div>

      {expressive ? (
        <>
          <Slider
            label={style.frameStyle === 'torn' ? 'Tear' : 'Scatter'}
            value={style.scatter}
            min={0}
            max={1}
            step={0.02}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(scatter) => patchStyle({ scatter })}
          />
          <div className="format__group">
            <span className="format__group-label">Paper</span>
            <Swatches
              colors={PAPER_SWATCHES}
              value={style.paperColor}
              onChange={(paperColor) => patchStyle({ paperColor })}
            />
          </div>
        </>
      ) : null}

      <Slider
        label="Spacing"
        value={style.gutter}
        min={0}
        max={0.08}
        step={0.002}
        format={percent}
        onChange={(gutter) => patchStyle({ gutter })}
      />
      <Slider
        label="Margin"
        value={style.padding}
        min={0}
        max={0.12}
        step={0.002}
        format={percent}
        onChange={(padding) => patchStyle({ padding })}
      />
      {style.frameStyle === 'clean' ? (
        <Slider
          label="Corners"
          value={style.cornerRadius}
          min={0}
          max={0.5}
          step={0.005}
          format={percent}
          onChange={(cornerRadius) => patchStyle({ cornerRadius })}
        />
      ) : null}
      <Slider
        label="Shadow"
        value={style.shadow}
        min={0}
        max={1}
        step={0.05}
        format={(value) => (value === 0 ? 'Off' : `${Math.round(value * 100)}%`)}
        onChange={(shadow) => patchStyle({ shadow })}
      />
      {style.frameStyle === 'clean' ? (
        <Slider
          label="Outline"
          value={style.borderWidth}
          min={0}
          max={0.012}
          step={0.0005}
          format={(value) => (value === 0 ? 'Off' : percent(value))}
          onChange={(borderWidth) => patchStyle({ borderWidth })}
        />
      ) : null}

      {style.frameStyle === 'clean' && style.borderWidth > 0 ? (
        <label className="colour-row">
          <span>Outline colour</span>
          <input
            type="color"
            value={style.borderColor}
            onChange={(event) => patchStyle({ borderColor: event.target.value })}
          />
        </label>
      ) : null}

      <div className="format__group">
        <span className="format__group-label">Background</span>
        <Swatches
          colors={BACKGROUND_SWATCHES}
          value={style.background}
          onChange={(background) => patchStyle({ background })}
        />
      </div>
    </Section>
  );
}

export function CellInspector() {
  const selected = useStudio((state) => state.selected);
  const photos = useStudio((state) => state.photos);
  const patchTransform = useStudio((state) => state.patchTransform);
  const resetTransform = useStudio((state) => state.resetTransform);
  const resetAllTransforms = useStudio((state) => state.resetAllTransforms);

  const photo = selected !== null ? photos[selected] : undefined;

  return (
    <Section
      title="Framing"
      hint={
        photo
          ? `${photo.name} · ${photo.width} × ${photo.height}`
          : 'Select a cell in the preview to zoom or reposition it'
      }
      action={
        <div className="section__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={resetAllTransforms}
            disabled={photos.length === 0}
          >
            Reset all
          </button>
        </div>
      }
    >
      <Slider
        label="Zoom"
        value={photo?.transform.zoom ?? 1}
        min={1}
        max={MAX_ZOOM}
        step={0.01}
        disabled={!photo}
        format={(value) => `${value.toFixed(2)}×`}
        onChange={(zoom) => selected !== null && patchTransform(selected, { zoom })}
      />
      <p className="hint">
        Drag inside a cell to reposition, scroll to zoom, double-click to reset. Arrow keys nudge
        the selected photo.
      </p>
      <button
        type="button"
        className="button button--ghost button--block"
        onClick={() => selected !== null && resetTransform(selected)}
        disabled={!photo}
      >
        Reset this photo
      </button>
    </Section>
  );
}
