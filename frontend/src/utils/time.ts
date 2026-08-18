/**
 * Time formatting and parsing for video timestamps.
 *
 * Timestamps are stored on video items as `(HH:)?MM:SS` strings, but seconds
 * are the only sensible thing to compute with. Everything here converts between
 * the two so the rest of the app can hold seconds and format once, at the edge.
 */

/** Most digits a timestamp field accepts: HHMMSS. */
export const MAX_TIME_DIGITS = 6;

/**
 * Seconds to a display string — `MM:SS`, widening to `H:MM:SS` past an hour.
 *
 * Minutes stay zero-padded because that is the shape already stored on existing
 * items. The hour component is the important part: the previous implementation
 * computed minutes as `(total % 3600) / 60`, so an hour-long lecture trimmed to
 * 1:01:01 was written to the database as "01:01" — a little over a minute. Any
 * video past the hour mark silently lost its hours.
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Seconds to a coarse duration — `2h 15m`, `15m`, `45s`.
 *
 * For totals rather than positions: how long someone watched reads better as
 * "2h 15m" than as the stopwatch shape `formatTime` produces, which invites
 * being misread as a point in the video.
 */
export function formatWatchDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m';

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
}

/**
 * A stored or pasted timestamp to seconds.
 *
 * Accepts `H:MM:SS`, `MM:SS`, and a bare number of seconds. Components are not
 * clamped to 59 — `0:90` means ninety seconds, which is what makes typing raw
 * seconds into a timestamp field work.
 */
export function parseTimeToSeconds(
  value?: string | number | null,
): number {
  if (value === null || value === undefined) return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  const raw = String(value).trim();
  if (!raw) return 0;

  if (!raw.includes(':')) {
    const asNumber = Number(raw);
    return Number.isFinite(asNumber) && asNumber > 0 ? Math.floor(asNumber) : 0;
  }

  const parts = raw.split(':');
  if (parts.length > 3) return 0;

  let total = 0;
  for (const part of parts) {
    const n = Number(part.trim());
    if (!Number.isFinite(n) || n < 0) return 0;
    total = total * 60 + Math.floor(n);
  }
  return total;
}

/**
 * Keep only the digits that matter, newest-last.
 *
 * Leading zeros are dropped so the field does not creep into showing an hours
 * component the teacher never typed, but a lone "0" survives — otherwise
 * pressing 0 as the first keystroke blanks the field.
 */
export function normalizeDigits(input: string): string {
  const digits = String(input ?? '')
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '');
  return digits.slice(-MAX_TIME_DIGITS);
}

/**
 * Digits to the masked display string, filled right to left like a stopwatch:
 * `8` → `00:08`, `840` → `08:40`, `12345` → `01:23:45`.
 *
 * This is what removes the colon from the typing burden — the teacher types
 * only digits, never a separator and never a modifier key.
 */
export function groupDigits(input: string): string {
  const digits = normalizeDigits(input);
  if (!digits) return '';

  if (digits.length <= 4) {
    const padded = digits.padStart(4, '0');
    return `${padded.slice(0, 2)}:${padded.slice(2)}`;
  }

  const padded = digits.padStart(6, '0');
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4)}`;
}

/**
 * Digits to seconds, using the same right-to-left reading as `groupDigits`.
 *
 * Components carry rather than clamp, so `084` is 84 seconds and normalises to
 * 1:24 on commit. That is what lets someone who thinks in raw seconds type
 * `90` and get 1:30 — the two mental models converge instead of one being wrong.
 */
export function digitsToSeconds(input: string): number {
  const digits = normalizeDigits(input);
  if (!digits) return 0;

  const padded = digits.length <= 4 ? digits.padStart(4, '0') : digits.padStart(6, '0');

  if (padded.length === 4) {
    return Number(padded.slice(0, 2)) * 60 + Number(padded.slice(2));
  }
  return (
    Number(padded.slice(0, 2)) * 3600 +
    Number(padded.slice(2, 4)) * 60 +
    Number(padded.slice(4))
  );
}

/**
 * Pull a timestamp out of pasted text.
 *
 * Teachers paste from a lot of places — a YouTube share link with `?t=`, a
 * comment reading `1m30s`, a bare `90`, or a plain `1:30`. Returning null when
 * nothing is recognisable lets the caller fall back to digit entry.
 */
export function parsePastedTime(text: string): number | null {
  const raw = String(text ?? '').trim();
  if (!raw) return null;

  // A YouTube url or query fragment carrying ?t= / &start=
  const urlMatch = raw.match(/[?&](?:t|start)=(\d+)/);
  if (urlMatch) return Number(urlMatch[1]);

  // 1h2m3s / 1m30s / 90s
  const unitMatch = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (unitMatch && (unitMatch[1] || unitMatch[2] || unitMatch[3])) {
    return (
      Number(unitMatch[1] ?? 0) * 3600 +
      Number(unitMatch[2] ?? 0) * 60 +
      Number(unitMatch[3] ?? 0)
    );
  }

  if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(raw)) return parseTimeToSeconds(raw);
  if (/^\d+$/.test(raw)) return Number(raw);

  return null;
}
