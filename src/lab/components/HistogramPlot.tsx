/**
 * HistogramPlot — a 64-bin luma histogram with its CDF drawn over the same
 * intensity axis. "Before" is the pale fill, "after" is the ink stroke; the
 * dashed-looking CDF line is the cumulative curve that equalisation actually
 * uses. The plot is intentionally one canvas (no per-bar React views).
 */
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Path, Rect, Skia } from '@shopify/react-native-skia';
import { color } from '@/core/tokens';

type Props = {
  before: Uint32Array;
  after: Uint32Array;
  /** CDF of `before`, normalised to 0..1. */
  cdfBefore?: Float32Array;
  /** CDF of `after`, normalised to 0..1. */
  cdfAfter?: Float32Array;
  height?: number;
  testID?: string;
};

const PAD = 6;
const GRID = 4;

function maxOf(values: Uint32Array): number {
  let max = 0;
  for (let i = 0; i < values.length; i += 1) if (values[i] > max) max = values[i];
  return max;
}

function histogramPath(values: Uint32Array, max: number, width: number, height: number) {
  const builder = Skia.PathBuilder.Make();
  const usable = height - PAD * 2;
  const last = Math.max(1, values.length - 1);
  builder.moveTo(0, height - PAD);
  values.forEach((value, index) => {
    const x = (index / last) * width;
    const y = height - PAD - (max > 0 ? (value / max) * usable : 0);
    builder.lineTo(x, y);
  });
  builder.lineTo(width, height - PAD);
  builder.close();
  return builder.build();
}

function cdfPath(values: Float32Array, width: number, height: number) {
  const builder = Skia.PathBuilder.Make();
  const usable = height - PAD * 2;
  const last = Math.max(1, values.length - 1);
  values.forEach((value, index) => {
    const x = (index / last) * width;
    const y = height - PAD - Math.min(1, Math.max(0, value)) * usable;
    if (index === 0) builder.moveTo(x, y);
    else builder.lineTo(x, y);
  });
  return builder.build();
}

export const HistogramPlot = memo(function HistogramPlot({
  before,
  after,
  cdfBefore,
  cdfAfter,
  height = 132,
  testID,
}: Props) {
  const [width, setWidth] = useState(0);
  const max = useMemo(() => Math.max(maxOf(before), maxOf(after), 1), [before, after]);
  const paths = useMemo(
    () => ({
      before: width > 0 ? histogramPath(before, max, width, height) : null,
      after: width > 0 ? histogramPath(after, max, width, height) : null,
      cdfBefore: width > 0 && cdfBefore ? cdfPath(cdfBefore, width, height) : null,
      cdfAfter: width > 0 && cdfAfter ? cdfPath(cdfAfter, width, height) : null,
    }),
    [after, before, cdfAfter, cdfBefore, height, max, width],
  );

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.bed, { height }]}
      testID={testID}
    >
      {width > 0 ? (
        <Canvas style={{ width, height }}>
          {[1, 2, 3].map((fraction) => (
            <Rect
              key={fraction}
              color={color.stroke}
              height={height - PAD * 2}
              width={1}
              x={(fraction / GRID) * width}
              y={PAD}
            />
          ))}
          <Rect color={color.strokeStrong} height={1} width={width} x={0} y={height - PAD} />
          {paths.before ? <Path color={color.accent.mist} path={paths.before} style="fill" /> : null}
          {paths.after ? (
            <Path color={color.accent.graphite} path={paths.after} opacity={0.28} style="fill" />
          ) : null}
          {paths.after ? (
            <Path
              color={color.accent.ink}
              path={paths.after}
              strokeJoin="round"
              strokeWidth={1.5}
              style="stroke"
            />
          ) : null}
          {paths.cdfBefore ? (
            <Path
              color={color.accent.silver}
              path={paths.cdfBefore}
              strokeWidth={1}
              style="stroke"
            />
          ) : null}
          {paths.cdfAfter ? (
            <Path
              color={color.accent.ink}
              path={paths.cdfAfter}
              strokeWidth={1}
              style="stroke"
            />
          ) : null}
        </Canvas>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  bed: {
    width: '100%',
    backgroundColor: color.bg[1],
    borderRadius: 10,
    overflow: 'hidden',
  },
});
