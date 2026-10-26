/**
 * 404 fallback. Keeps the dark canvas and offers a single, obvious way home.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MorphPressable } from '@/morph/MorphPressable';
import { color, font, radius, space, type } from '@/core/tokens';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.code}>404</Text>
        <Text style={styles.title}>This surface never morphed</Text>
        <Text style={styles.body}>The route you followed does not exist in this build.</Text>
        <MorphPressable
          accessibilityLabel="Return home"
          onPress={() => router.replace('/')}
          style={styles.button}
          restRadius={radius.pill}
          pressedRadius={radius.pill}
        >
          <Text style={styles.buttonLabel}>Back to MorphLens</Text>
        </MorphPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg[0] },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[6],
    gap: space[3],
  },
  code: { color: color.accent.graphite, fontFamily: font.mono, ...type.mono },
  title: { color: color.text.primary, fontFamily: font.title, ...type.title, textAlign: 'center' },
  body: {
    color: color.text.secondary,
    fontFamily: font.body,
    ...type.body,
    textAlign: 'center',
  },
  button: {
    marginTop: space[4],
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    backgroundColor: color.accent.ink,
  },
  buttonLabel: { color: color.text.onAccent, fontFamily: font.headline, ...type.headline },
});
