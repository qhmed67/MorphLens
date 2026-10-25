/**
 * files.ts — app sandbox paths and file helpers (expo-file-system 58 API).
 *
 * Originals, previews and thumbs live under Paths.document so they survive
 * cache eviction. The new File/Directory API is used because the legacy
 * documentDirectory/writeAsStringAsync path is deprecated (PLAN §1.3 C7).
 */
import { Directory, File, Paths } from 'expo-file-system';

/** Ensure a named directory exists under the document root. */
export function ensureDocumentDir(name: string): Directory {
  const dir = new Directory(Paths.document, name);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Copy a temporary picker/manipulator file into a document directory. */
export async function copyIntoDocumentDir(
  sourceUri: string,
  dirName: string,
  fileName: string,
): Promise<File> {
  const dir = ensureDocumentDir(dirName);
  const destination = new File(dir, fileName);
  if (destination.exists) destination.delete();
  const source = new File(sourceUri);
  await source.copy(destination);
  return destination;
}

/** Short, collision-resistant id for a new photo/recipe. */
export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Delete a file if it exists. Used to prune the sandbox when an import is
 * dropped from the session library, so a long session cannot fill the disk.
 */
export function deleteIfExists(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The file may already be gone — pruning is best effort.
  }
}

/** Extract a safe file extension from a URI, defaulting to jpg. */
export function extensionOf(uri: string): string {
  const match = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(uri);
  return (match?.[1] ?? 'jpg').toLowerCase();
}
