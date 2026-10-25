/**
 * Home — the app has exactly two doors (owner, 2026-10-21):
 *
 *   1. **Edit a photo** → the editor, the only way to edit an image.
 *   2. **Lab mode**   → the algorithm theatre.
 *
 * Nothing else is advertised: no mode counters, no gallery, no session grid.
 * The two actions are centred so the first screen says in one glance what
 * the app can do, and what it cannot. The hero is a live pixel sweep — the
 * app's own idea, not decoration.
 */
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, FlaskConical, ImagePlus } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { MorphPressable } from '@/morph/MorphPressable';
import { MorphSurface } from '@/morph/MorphSurface';
import { pickAndPreparePhoto } from '@/library/import';
import { usePhotoStore } from '@/library/photoStore';
import { color, font, radius, space, type } from '@/core/tokens';
import { Credit } from '@/home/Credit';
import { PixelSweepHero } from '@/home/PixelSweepHero';

/** The four Lab screens, listed as a quiet strip under the Lab card. */
const LAB_SCREENS = ['Convolution', 'Denoise', 'Histogram', 'Enhance'];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const addPhoto = usePhotoStore((state) => state.add);
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const photo = await pickAndPreparePhoto();
      if (!photo) return;
      addPhoto(photo);
      router.push({ pathname: '/editor/[id]', params: { id: photo.id } });
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setImporting(false);
    }
  };

  const heroWidth = Math.min(width - space[5] * 2, 420);
  const heroHeight = Math.round(heroWidth * 0.62);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(700)} style={styles.heroWrap}>
          <PixelSweepHero height={heroHeight} width={heroWidth} testID="home-hero" />
          <View style={styles.heroCaption}>
            <View style={styles.captionLine} />
            <Text style={styles.captionText}>16×16 pixels, one kernel at a time</Text>
            <View style={styles.captionLine} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(120)} style={styles.brand}>
          <Text style={styles.wordmark}>MorphLens</Text>
          <Text style={styles.tagline}>See what the pixels see.</Text>
        </Animated.View>

        <View style={styles.actions}>
          <Animated.View entering={FadeInDown.duration(600).delay(200)}>
            <MorphPressable
              accessibilityLabel="Edit a photo from your library"
              accessibilityRole="button"
              onPress={handleImport}
              disabled={importing}
              style={styles.primary}
              restRadius={radius.pill}
              pressedRadius={radius.pill}
            >
              <ImagePlus size={20} color={color.text.onAccent} strokeWidth={1.75} />
              <Text style={styles.primaryLabel}>
                {importing ? 'Preparing preview…' : 'Edit a photo'}
              </Text>
            </MorphPressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(280)}>
            <MorphPressable
              accessibilityLabel="Open Lab mode"
              accessibilityRole="button"
              onPress={() => router.push('/lab')}
              restRadius={radius.lg}
              pressedRadius={radius.lg}
              style={styles.modePress}
            >
              <MorphSurface level={2} style={styles.modeRow} borderRadius={radius.lg}>
                <View style={styles.modeIcon}>
                  <FlaskConical size={20} color={color.accent.ink} strokeWidth={1.75} />
                </View>
                <View style={styles.modeText}>
                  <Text style={styles.modeTitle}>Lab mode</Text>
                  <Text numberOfLines={1} style={styles.modeBody}>
                    Watch the algorithms work on your own photo
                  </Text>
                </View>
                <ChevronRight size={18} color={color.text.tertiary} strokeWidth={1.75} />
              </MorphSurface>
            </MorphPressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(360)} style={styles.labStrip}>
            {LAB_SCREENS.map((label) => (
              <View key={label} style={styles.labChip}>
                <Text style={styles.labChipText}>{label}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        <Animated.View entering={FadeIn.duration(900).delay(520)}>
          <Credit name="Omar Mohammed" testID="home-credit" />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg[0] },
  content: {
    flexGrow: 1,
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[10],
    justifyContent: 'center',
  },
  // The hero: a live 16×16 pixel sweep with a quiet caption under it.
  heroWrap: { alignItems: 'center', gap: space[2], marginBottom: space[6] },
  heroCaption: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  captionLine: { height: 1, width: 24, backgroundColor: color.strokeStrong },
  captionText: {
    fontFamily: font.mono,
    ...type.mono,
    color: color.text.tertiary,
    letterSpacing: 0.4,
  },
  brand: { alignItems: 'center', marginBottom: space[6] },
  wordmark: {
    color: color.text.primary,
    fontFamily: font.display,
    ...type.display,
  },
  tagline: {
    color: color.text.secondary,
    fontFamily: font.body,
    ...type.body,
    marginTop: space[1],
  },
  // The two doors, centred and equal in weight.
  actions: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: space[3] },
  primary: {
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: color.accent.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  primaryLabel: {
    color: color.text.onAccent,
    fontFamily: font.headline,
    ...type.headline,
  },
  modePress: { borderRadius: radius.lg },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    minHeight: 64,
  },
  modeIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bg[2],
  },
  modeText: { flex: 1, minWidth: 0, gap: 2 },
  modeTitle: {
    color: color.text.primary,
    fontFamily: font.headline,
    ...type.headline,
  },
  modeBody: {
    color: color.text.secondary,
    fontFamily: font.body,
    ...type.caption,
  },
  // A quiet strip naming what is inside the Lab.
  labStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[1] },
  labChip: {
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.strokeStrong,
  },
  labChipText: {
    fontFamily: font.mono,
    ...type.mono,
    fontSize: 10,
    color: color.text.tertiary,
    letterSpacing: 0.4,
  },
});
