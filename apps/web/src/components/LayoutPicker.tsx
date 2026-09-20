import { useMemo } from 'react';
import { getLayouts, getRatio, ratioValue } from '@collage/core';
import { useActiveLayout, useStudio } from '../state/store';
import { Section } from './ui';

const PREVIEW_LONG_EDGE = 72;

export function LayoutPicker() {
  const count = useStudio((state) => state.photos.length);
  const ratioId = useStudio((state) => state.ratioId);
  const setLayout = useStudio((state) => state.setLayout);
  const cycleLayout = useStudio((state) => state.cycleLayout);
  const active = useActiveLayout();

  const ratio = getRatio(ratioId);
  const layouts = useMemo(() => getLayouts(Math.max(1, count)), [count]);

  const value = ratioValue(ratio);
  const previewWidth = value >= 1 ? PREVIEW_LONG_EDGE : PREVIEW_LONG_EDGE * value;
  const previewHeight = value >= 1 ? PREVIEW_LONG_EDGE / value : PREVIEW_LONG_EDGE;

  return (
    <Section
      title="Layout"
      hint={
        count === 0
          ? 'Add photos to unlock more layouts'
          : `${layouts.length} layouts for ${count} photos`
      }
      action={
        <div className="section__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => cycleLayout(-1)}
            disabled={count === 0}
            aria-label="Previous layout"
          >
            ‹
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => cycleLayout(1)}
            disabled={count === 0}
            aria-label="Next layout"
          >
            ›
          </button>
        </div>
      }
    >
      <div className="layouts" role="radiogroup" aria-label="Collage layout">
        {layouts.map((layout) => (
          <button
            key={layout.id}
            type="button"
            role="radio"
            aria-checked={layout.id === active.id}
            className={`layout${layout.id === active.id ? ' layout--active' : ''}`}
            onClick={() => setLayout(layout.id)}
            title={layout.name}
          >
            <svg
              width={previewWidth}
              height={previewHeight}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {layout.cells.map((cell, index) => (
                <rect
                  key={index}
                  x={cell.x * 100 + 1.5}
                  y={cell.y * 100 + 1.5}
                  width={Math.max(0, cell.width * 100 - 3)}
                  height={Math.max(0, cell.height * 100 - 3)}
                  rx={2.5}
                />
              ))}
            </svg>
            <span className="layout__name">{layout.name}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}
