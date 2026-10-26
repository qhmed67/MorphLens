/**
 * PhotoChooser — the in-widget photo picker for the Algorithm Theatres
 * (owner revision 2026-10-20: "when I go in it, I should choose a photo").
 *
 * A compact trigger shows the active photo's thumb + provenance; the sheet
 * lists every photo in the session (newest first) and can import a new one
 * without leaving the theatre. Selecting a photo only reports its id — the
 * screen owns the selection so its engine pipeline can reset deliberately.
 */
import { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown, ImagePlus } from 'lucide-react-native';
import { MorphPressable } from '@/morph/MorphPressable';
import { MorphSheet } from '@/morph/MorphSheet';
import { color, font, radius, space, type } from '@/core/tokens';
import { pickAndPreparePhoto } from '@/library/import';
import { usePhotoStore } from '@/library/photoStore';

type Props = {
  /** Currently displayed photo id; null while the synthetic scene is shown. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Provenance text inside the trigger, e.g. 'Photo · 512×512 proxy'. */
  caption?: string;
  testID?: string;
};

export function PhotoChooser({ selectedId, onSelect, caption, testID }: Props) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const photos = usePhotoStore((state) => state.photos);
  const order = usePhotoStore((state) => state.order);
  const add = usePhotoStore((state) => state.add);
  const selected = selectedId ? photos[selectedId] : undefined;

  const choose = useCallback(
    (id: string) => {
      onSelect(id);
      setOpen(false);
    },
    [onSelect],
  );

  const importPhoto = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    try {
      const photo = await pickAndPreparePhoto();
      if (photo) {
        add(photo);
        choose(photo.id);
      }
    } catch (error: unknown) {
      Alert.alert('Import failed', error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  }, [add, choose, importing]);

  return (
    <>
      <MorphPressable
        accessibilityLabel="Choose the photo this theatre explains"
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        restRadius={radius.pill}
        pressedRadius={radius.pill}
        style={styles.trigger}
        testID={testID}
      >
        {selected ? (
          <Image source={{ uri: selected.thumbUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <ImagePlus color={color.text.secondary} size={12} strokeWidth={1.75} />
          </View>
        )}
        <Text numberOfLines={1} style={styles.triggerLabel}>
          {caption ?? (selected ? 'Chosen photo' : 'Choose a photo')}
        </Text>
        <ChevronDown color={color.text.tertiary} size={14} strokeWidth={1.75} />
      </MorphPressable>

      <MorphSheet onClose={() => setOpen(false)} title="Choose a photo" visible={open}>
        <Text style={styles.hint}>
          Every theatre runs on the photo you pick here — including photos you have edited.
        </Text>

        {order.length > 0 ? (
          <ScrollView
            contentContainerStyle={styles.rail}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {order.map((id, index) => {
              const photo = photos[id];
              if (!photo) return null;
              const active = id === selectedId;
              return (
                <MorphPressable
                  key={id}
                  accessibilityLabel={`Use photo ${index + 1}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => choose(id)}
                  restRadius={radius.md}
                  pressedRadius={radius.lg}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <Image source={{ uri: photo.thumbUri }} style={styles.optionImage} />
                  {active ? (
                    <View style={styles.badge}>
                      <Check color={color.text.onAccent} size={12} strokeWidth={2.5} />
                    </View>
                  ) : null}
                </MorphPressable>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.empty}>No photos yet — import one to explain it.</Text>
        )}

        <MorphPressable
          accessibilityLabel="Import a photo from the library"
          disabled={importing}
          onPress={() => void importPhoto()}
          restRadius={radius.md}
          pressedRadius={radius.lg}
          style={[styles.importRow, importing && styles.importing]}
        >
          <View style={styles.importIcon}>
            <ImagePlus color={color.text.primary} size={16} strokeWidth={1.75} />
          </View>
          <Text style={styles.importLabel}>
            {importing ? 'Importing…' : 'Import a photo from the library'}
          </Text>
        </MorphPressable>
      </MorphSheet>
    </>
  );
}

const THUMB = 22;

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    alignSelf: 'flex-start',
    maxWidth: '100%',
    height: 30,
    paddingLeft: space[1],
    paddingRight: space[3],
    borderRadius: radius.pill,
    backgroundColor: color.bg[1],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.strokeStrong,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    backgroundColor: color.bg[2],
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  triggerLabel: {
    flexShrink: 1,
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.secondary,
  },
  hint: {
    fontFamily: font.body,
    ...type.caption,
    color: color.text.secondary,
    marginBottom: space[4],
  },
  rail: { gap: space[2], paddingRight: space[4] },
  option: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: color.stroke,
    backgroundColor: color.bg[2],
  },
  optionActive: { borderColor: color.accent.ink, borderWidth: 2, padding: 2 },
  optionImage: { width: '100%', height: '100%', borderRadius: radius.sm },
  badge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accent.ink,
  },
  empty: {
    fontFamily: font.body,
    ...type.body,
    color: color.text.tertiary,
    paddingVertical: space[5],
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginTop: space[4],
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: color.bg[2],
  },
  importing: { opacity: 0.6 },
  importIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: color.bg[1],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.strokeStrong,
  },
  importLabel: { fontFamily: font.headline, ...type.body, color: color.text.primary },
});
