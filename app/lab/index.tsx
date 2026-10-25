/**
 * Lab hub — the "Algorithm Theatre" menu (architecture §18.3).
 *
 * It lists the four screens that work and nothing else: the owner asked to
 * drop the placeholders (2026-10-21) so the app never advertises something
 * that is not there.
 */
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, BarChart3, Droplets, LayoutGrid, Sparkles } from 'lucide-react-native';
import { color, font, radius, space, type } from '@/core/tokens';
import { goBack } from '@/core/navigation';
import { MorphPressable } from '@/morph/MorphPressable';
import { MorphSurface } from '@/morph/MorphSurface';
import { PixelSweepHero } from '@/home/PixelSweepHero';

type Tile = {
  href: '/lab/convolution' | '/lab/denoise' | '/lab/histogram' | '/lab/enhance';
  title: string;
  body: string;
  icon: typeof LayoutGrid;
};

const LIVE: Tile[] = [
  {
    href: '/lab/convolution',
    title: 'Convolution Explainer',
    body: 'A glowing kernel slides over magnified pixels — every multiply & sum on screen.',
    icon: LayoutGrid,
  },
  {
    href: '/lab/denoise',
    title: 'Denoise Arena',
    body: 'Inject noise, then mean vs gaussian vs median vs bilateral with live PSNR/SSIM.',
    icon: Droplets,
  },
  {
    href: '/lab/histogram',
    title: 'Histogram Surgery',
    body: 'Live 64-bin histogram + CDF; compare equalize, CLAHE, stretch and your own tone curve.',
    icon: BarChart3,
  },
  {
    href: '/lab/enhance',
    title: 'Enhance Studio',
    body: 'One practical pipeline: white balance → denoise → CLAHE → sharpen, step by step.',
    icon: Sparkles,
  },
];

// The owner asked to drop the locked tiles (2026-10-21): they advertised
// screens we are not going to detail, so the hub now lists what actually
// works and nothing else.

export default function LabIndex() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const heroWidth = Math.min(width - space[4] * 2, 420);
  return (
    <SafeAreaView style={styles.screen}>
      <MorphPressable accessibilityLabel="Back" onPress={() => goBack(router)} style={styles.back}>
        <ArrowLeft size={20} color={color.text.primary} />
      </MorphPressable>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Algorithm Theatre</Text>
        <Text style={styles.subtitle}>
          The image-processing engine, staged: watch each algorithm work on real pixels.
        </Text>

        {/* The same live pixel sweep as the Home, so the Lab opens on the
            idea instead of a wall of text. */}
        <View style={styles.heroWrap}>
          <PixelSweepHero height={Math.round(heroWidth * 0.5)} width={heroWidth} />
        </View>

        {LIVE.map((tile, index) => (
          <MorphPressable
            key={tile.href}
            accessibilityLabel={`Open ${tile.title}`}
            accessibilityRole="button"
            onPress={() => router.push(tile.href)}
          >
            <MorphSurface level={2} style={styles.tile} borderRadius={radius.lg}>
              <View style={styles.tileHead}>
                <tile.icon size={22} color={color.accent.ink} strokeWidth={1.75} />
                <Text style={styles.tileIndex}>{`0${index + 1}`}</Text>
              </View>
              <Text style={styles.tileTitle}>{tile.title}</Text>
              <Text style={styles.tileBody}>{tile.body}</Text>
              <Text style={styles.badgeLive}>LIVE</Text>
            </MorphSurface>
          </MorphPressable>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg[0] },
  back: { padding: space[4] },
  content: { paddingHorizontal: space[4], paddingBottom: space[14], gap: space[3] },
  title: { fontFamily: font.display, ...type.display, color: color.text.primary },
  subtitle: { fontFamily: font.body, ...type.body, color: color.text.secondary },
  heroWrap: { marginTop: space[4], marginBottom: space[2] },
  tile: { padding: space[4], gap: space[2] },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIndex: {
    fontFamily: font.mono,
    ...type.mono,
    fontSize: 11,
    color: color.text.tertiary,
    letterSpacing: 0.6,
  },
  tileTitle: { fontFamily: font.headline, ...type.headline, color: color.text.primary },
  tileBody: { fontFamily: font.body, ...type.body, color: color.text.secondary },
  badgeLive: {
    fontFamily: font.caption,
    ...type.caption,
    color: color.accent.graphite,
    textTransform: 'uppercase',
  },
});
