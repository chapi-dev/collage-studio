import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MAX_PHOTOS } from '@collage/core';
import { useStudio } from '../state/store';
import { ActionButton, IconButton, SectionLabel } from './ui';
import { colors, radius, spacing } from '../theme';

interface PhotosPanelProps {
  onAdd: () => void;
  busy?: boolean;
}

export function PhotosPanel({ onAdd, busy }: PhotosPanelProps) {
  const photos = useStudio((state) => state.photos);
  const selected = useStudio((state) => state.selected);
  const select = useStudio((state) => state.select);
  const removePhoto = useStudio((state) => state.removePhoto);
  const movePhoto = useStudio((state) => state.movePhoto);
  const shufflePhotos = useStudio((state) => state.shufflePhotos);
  const clearPhotos = useStudio((state) => state.clearPhotos);

  return (
    <View>
      <SectionLabel>
        Photos · {photos.length}/{MAX_PHOTOS}
      </SectionLabel>

      {photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {photos.map((photo, index) => (
            <View key={photo.id} style={styles.thumbWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Select photo ${index + 1}`}
                accessibilityState={{ selected: selected === index }}
                onPress={() => select(selected === index ? null : index)}
                style={[styles.thumb, selected === index && styles.thumbActive]}
              >
                <Image source={{ uri: photo.uri }} style={styles.thumbImage} resizeMode="cover" />
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{index + 1}</Text>
                </View>
              </Pressable>
              <View style={styles.thumbActions}>
                <IconButton
                  glyph="‹"
                  accessibilityLabel={`Move photo ${index + 1} earlier`}
                  disabled={index === 0}
                  onPress={() => movePhoto(index, index - 1)}
                />
                <IconButton
                  glyph="✕"
                  tone="danger"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  onPress={() => removePhoto(photo.id)}
                />
                <IconButton
                  glyph="›"
                  accessibilityLabel={`Move photo ${index + 1} later`}
                  disabled={index === photos.length - 1}
                  onPress={() => movePhoto(index, index + 1)}
                />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.hint}>
          Pick up to {MAX_PHOTOS} photos. They never leave your device: every collage is rendered
          locally.
        </Text>
      )}

      <View style={styles.row}>
        <ActionButton label="Add photos" variant="primary" onPress={onAdd} busy={busy} />
        <ActionButton
          label="Shuffle"
          onPress={shufflePhotos}
          disabled={photos.length < 2}
          style={styles.spaced}
        />
        <ActionButton
          label="Clear"
          onPress={clearPhotos}
          disabled={photos.length === 0}
          style={styles.spaced}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { paddingBottom: spacing.sm },
  thumbWrap: { marginRight: spacing.md, alignItems: 'center' },
  thumb: {
    width: 78,
    height: 78,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  thumbActive: { borderColor: colors.accent },
  thumbImage: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    left: 4,
    top: 4,
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,8,15,0.75)',
  },
  badgeText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  thumbActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  row: { flexDirection: 'row', marginTop: spacing.md },
  spaced: { marginLeft: spacing.sm },
});
