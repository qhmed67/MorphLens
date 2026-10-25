/**
 * Root layout: fonts, gesture root, safe area, root overlay host, router stack.
 *
 * Fonts are free Google Fonts (OFL): Space Grotesk (display/title), Inter
 * (body), JetBrains Mono (numeric HUD). Splash is hidden only after fonts load
 * so text never flashes in a fallback face.
 */
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Import specific weights, not the package index: the index re-exports every
// weight, which would bundle ~40 unused TTFs (verified in the first export).
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { color } from '@/core/tokens';
import { OverlayProvider } from '@/morph/OverlayHost';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Native splash may already be hidden during fast refresh; safe to ignore.
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <OverlayProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: color.bg[0] },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="editor/[id]" options={{ animation: 'none' }} />
            <Stack.Screen name="explain/[op]" options={{ animation: 'fade' }} />
          </Stack>
        </OverlayProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
