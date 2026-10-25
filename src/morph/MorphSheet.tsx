/**
 * MorphSheet — bottom sheet with a drag-to-dismiss handle (SKILL §4).
 *
 * Props: visible, onClose, title, children. Uses a transparent Modal so it can
 * overlay the whole app; the panel springs in from the bottom and the scrim
 * crossfades. Drag down > 90 pt closes. Reduced motion: Modal fade only.
 * No dev build required.
 */
import { memo, useCallback, useEffect, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from '@/core/threads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MorphPressable } from './MorphPressable';
import { spring } from '@/core/motion';
import { color, font, radius, space, type, z } from '@/core/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
};

export const MorphSheet = memo(function MorphSheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);

  const close = useCallback(() => {
    translateY.value = 0;
    onClose();
  }, [onClose, translateY]);

  const pan = Gesture.Pan()
    .onChange((event) => {
      translateY.value = Math.max(0, translateY.value + event.changeY);
    })
    .onEnd(() => {
      if (translateY.value > 90) scheduleOnRN(close);
      else translateY.value = withSpring(0, spring.smooth);
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={[StyleSheet.absoluteFill, { zIndex: z.sheet }]}>
        <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
            style={[StyleSheet.absoluteFill, { backgroundColor: color.overlay }]}
            onPress={close}
          />
        </Animated.View>
        <Animated.View
          entering={reduced ? FadeIn : SlideInDown.springify()}
          exiting={reduced ? FadeOut : SlideOutDown}
          style={[
            styles.panel,
            { paddingBottom: Math.max(space[6], insets.bottom + space[4]) },
            panelStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={styles.handleArea}>
              <View style={styles.handle} />
              {title ? (
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                  <MorphPressable
                    accessibilityLabel="Close sheet"
                    onPress={close}
                    style={styles.close}
                    restRadius={radius.pill}
                    pressedRadius={radius.pill}
                  >
                    <Text style={styles.closeText}>✕</Text>
                  </MorphPressable>
                </View>
              ) : null}
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.bg[1],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.strokeStrong,
    paddingHorizontal: space[5],
    maxHeight: '88%',
  },
  handleArea: {
    paddingTop: space[3],
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.strokeStrong,
    marginBottom: space[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[4],
  },
  title: {
    color: color.text.primary,
    fontFamily: font.title,
    ...type.title,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: color.text.secondary,
    fontSize: 18,
  },
});
