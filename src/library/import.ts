/**
 * import.ts — pick a photo and prepare preview proxies (architecture §9.1).
 *
 * Flow: image picker → copy original into the sandbox → resize to a 1080 px
 * preview and a 320 px thumb with expo-image-manipulator (contextual API).
 * Refuses images over 50 MP before doing any expensive work (PLAN §9 Q4).
 * No dev build required (Expo Go compatible).
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { copyIntoDocumentDir, createId, extensionOf } from './files';

export type ImportedPhoto = {
  id: string;
  createdAt: number;
  originalUri: string;
  previewUri: string;
  thumbUri: string;
  width: number;
  height: number;
};

const PREVIEW_EDGE = 1080;
const THUMB_EDGE = 320;
const MAX_PIXELS = 50_000_000;

type Variant = { uri: string; width: number; height: number };

/** Resize + re-encode one variant, then copy it out of the cache. */
async function renderVariant(
  sourceUri: string,
  sourceWidth: number,
  sourceHeight: number,
  maxEdge: number,
  id: string,
  suffix: string,
): Promise<Variant> {
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const context = ImageManipulator.manipulate(sourceUri);
  if (scale < 1) context.resize({ width, height });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: 0.9,
    format: SaveFormat.JPEG,
  });
  const copied = await copyIntoDocumentDir(
    saved.uri,
    suffix === 'thumb' ? 'thumbs' : 'previews',
    `${id}-${suffix}.jpg`,
  );
  return { uri: copied.uri, width, height };
}

/**
 * Launch the system picker and prepare sandboxed original/preview/thumb files.
 *
 * @returns null when the user cancels; throws a friendly Error on failure.
 */
export async function pickAndPreparePhoto(): Promise<ImportedPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required to import a photo.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: false,
    exif: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  if (!asset.width || !asset.height) throw new Error('Could not read the image dimensions.');
  if (asset.width * asset.height > MAX_PIXELS) {
    throw new Error('That image is larger than 50 MP. Please choose a smaller photo.');
  }

  const id = createId();
  const originalName = `${id}.${extensionOf(asset.uri)}`;
  const original = await copyIntoDocumentDir(asset.uri, 'originals', originalName);

  const [preview, thumb] = await Promise.all([
    renderVariant(original.uri, asset.width, asset.height, PREVIEW_EDGE, id, 'preview'),
    renderVariant(original.uri, asset.width, asset.height, THUMB_EDGE, id, 'thumb'),
  ]);

  return {
    id,
    createdAt: Date.now(),
    originalUri: original.uri,
    previewUri: preview.uri,
    thumbUri: thumb.uri,
    width: asset.width,
    height: asset.height,
  };
}
