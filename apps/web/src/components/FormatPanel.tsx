import { useMemo } from 'react';
import { ASPECT_RATIOS, canvasSizeForQuality, getRatio, QUALITY_PRESETS } from '@collage/core';
import { useStudio } from '../state/store';
import { ChipGroup, Section, type ChipOption } from './ui';

const GROUP_LABEL: Record<string, string> = {
  square: 'Square',
  portrait: 'Portrait',
  landscape: 'Landscape',
};

export function FormatPanel() {
  const ratioId = useStudio((state) => state.ratioId);
  const setRatio = useStudio((state) => state.setRatio);
  const qualityId = useStudio((state) => state.qualityId);
  const setQuality = useStudio((state) => state.setQuality);

  const grouped = useMemo(() => {
    const groups = new Map<string, ChipOption[]>();
    for (const ratio of ASPECT_RATIOS) {
      const list = groups.get(ratio.group) ?? [];
      list.push({
        id: ratio.id,
        label: ratio.shortLabel,
        sublabel: ratio.label,
        title: `${ratio.label} — ${ratio.hint}`,
      });
      groups.set(ratio.group, list);
    }
    return Array.from(groups.entries());
  }, []);

  const size = canvasSizeForQuality(getRatio(ratioId), qualityId);

  return (
    <Section title="Format" hint={`Output ${size.width} × ${size.height} px`}>
      {grouped.map(([group, options]) => (
        <div key={group} className="format__group">
          <span className="format__group-label">{GROUP_LABEL[group] ?? group}</span>
          <ChipGroup
            options={options}
            value={ratioId}
            onChange={setRatio}
            ariaLabel={`${GROUP_LABEL[group] ?? group} aspect ratios`}
          />
        </div>
      ))}

      <div className="format__group">
        <span className="format__group-label">Resolution</span>
        <ChipGroup
          options={QUALITY_PRESETS.map((preset) => ({
            id: preset.id,
            label: preset.label,
            sublabel: `${preset.longEdge} px`,
            title: preset.hint,
          }))}
          value={qualityId}
          onChange={setQuality}
          ariaLabel="Output resolution"
        />
      </div>
    </Section>
  );
}
