import { ScrollView, StyleSheet, View } from 'react-native';
import { BACKGROUND_SWATCHES, STYLE_PRESETS } from '@collage/core';
import { useStudio } from '../state/store';
import { Chip, SectionLabel, Stepper, Swatch } from './ui';
import { spacing } from '../theme';

const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;

export function StylePanel() {
  const style = useStudio((state) => state.style);
  const stylePresetId = useStudio((state) => state.stylePresetId);
  const applyStylePreset = useStudio((state) => state.applyStylePreset);
  const patchStyle = useStudio((state) => state.patchStyle);

  return (
    <View>
      <SectionLabel>Look</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {STYLE_PRESETS.map((preset) => (
          <Chip
            key={preset.id}
            label={preset.label}
            active={preset.id === stylePresetId}
            onPress={() => applyStylePreset(preset.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.spacer} />
      <SectionLabel>Spacing</SectionLabel>
      <Stepper
        label="Gutter"
        value={style.gutter}
        display={percent(style.gutter)}
        min={0}
        max={0.12}
        step={0.005}
        onChange={(gutter) => patchStyle({ gutter })}
      />
      <Stepper
        label="Outer margin"
        value={style.padding}
        display={percent(style.padding)}
        min={0}
        max={0.12}
        step={0.005}
        onChange={(padding) => patchStyle({ padding })}
      />
      <Stepper
        label="Corner radius"
        value={style.cornerRadius}
        display={percent(style.cornerRadius)}
        min={0}
        max={0.5}
        step={0.01}
        onChange={(cornerRadius) => patchStyle({ cornerRadius })}
      />
      <Stepper
        label="Shadow"
        value={style.shadow}
        display={percent(style.shadow)}
        min={0}
        max={1}
        step={0.05}
        onChange={(shadow) => patchStyle({ shadow })}
      />
      <Stepper
        label="Cell border"
        value={style.borderWidth}
        display={percent(style.borderWidth)}
        min={0}
        max={0.02}
        step={0.001}
        onChange={(borderWidth) => patchStyle({ borderWidth })}
      />

      <SectionLabel>Background</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {BACKGROUND_SWATCHES.map((color) => (
          <Swatch
            key={color}
            color={color}
            active={color.toLowerCase() === style.background.toLowerCase()}
            onPress={() => patchStyle({ background: color })}
          />
        ))}
      </ScrollView>

      {style.borderWidth > 0 ? (
        <View style={styles.spacer}>
          <SectionLabel>Border colour</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {BACKGROUND_SWATCHES.map((color) => (
              <Swatch
                key={`border-${color}`}
                color={color}
                active={color.toLowerCase() === style.borderColor.toLowerCase()}
                onPress={() => patchStyle({ borderColor: color })}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  spacer: { marginTop: spacing.md },
});
