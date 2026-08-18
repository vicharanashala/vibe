import path from 'path';

/**
 * The ONE place the bucket layout is encoded.
 *
 * The transcoding pipeline is owned outside ViBe, and its output naming
 * convention was not documented when this was written. Rather than block on
 * that answer, readiness is resolved by *listing* the asset's stream prefix and
 * picking the master playlist out of whatever is there — which works for any
 * convention. If the layout is later confirmed, collapse `pickMasterPlaylist`
 * to a single deterministic path; nothing outside this file changes.
 */

/**
 * Extensions accepted as a source upload — MP4 only for now.
 *
 * Deliberately narrow: the transcoding pipeline is owned outside this repo and has
 * only been exercised with MP4, so accepting containers we have not seen it handle
 * would produce uploads that land in the bucket and then silently never become
 * playable. Widen this set once a format has actually been verified end to end.
 *
 * The single source of truth for what is allowed — the request validator and the
 * error message both derive from it, so they cannot drift apart.
 */
const ALLOWED_SOURCE_EXTENSIONS = new Set(['.mp4']);

/** Human-readable list for error messages, derived so it stays in step. */
export const ALLOWED_SOURCE_EXTENSION_LIST = [
  ...ALLOWED_SOURCE_EXTENSIONS,
].join(', ');

/**
 * Object key for a raw upload: `uploads/<assetId>/source<ext>`.
 *
 * Flat under a single `uploads/` prefix, keyed by assetId. Not by filename, so two
 * instructors uploading `lecture.mp4` cannot overwrite each other and a path cannot
 * be guessed from a video's title; the assetId also ties the object to exactly one
 * database row.
 *
 * The extension is preserved deliberately — the transcoding trigger is owned
 * outside this repo and may key off it, so dropping it would risk uploads that
 * silently never process.
 *
 * This layout has changed twice and may change again. It costs no migration each
 * time because every later lookup reads the `uploadObjectKey` stored on the asset
 * rather than recomputing it, and `candidateStreamPrefixes` derives its fallbacks
 * from that stored key — so objects written under any previous shape keep
 * resolving. Preserve that property if the layout moves again.
 */
export function buildUploadObjectKey(input: {
  assetId: string;
  originalFileName: string;
}): string {
  const ext = normalizeExtension(input.originalFileName);
  return `uploads/${input.assetId}/source${ext}`;
}

/**
 * The master playlist path for a given upload — the confirmed convention.
 *
 * Verified against real pipeline output (scripts/verify-video-storage.cjs): the
 * Cloud Function uses the *full input object name, extension included* as the
 * output directory, and names the multivariant playlist `manifest.m3u8`:
 *
 *   input   sample.mp4
 *   output  sample.mp4/manifest.m3u8      ← master
 *           sample.mp4/media-hd.m3u8      ← variant
 *           sample.mp4/media-sd.m3u8      ← variant
 *           sample.mp4/manifest.mpd       ← DASH, also produced
 *           sample.mp4/{hd,sd}.mp4        ← progressive, also produced
 *
 * So `uploads/<id>/source.mp4` yields `uploads/<id>/source.mp4/manifest.m3u8`.
 * Checking this one key is a single existence call instead of a bucket listing;
 * `candidateStreamPrefixes` remains the fallback if the pipeline ever changes.
 */
export function expectedMasterPlaylistKey(uploadObjectKey: string): string {
  return `${uploadObjectKey}/manifest.m3u8`;
}

/**
 * Fallback prefixes to search when the expected key is absent, most likely first.
 *
 * Retained deliberately: the transcoding pipeline is owned outside ViBe, so a
 * change to its naming would otherwise turn every upload into a silent FAILED.
 * GCS listing needs a literal prefix (there is no substring search), so we probe
 * an ordered set rather than guessing once.
 *
 * Every candidate contains the assetId, so a probe can never stray into another
 * asset's output.
 */
export function candidateStreamPrefixes(
  assetId: string,
  uploadObjectKey?: string,
): string[] {
  const candidates: string[] = [];

  if (uploadObjectKey) {
    // Derived from the stored upload key rather than a fixed layout, so assets
    // created under an older key shape still resolve after the layout changed.
    const directory = uploadObjectKey.replace(/\/[^/]*$/, '');
    const withoutExtension = uploadObjectKey.replace(/\.[^./]+$/, '');
    candidates.push(
      `${directory}/`, // the asset's own folder
      `${withoutExtension}/`, // nested under the input basename
    );
  }

  // Output flattened to just the asset id.
  candidates.push(`${assetId}/`);

  return [...new Set(candidates)];
}

/** Lowercased extension, validated against the accepted source list. */
export function normalizeExtension(originalFileName: string): string {
  const ext = path.extname(originalFileName || '').toLowerCase();
  if (!ALLOWED_SOURCE_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported video file type "${ext || '(none)'}". Allowed: ${[
        ...ALLOWED_SOURCE_EXTENSIONS,
      ].join(', ')}`,
    );
  }
  return ext;
}

export function isAllowedSourceFileName(originalFileName: string): boolean {
  return ALLOWED_SOURCE_EXTENSIONS.has(
    path.extname(originalFileName || '').toLowerCase(),
  );
}

/** Names a master playlist conventionally uses, most likely first. */
const MASTER_NAME_PREFERENCE = [
  'master',
  'manifest',
  'index',
  'playlist',
  'stream',
];

/**
 * Choose the master playlist from every `.m3u8` found under an asset's prefix.
 *
 * An HLS ladder contains one master plus one variant playlist per rendition, and
 * picking a variant would silently pin every learner to a single bitrate — so
 * this is ranked, not "first match":
 *
 *   1. shallowest path wins (masters sit at the root, variants in subdirs)
 *   2. then a conventional master name (master/manifest/index/…)
 *   3. then shortest key, as a stable tiebreak
 *
 * Returns null when the prefix holds no playlist yet — the normal state while
 * transcoding is still running.
 */
export function pickMasterPlaylist(objectKeys: string[]): string | null {
  const playlists = objectKeys.filter(key => key.toLowerCase().endsWith('.m3u8'));
  if (playlists.length === 0) return null;
  if (playlists.length === 1) return playlists[0];

  const ranked = [...playlists].sort((a, b) => {
    const depthDelta = depthOf(a) - depthOf(b);
    if (depthDelta !== 0) return depthDelta;

    const nameDelta = masterNameRank(a) - masterNameRank(b);
    if (nameDelta !== 0) return nameDelta;

    return a.length - b.length;
  });

  return ranked[0];
}

/**
 * True when the playlist body is a master (an HLS multivariant playlist).
 * Used to confirm the ranked guess before an asset is marked READY, so a
 * layout we did not anticipate fails loudly instead of streaming one rendition.
 */
export function isMasterPlaylistBody(body: string): boolean {
  return body.includes('#EXT-X-STREAM-INF');
}

function depthOf(objectKey: string): number {
  return objectKey.split('/').length;
}

function masterNameRank(objectKey: string): number {
  const base = path.basename(objectKey, '.m3u8').toLowerCase();
  const index = MASTER_NAME_PREFERENCE.indexOf(base);
  return index === -1 ? MASTER_NAME_PREFERENCE.length : index;
}
