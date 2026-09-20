import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ASPECT_RATIOS,
  QUALITY_PRESETS,
  canvasSizeForQuality,
  getRatio,
  type RatioGroup,
} from '@collage/core';
import { useStudio } from '../state/store';
import { Chip, SectionLabel } from './ui';
import { colors, spacing } from '../theme';

const GROUPS: { id: RatioGroup; label: string }[] = [
  { id: 'square', label: 'Square' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'landscape', label: 'Landscape' },
];

export function FormatPanel() {
  const ratioId = useStudio((state) => state.ratioId);
  const setRatio = useStudio((state) => state.setRatio);
  const qualityId = useStudio((state) => state.qualityId);
  const setQuality = useStudio((state) => state.setQuality);
  const format = useStudio((state) => state.format);
  const setFormat = useStudio((state) => state.setFormat);

  const canvas = canvasSizeForQuality(getRatio(ratioId), qualityId);

  return (
    <View>
      <SectionLabel>Aspect ratio</SectionLabel>
      {GROUPS.map((group) => {
        const ratios = ASPECT_RATIOS.filter((ratio) => ratio.group === group.id);
        if (ratios.length === 0) return null;
        return (
          <View key={group.id} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {ratios.map((ratio) => (
                <Chip
                  key={ratio.id}
                  label={ratio.shortLabel}
                  caption={ratio.label}
                  active={ratio.id === ratioId}
                  accessibilityLabel={`${ratio.label}, ${ratio.shortLabel}. ${ratio.hint}`}
                  onPress={() => setRatio(ratio.id)}
                />
              ))}
            </ScrollView>
          </View>
        );
      })}

      <View style={styles.spacer} />
      <SectionLabel>Export resolution</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {QUALITY_PRESETS.map((preset) => (
          <Chip
            key={preset.id}
            label={preset.label}
            caption={`${preset.longEdge}px`}
            active={preset.id === qualityId}
            accessibilityLabel={`${preset.label}, ${preset.longEdge} pixels. ${preset.hint}`}
            onPress={() => setQuality(preset.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.spacer} />
      <SectionLabel>File format</SectionLabel>
      <View style={styles.row}>
        <Chip
          label="PNG"
          caption="Lossless"
          active={format === 'png'}
          onPress={() => setFormat('png')}
        />
        <Chip
          label="JPEG"
          caption="Smaller file"
          active={format === 'jpeg'}
          onPress={() => setFormat('jpeg')}
        />
      </View>

      <Text style={styles.summary}>
        Output {canvas.width} × {canvas.height} px · {getRatio(ratioId).hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: spacing.md },
  groupLabel: { color: colors.muted, fontSize: 12, marginBottom: spacing.xs },
  row: { flexDirection: 'row' },
  spacer: { height: spacing.md },
  summary: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.md,
    fontVariant: ['tabular-nums'],
  },
});
