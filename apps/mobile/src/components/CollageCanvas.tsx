import { forwardRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { computeCoverLayout, type CollagePlan } from '@collage/core';
import type { MobilePhoto } from '../state/store';

interface CollageCanvasProps {
  plan: CollagePlan;
  photos: MobilePhoto[];
}

/**
 * Pure renderer for a collage plan. It never draws selection chrome so the very
 * same view can be handed to react-native-view-shot for the final export.
 *
 * The plan is expressed in density independent points; the capture happens at
 * the device pixel ratio, which is how the exact export resolution is reached.
 */
export const CollageCanvas = forwardRef<View, CollageCanvasProps>(function CollageCanvas(
  { plan, photos },
  ref,
) {
  const shortEdge = Math.min(plan.canvas.width, plan.canvas.height);
  const shadow = plan.style.shadow;

  return (
    <View
      ref={ref}
      collapsable={false}
      renderToHardwareTextureAndroid={false}
      style={[
        styles.canvas,
        {
          width: plan.canvas.width,
          height: plan.canvas.height,
          backgroundColor: plan.style.background,
        },
      ]}
    >
      {plan.frames.map((frame) => {
        const photo = photos[frame.index];
        const cell = {
          position: 'absolute' as const,
          left: frame.rect.x,
          top: frame.rect.y,
          width: frame.rect.width,
          height: frame.rect.height,
          borderRadius: frame.radius,
        };

        const shadowStyle =
          shadow > 0
            ? {
                shadowColor: '#000000',
                shadowOpacity: 0.45 * shadow,
                shadowRadius: Math.max(1, shortEdge * 0.02 * shadow),
                shadowOffset: { width: 0, height: Math.max(1, shortEdge * 0.008 * shadow) },
                elevation: Math.round(12 * shadow),
              }
            : null;

        if (!photo) {
          return <View key={`empty-${frame.index}`} style={[cell, styles.empty, shadowStyle]} />;
        }

        const cover = computeCoverLayout(
          { width: photo.width, height: photo.height },
          { width: frame.rect.width, height: frame.rect.height },
          photo.transform,
        );

        return (
          <View key={photo.id} style={[cell, shadowStyle]}>
            <View
              style={[
                styles.clip,
                {
                  borderRadius: frame.radius,
                  borderWidth: plan.borderWidth,
                  borderColor: plan.style.borderColor,
                },
              ]}
            >
              <Image
                source={{ uri: photo.uri }}
                fadeDuration={0}
                resizeMode="cover"
                style={{
                  position: 'absolute',
                  width: cover.width,
                  height: cover.height,
                  left: (frame.rect.width - cover.width) / 2 + cover.translateX,
                  top: (frame.rect.height - cover.height) / 2 + cover.translateY,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  canvas: { overflow: 'hidden' },
  clip: { flex: 1, overflow: 'hidden', backgroundColor: '#000000' },
  empty: { backgroundColor: 'rgba(255,255,255,0.06)' },
});
