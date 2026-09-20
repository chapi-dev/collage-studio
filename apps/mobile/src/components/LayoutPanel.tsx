import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getLayouts, getRatio, ratioValue, type LayoutTemplate } from '@collage/core';
import { useStudio } from '../state/store';
import { SectionLabel } from './ui';
import { colors, radius, spacing } from '../theme';

const THUMB_LONG_EDGE = 56;

function LayoutThumb({ template, ratio }: { template: LayoutTemplate; ratio: number }) {
  const width = ratio >= 1 ? THUMB_LONG_EDGE : THUMB_LONG_EDGE * ratio;
  const height = ratio >= 1 ? THUMB_LONG_EDGE / ratio : THUMB_LONG_EDGE;

  return (
    <View style={[styles.thumb, { width, height }]}>
      {template.cells.map((cell, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: cell.x * width + 1,
            top: cell.y * height + 1,
            width: Math.max(2, cell.width * width - 2),
            height: Math.max(2, cell.height * height - 2),
            borderRadius: 2,
            backgroundColor: colors.borderStrong,
          }}
        />
      ))}
    </View>
  );
}

export function LayoutPanel() {
  const count = useStudio((state) => state.photos.length);
  const layoutId = useStudio((state) => state.layoutId);
  const setLayout = useStudio((state) => state.setLayout);
  const ratioId = useStudio((state) => state.ratioId);

  const ratio = ratioValue(getRatio(ratioId));
  const layouts = getLayouts(Math.max(1, count));
  const activeId = layoutId ?? layouts[0]?.id;

  return (
    <View>
      <SectionLabel>Layout</SectionLabel>
      {count === 0 ? (
        <Text style={styles.hint}>Add photos to unlock the layouts made for that many frames.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {layouts.map((template) => {
            const active = template.id === activeId;
            return (
              <Pressable
                key={template.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${template.name} layout`}
                onPress={() => setLayout(template.id)}
                style={({ pressed }) => [
                  styles.card,
                  active && styles.cardActive,
                  pressed && styles.pressed,
                ]}
              >
                <LayoutThumb template={template} ratio={ratio} />
                <Text
                  style={[styles.cardLabel, active && styles.cardLabelActive]}
                  numberOfLines={1}
                >
                  {template.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  card: {
    width: 84,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  cardActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pressed: { opacity: 0.65 },
  thumb: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    marginTop: spacing.sm,
    paddingHorizontal: 4,
  },
  cardLabelActive: { color: colors.accent },
});
