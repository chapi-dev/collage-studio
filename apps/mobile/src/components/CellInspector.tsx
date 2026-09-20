import { StyleSheet, Text, View } from 'react-native';
import { MAX_ZOOM } from '@collage/core';
import { useStudio } from '../state/store';
import { IconButton, Stepper } from './ui';
import { colors, radius, spacing } from '../theme';

const NUDGE = 0.08;

export function CellInspector() {
  const selected = useStudio((state) => state.selected);
  const photos = useStudio((state) => state.photos);
  const patchTransform = useStudio((state) => state.patchTransform);
  const nudgeTransform = useStudio((state) => state.nudgeTransform);
  const resetTransform = useStudio((state) => state.resetTransform);
  const select = useStudio((state) => state.select);

  if (selected == null) return null;
  const photo = photos[selected];
  if (!photo) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Frame {selected + 1}</Text>
        <View style={styles.headerActions}>
          <IconButton
            glyph="⟲"
            accessibilityLabel="Reset framing"
            onPress={() => resetTransform(selected)}
          />
          <IconButton
            glyph="✕"
            accessibilityLabel="Close frame controls"
            onPress={() => select(null)}
          />
        </View>
      </View>

      <Stepper
        label="Zoom"
        value={photo.transform.zoom}
        display={`${photo.transform.zoom.toFixed(2)}×`}
        min={1}
        max={MAX_ZOOM}
        step={0.1}
        onChange={(zoom) => patchTransform(selected, { zoom })}
      />

      <View style={styles.pad}>
        <IconButton
          glyph="←"
          accessibilityLabel="Nudge left"
          onPress={() => nudgeTransform(selected, -NUDGE, 0)}
        />
        <View style={styles.padColumn}>
          <IconButton
            glyph="↑"
            accessibilityLabel="Nudge up"
            onPress={() => nudgeTransform(selected, 0, -NUDGE)}
          />
          <IconButton
            glyph="↓"
            accessibilityLabel="Nudge down"
            onPress={() => nudgeTransform(selected, 0, NUDGE)}
          />
        </View>
        <IconButton
          glyph="→"
          accessibilityLabel="Nudge right"
          onPress={() => nudgeTransform(selected, NUDGE, 0)}
        />
        <Text style={styles.hint}>Drag the frame in the preview to reposition the photo.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  pad: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  padColumn: { gap: spacing.xs },
  hint: { color: colors.muted, fontSize: 11, flex: 1, lineHeight: 15 },
});
