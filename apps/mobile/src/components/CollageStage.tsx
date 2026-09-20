import { useMemo, useRef, type RefObject } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { computeCoverLayout, hitTest, type CollagePlan } from '@collage/core';
import { CollageCanvas } from './CollageCanvas';
import { useStudio, type MobilePhoto } from '../state/store';
import { colors, radius } from '../theme';

interface CollageStageProps {
  plan: CollagePlan;
  photos: MobilePhoto[];
  box: { width: number; height: number };
  canvasRef: RefObject<View | null>;
  selected: number | null;
}

/**
 * Interactive preview.
 *
 * The collage is laid out at full export size (in points) and merely *displayed*
 * scaled down. A view's own transform is ignored when it is rasterised, so the
 * capture keeps the full resolution while the user sees a screen sized preview.
 * All selection chrome lives in a sibling overlay and therefore never leaks into
 * the exported image.
 */
export function CollageStage({ plan, photos, box, canvasRef, selected }: CollageStageProps) {
  const scale = Math.min(box.width / plan.canvas.width, box.height / plan.canvas.height);
  const displayWidth = plan.canvas.width * scale;
  const displayHeight = plan.canvas.height * scale;

  const context = useRef({ plan, scale });
  context.current = { plan, scale };

  const drag = useRef({ index: -1, slackX: 0, slackY: 0, startX: 0, startY: 0 });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
        onPanResponderGrant: (event) => {
          const { plan: currentPlan, scale: currentScale } = context.current;
          const x = event.nativeEvent.locationX / currentScale;
          const y = event.nativeEvent.locationY / currentScale;
          const index = hitTest(currentPlan.frames, x, y);
          drag.current.index = index;

          const store = useStudio.getState();
          if (index < 0) {
            store.select(null);
            return;
          }
          store.select(index);

          const photo = store.photos[index];
          const frame = currentPlan.frames[index];
          if (!photo || !frame) {
            drag.current.index = -1;
            return;
          }

          const cover = computeCoverLayout(
            { width: photo.width, height: photo.height },
            { width: frame.rect.width, height: frame.rect.height },
            photo.transform,
          );
          drag.current.slackX = (cover.width - frame.rect.width) / 2;
          drag.current.slackY = (cover.height - frame.rect.height) / 2;
          drag.current.startX = photo.transform.offsetX;
          drag.current.startY = photo.transform.offsetY;
        },
        onPanResponderMove: (_event, gesture) => {
          const { index, slackX, slackY, startX, startY } = drag.current;
          if (index < 0) return;
          const { scale: currentScale } = context.current;
          const offsetX = slackX > 0.5 ? startX - gesture.dx / currentScale / slackX : startX;
          const offsetY = slackY > 0.5 ? startY - gesture.dy / currentScale / slackY : startY;
          useStudio.getState().patchTransform(index, { offsetX, offsetY });
        },
        onPanResponderRelease: () => {
          drag.current.index = -1;
        },
        onPanResponderTerminate: () => {
          drag.current.index = -1;
        },
      }),
    [],
  );

  const selectedFrame = selected != null ? plan.frames[selected] : undefined;

  return (
    <View style={[styles.frame, { width: displayWidth, height: displayHeight }]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: plan.canvas.width,
          height: plan.canvas.height,
          transform: [{ scale }],
          transformOrigin: 'top left',
        }}
      >
        <CollageCanvas ref={canvasRef} plan={plan} photos={photos} />
      </View>

      <View style={StyleSheet.absoluteFill} {...responder.panHandlers}>
        {selectedFrame ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: selectedFrame.rect.x * scale,
              top: selectedFrame.rect.y * scale,
              width: selectedFrame.rect.width * scale,
              height: selectedFrame.rect.height * scale,
              borderRadius: selectedFrame.radius * scale,
              borderWidth: 2,
              borderColor: colors.accent,
            }}
          />
        ) : null}
      </View>

      {photos.length === 0 ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.empty]}>
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptyHint}>Tap “Add photos” to start your collage</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptyHint: { color: colors.muted, fontSize: 13, marginTop: 6, textAlign: 'center' },
});
