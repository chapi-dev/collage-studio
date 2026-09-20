import { forwardRef } from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, Path } from 'react-native-svg';
import {
  computeCoverLayout,
  toSvgPath,
  type CollageFrame,
  type CollagePlan,
  type Point,
} from '@collage/core';
import type { MobilePhoto } from '../state/store';

interface CollageCanvasProps {
  plan: CollagePlan;
  photos: MobilePhoto[];
}

/** Places a frame's footprint and applies its tilt, so children use local coordinates. */
function frameWrapperStyle(frame: CollageFrame): ViewStyle {
  return {
    position: 'absolute',
    left: frame.outer.x,
    top: frame.outer.y,
    width: frame.outer.width,
    height: frame.outer.height,
    transform: frame.rotation ? [{ rotate: `${(frame.rotation * 180) / Math.PI}deg` }] : undefined,
  };
}

function toLocal(points: Point[], frame: CollageFrame): Point[] {
  return points.map((point) => ({ x: point.x - frame.outer.x, y: point.y - frame.outer.y }));
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
  const { style } = plan;
  const shadow = style.shadow;

  const shadowStyle: ViewStyle | null =
    shadow > 0
      ? {
          shadowColor: '#000000',
          shadowOpacity: 0.45 * shadow,
          shadowRadius: Math.max(1, shortEdge * 0.02 * shadow),
          shadowOffset: { width: 0, height: Math.max(1, shortEdge * 0.008 * shadow) },
          elevation: Math.round(12 * shadow),
        }
      : null;

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
          backgroundColor: style.background,
        },
      ]}
    >
      {plan.frames.map((frame) => {
        const photo = photos[frame.index];
        const localRect = {
          x: frame.rect.x - frame.outer.x,
          y: frame.rect.y - frame.outer.y,
          width: frame.rect.width,
          height: frame.rect.height,
        };

        const cover = photo
          ? computeCoverLayout(
              { width: photo.width, height: photo.height },
              { width: frame.rect.width, height: frame.rect.height },
              photo.transform,
            )
          : null;

        if (style.frameStyle === 'torn' && frame.paper && frame.opening) {
          const clipId = `opening-${frame.index}`;
          const paperPath = toSvgPath(toLocal(frame.paper, frame));
          const openingPath = toSvgPath(toLocal(frame.opening, frame));
          const drop = Math.max(1, shortEdge * 0.006 * shadow);

          return (
            <View key={`frame-${frame.index}`} style={frameWrapperStyle(frame)}>
              <Svg width={frame.outer.width} height={frame.outer.height}>
                <Defs>
                  <ClipPath id={clipId}>
                    <Path d={openingPath} />
                  </ClipPath>
                </Defs>
                {shadow > 0 ? (
                  <Path d={paperPath} fill="#000000" opacity={0.28 * shadow} y={drop} />
                ) : null}
                <Path d={paperPath} fill={style.paperColor} />
                {photo && cover ? (
                  <SvgImage
                    href={{ uri: photo.uri }}
                    x={localRect.x + (localRect.width - cover.width) / 2 + cover.translateX}
                    y={localRect.y + (localRect.height - cover.height) / 2 + cover.translateY}
                    width={cover.width}
                    height={cover.height}
                    preserveAspectRatio="none"
                    clipPath={`url(#${clipId})`}
                  />
                ) : (
                  <Path d={openingPath} fill="rgba(120,124,138,0.22)" />
                )}
              </Svg>
            </View>
          );
        }

        const paperCard =
          style.frameStyle === 'polaroid'
            ? {
                position: 'absolute' as const,
                left: 0,
                top: 0,
                width: frame.outer.width,
                height: frame.outer.height,
                borderRadius: frame.radius,
                backgroundColor: style.paperColor,
              }
            : null;

        return (
          <View key={`frame-${frame.index}`} style={frameWrapperStyle(frame)}>
            {paperCard ? <View style={[paperCard, shadowStyle]} /> : null}
            <View
              style={[
                styles.clip,
                {
                  position: 'absolute',
                  left: localRect.x,
                  top: localRect.y,
                  width: localRect.width,
                  height: localRect.height,
                  borderRadius: frame.radius,
                  borderWidth: style.frameStyle === 'clean' ? plan.borderWidth : 0,
                  borderColor: style.borderColor,
                },
                paperCard ? null : shadowStyle,
                photo ? null : styles.empty,
              ]}
            >
              {photo && cover ? (
                <Image
                  source={{ uri: photo.uri }}
                  fadeDuration={0}
                  resizeMode="cover"
                  style={{
                    position: 'absolute',
                    width: cover.width,
                    height: cover.height,
                    left: (localRect.width - cover.width) / 2 + cover.translateX,
                    top: (localRect.height - cover.height) / 2 + cover.translateY,
                  }}
                />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  canvas: { overflow: 'hidden' },
  clip: { overflow: 'hidden', backgroundColor: '#000000' },
  empty: { backgroundColor: 'rgba(255,255,255,0.06)' },
});
