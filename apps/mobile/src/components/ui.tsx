import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Chip({
  label,
  caption,
  active,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  caption?: string;
  active?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
      {caption ? (
        <Text style={[styles.chipCaption, active && styles.chipCaptionActive]} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function IconButton({
  glyph,
  onPress,
  disabled,
  tone = 'neutral',
  accessibilityLabel,
}: {
  glyph: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && styles.chipPressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.iconGlyph, tone === 'danger' && { color: colors.danger }]}>{glyph}</Text>
    </Pressable>
  );
}

export function ActionButton({
  label,
  onPress,
  variant = 'secondary',
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        isPrimary ? styles.actionPrimary : styles.actionSecondary,
        pressed && styles.chipPressed,
        (disabled || busy) && styles.disabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={isPrimary ? colors.onAccent : colors.text} size="small" />
      ) : (
        <Text style={[styles.actionLabel, isPrimary && styles.actionLabelPrimary]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Swatch({
  color,
  active,
  onPress,
}: {
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Background ${color}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.swatch, active && styles.swatchActive]}
    >
      <View style={[styles.swatchFill, { backgroundColor: color }]} />
    </Pressable>
  );
}

/** Discrete slider replacement: works without any extra native dependency. */
export function Stepper({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  const clampValue = (next: number) => Math.min(max, Math.max(min, Number(next.toFixed(6))));
  const ratio = max === min ? 0 : (value - min) / (max - min);

  return (
    <View style={styles.stepper}>
      <View style={styles.stepperHeader}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <Text style={styles.stepperValue}>{display}</Text>
      </View>
      <View style={styles.stepperRow}>
        <IconButton
          glyph="−"
          accessibilityLabel={`Decrease ${label}`}
          disabled={value <= min}
          onPress={() => onChange(clampValue(value - step))}
        />
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>
        <IconButton
          glyph="+"
          accessibilityLabel={`Increase ${label}`}
          disabled={value >= max}
          onPress={() => onChange(clampValue(value + step))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    minWidth: 64,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipPressed: { opacity: 0.65 },
  chipLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chipLabelActive: { color: colors.accent },
  chipCaption: { color: colors.muted, fontSize: 10, marginTop: 2 },
  chipCaptionActive: { color: colors.accent, opacity: 0.85 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 20 },
  disabled: { opacity: 0.35 },
  action: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionSecondary: { backgroundColor: colors.surface, borderColor: colors.border },
  actionLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  actionLabelPrimary: { color: colors.onAccent },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
    marginRight: spacing.sm,
  },
  swatchActive: { borderColor: colors.accent },
  swatchFill: { flex: 1, borderRadius: 5, borderWidth: 1, borderColor: colors.border },
  stepper: { marginBottom: spacing.md },
  stepperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  stepperLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  stepperValue: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.pill },
});
