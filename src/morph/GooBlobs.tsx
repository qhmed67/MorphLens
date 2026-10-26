/**
 * GooBlobs — two Skia blobs that merge and split via blur + alpha threshold
 * (design.md §0; SKILL §5.3).
 *
 * Props: width/height, colours, reduced-motion aware. The loop is capped by
 * the device tier later; the gallery uses it as the signature primitive.
 * No dev build required.
 */
import { memo, useEffect, useMemo } from 'react';
import { Blur, Canvas, Circle, ColorMatrix, Group, Paint } from '@shopify/react-native-skia';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { color } from '@/core/tokens';

type Props = {
  width: number;
  height: number;
  colorA?: string;
  colorB?: string;
};

/** Standard goo matrix: push the blurred alpha toward 0/1. */
const GOO = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 20, -9];

export const GooBlobs = memo(function GooBlobs({
  width,
  height,
  colorA = color.accent.graphite,
  colorB = color.accent.mist,
}: Props) {
  const reduced = useReducedMotion();
  const ax = useSharedValue(width * 0.36);
  const ay = useSharedValue(height * 0.45);
  const bx = useSharedValue(width * 0.62);
  const by = useSharedValue(height * 0.55);

  useEffect(() => {
    if (reduced) {
      ax.value = width * 0.36;
      ay.value = height * 0.45;
      bx.value = width * 0.62;
      by.value = height * 0.55;
      return;
    }
    ax.value = withRepeat(
      withTiming(width * 0.64, { duration: 5200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    ay.value = withRepeat(
      withTiming(height * 0.38, { duration: 4300, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    bx.value = withRepeat(
      withTiming(width * 0.34, { duration: 4700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    by.value = withRepeat(
      withTiming(height * 0.64, { duration: 3900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(ax);
      cancelAnimation(ay);
      cancelAnimation(bx);
      cancelAnimation(by);
    };
  }, [reduced, width, height, ax, ay, bx, by]);

  const layer = useMemo(
    () => (
      <Paint>
        <Blur blur={14} />
        <ColorMatrix matrix={GOO} />
      </Paint>
    ),
    [],
  );

  const cxA = useDerivedValue(() => ax.value);
  const cyA = useDerivedValue(() => ay.value);
  const cxB = useDerivedValue(() => bx.value);
  const cyB = useDerivedValue(() => by.value);

  return (
    <Canvas style={{ width, height }}>
      <Group layer={layer}>
        <Circle cx={cxA} cy={cyA} r={30} color={colorA} />
        <Circle cx={cxB} cy={cyB} r={23} color={colorB} />
      </Group>
    </Canvas>
  );
});
