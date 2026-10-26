/**
 * ToneCurve — five draggable control points that become a tone LUT.
 *
 * The curve is intentionally one-dimensional: input intensity runs left → right
 * and output intensity bottom → top. Dragging a point vertically changes how
 * bright that band becomes; the x positions stay fixed so the editor stays
 * honest about which shadows/midtones/highlights it is changing.
 *
 * Gesture callbacks run on the JS thread (`runOnJS(true)`) because each move
 * produces a new five-number tuple and a new LUT. That work is tiny (256
 * entries), and keeping the curve in React state makes the preview and the
 * numeric readout agree exactly.
 */
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Circle, Path, Rect, Skia } from '@shopify/react-native-skia';
import { color, font, radius, space, type } from '@/core/tokens';
import {
  clampTonePoint,
  TONE_X,
  type TonePoints,
} from '../toneCurve';

type Props = {
  points: TonePoints;
  onChange: (points: TonePoints) => void;
  height?: number;
  testID?: string;
};

const PAD = 12;

function toY(value: number, height: number): number {
  return PAD + (1 - value / 255) * (height - PAD * 2);
}

function curvePath(points: TonePoints, width: number, height: number) {
  const builder = Skia.PathBuilder.Make();
  points.forEach((value, index) => {
    const x = PAD + (TONE_X[index] / 255) * (width - PAD * 2);
    const y = toY(value, height);
    if (index === 0) builder.moveTo(x, y);
    else builder.lineTo(x, y);
  });
  return builder.build();
}

export function ToneCurve({ points, onChange, height = 168, testID }: Props) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);

  const update = useCallback(
    (index: number, y: number) => {
      if (height <= PAD * 2) return;
      const value = clampTonePoint((1 - (y - PAD) / (height - PAD * 2)) * 255);
      if (points[index] === value) return;
      const next = [...points] as [number, number, number, number, number];
      next[index] = value;
      onChange(next);
    },
    [height, onChange, points],
  );

  const updateAt = useCallback(
    (x: number, y: number) => {
      if (width <= PAD * 2) return;
      const fraction = (x - PAD) / (width - PAD * 2);
      const input = Math.min(255, Math.max(0, fraction * 255));
      let index = 0;
      let best = Number.POSITIVE_INFINITY;
      TONE_X.forEach((value, candidate) => {
        const distance = Math.abs(value - input);
        if (distance < best) {
          best = distance;
          index = candidate;
        }
      });
      setActive(index);
      update(index, y);
    },
    [update, width],
  );

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(1)
    .onBegin((event) => {
      updateAt(event.x, event.y);
    })
    .onUpdate((event) => {
      updateAt(event.x, event.y);
    });

  const path = useMemo(
    () => (width > 0 ? curvePath(points, width, height) : null),
    [height, points, width],
  );
  const identity = useMemo(() => {
    if (width <= 0) return null;
    const builder = Skia.PathBuilder.Make();
    builder.moveTo(PAD, toY(0, height));
    builder.lineTo(width - PAD, toY(255, height));
    return builder.build();
  }, [height, width]);

  const selected = points[active] ?? 0;
  const input = TONE_X[active] ?? 0;

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.title}>Tone curve</Text>
        <Text style={styles.readout}>
          IN {input} → OUT {selected}
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={[styles.bed, { height }]}
          accessible
          accessibilityLabel="Tone curve. Drag a point vertically to change output brightness."
          accessibilityRole="adjustable"
        >
          {width > 0 ? (
            <Canvas style={{ width, height }}>
              {[0.25, 0.5, 0.75].map((fraction) => (
                <Rect
                  key={fraction}
                  color={color.stroke}
                  height={1}
                  width={width - PAD * 2}
                  x={PAD}
                  y={PAD + fraction * (height - PAD * 2)}
                />
              ))}
              {TONE_X.map((x) => (
                <Rect
                  key={x}
                  color={color.stroke}
                  height={height - PAD * 2}
                  width={1}
                  x={PAD + (x / 255) * (width - PAD * 2)}
                  y={PAD}
                />
              ))}
              {identity ? (
                <Path color={color.accent.mist} path={identity} strokeWidth={1} style="stroke" />
              ) : null}
              {path ? (
                <Path
                  color={color.accent.ink}
                  path={path}
                  strokeJoin="round"
                  strokeWidth={2.5}
                  style="stroke"
                />
              ) : null}
              {points.map((value, index) => (
                <Circle
                  key={index}
                  color={active === index ? color.accent.ink : color.accent.silver}
                  cx={PAD + (TONE_X[index] / 255) * (width - PAD * 2)}
                  cy={toY(value, height)}
                  r={active === index ? 7 : 5}
                />
              ))}
            </Canvas>
          ) : null}
        </View>
      </GestureDetector>
      <View style={styles.footer}>
        <Text style={styles.hint}>dark → bright</Text>
        <Text style={styles.hint}>drag a point vertically</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontFamily: font.caption, ...type.caption, color: color.text.secondary },
  readout: { fontFamily: font.mono, ...type.mono, color: color.text.primary },
  bed: {
    width: '100%',
    backgroundColor: color.bg[1],
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  hint: { fontFamily: font.caption, ...type.caption, color: color.text.tertiary },
});
