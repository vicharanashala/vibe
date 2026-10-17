/**
 * Stable identity for the video a genAI job ran against.
 *
 * Jobs store whatever URL the instructor pasted, so two records for the same
 * lecture can differ by `www.`, `http` vs `https`, a `&t=90` resume offset, a
 * `?si=` share token or a trailing slash. Anything matching those raw strings
 * — `scripts/backfill-segment-transcripts.cjs` does exactly `jobs.find({url})`
 * — misses jobs that plainly exist, which is what its `noJob` counter has been
 * recording.
 *
 * Normalising to `yt:<videoId>` makes that lookup exact and indexable. The
 * prefix leaves room for uploaded video (`gcs:<assetId>`) once the AI pipeline
 * accepts an assetId; today it only accepts YouTube URLs.
 */

/** A YouTube video id: exactly 11 chars of the URL-safe base64 alphabet. */
const YOUTUBE_ID = /^[\w-]{11}$/;

/**
 * Path-based forms, e.g. `youtu.be/<id>`, `/embed/<id>`, `/shorts/<id>`,
 * `/live/<id>`. The id is the first path segment after the marker.
 */
const PATH_FORMS = ['embed', 'shorts', 'live', 'v'];

/**
 * Reduce a video reference to a stable key, or null when it is not a video
 * this pipeline can identify.
 *
 * Deliberately tolerant of input that is already a bare id, since callers hold
 * URLs from several sources and normalising twice must be a no-op.
 */
export function extractVideoKey(url?: string | null): string | null {
  if (!url) return null;

  const raw = String(url).trim();
  if (!raw) return null;

  // Already-normalised keys pass straight through, so callers can normalise
  // defensively without corrupting a stored value.
  if (raw.startsWith('yt:') && YOUTUBE_ID.test(raw.slice(3))) return raw;

  // A bare id, which is what `getYouTubeId` on the frontend hands back.
  if (YOUTUBE_ID.test(raw)) return `yt:${raw}`;

  // `new URL` needs a scheme; instructors paste `youtube.com/...` without one.
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const segments = parsed.pathname.split('/').filter(Boolean);

  // youtu.be/<id>
  if (host === 'youtu.be') {
    return segments[0] && YOUTUBE_ID.test(segments[0])
      ? `yt:${segments[0]}`
      : null;
  }

  if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtube-nocookie.com') {
    return null;
  }

  // youtube.com/watch?v=<id> — the overwhelmingly common form.
  const queryId = parsed.searchParams.get('v');
  if (queryId && YOUTUBE_ID.test(queryId)) return `yt:${queryId}`;

  // youtube.com/{embed,shorts,live,v}/<id>
  if (segments.length >= 2 && PATH_FORMS.includes(segments[0].toLowerCase())) {
    return YOUTUBE_ID.test(segments[1]) ? `yt:${segments[1]}` : null;
  }

  return null;
}
