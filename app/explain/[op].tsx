/**
 * Route: /explain/[op] — "Trace": the loaded operation's maths, staged on the
 * user's photo. Query params other than `op`/`id` are treated as numeric
 * operation overrides (e.g. amount=1.2&radius=1.4), so the trace matches the
 * exact settings the editor used.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, font, space, type } from '@/core/tokens';
import { StageTheatre } from '@/lab/StageTheatre';
import { useLabSource } from '@/lab/useLabSource';
import { usePhotoStore } from '@/library/photoStore';

export default function ExplainRoute() {
  const query = useLocalSearchParams<Record<string, string | string[]>>();
  const opRaw = query.op;
  const opId = (Array.isArray(opRaw) ? opRaw[0] : opRaw) ?? '';
  const idRaw = query.id;
  const photoId = Array.isArray(idRaw) ? idRaw[0] : idRaw;

  // The trace can switch photos inside the theatre (owner revision). The route
  // id seeds the choice; with no id we follow the newest import until the user
  // picks explicitly.
  const latestId = usePhotoStore((state) => state.order[0]);
  const [chosenId, setChosenId] = useState<string | null>(photoId ?? null);
  const activeId = chosenId ?? latestId ?? null;

  const numeric = useMemo(() => {
    const overrides: Record<string, number> = {};
    for (const [key, value] of Object.entries(query)) {
      if (key === 'op' || key === 'id') continue;
      const text = Array.isArray(value) ? value[0] : value;
      const parsed = Number(text);
      if (text !== undefined && text !== '' && Number.isFinite(parsed)) overrides[key] = parsed;
    }
    return overrides;
  }, [query]);

  // 384 px proxy: the Trace builds every stage of the pipeline on the JS
  // thread, and 512 made that visible as a pause on a mid-range phone
  // (owner, 2026-10-21). 384 is still sharper than the screen.
  const source = useLabSource(384, activeId ?? undefined);

  if (!source.buffer) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.text}>Reading pixels…</Text>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <StageTheatre
      onPhotoSelect={setChosenId}
      opId={opId}
      params={numeric}
      selectedPhotoId={activeId}
      source={source.buffer}
      sourceLabel={source.label}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg[0] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] },
  text: { fontFamily: font.body, ...type.body, color: color.text.secondary },
});
