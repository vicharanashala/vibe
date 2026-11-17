/** IST calendar helpers. All analytics days and hours are in India Standard Time. */
const IST_OFFSET_MS = 330 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

const shifted = (t: Date | number) =>
  new Date((t instanceof Date ? t.getTime() : t) + IST_OFFSET_MS);

/** YYYY-MM-DD of the IST calendar day containing `t`. */
export function istDay(t: Date | number): string {
  return shifted(t).toISOString().slice(0, 10);
}

/** Hour 0–23 in IST. */
export function istHour(t: Date | number): number {
  return shifted(t).getUTCHours();
}

/** Weekday of an IST day string, 0 = Monday … 6 = Sunday. */
export function weekdayOfDay(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** The IST day `n` days before `day`. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  return new Date(d.getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/** Days of the `range`-day window ending on `endDay`, oldest first. */
export function windowDays(endDay: string, range: number): string[] {
  return Array.from({length: range}, (_, i) => addDays(endDay, i - range + 1));
}

/**
 * Splits [start, end) into per-IST-hour pieces: [{day, hour, seconds}].
 */
export function splitByIstHour(
  start: Date,
  end: Date,
): {day: string; hour: number; seconds: number}[] {
  const out: {day: string; hour: number; seconds: number}[] = [];
  let t = start.getTime();
  const stop = end.getTime();
  while (t < stop) {
    const s = shifted(t);
    const hourEnd =
      Date.UTC(
        s.getUTCFullYear(),
        s.getUTCMonth(),
        s.getUTCDate(),
        s.getUTCHours() + 1,
      ) - IST_OFFSET_MS;
    const pieceEnd = Math.min(hourEnd, stop);
    out.push({
      day: istDay(t),
      hour: istHour(t),
      seconds: (pieceEnd - t) / 1000,
    });
    t = pieceEnd;
  }
  return out;
}

/** "HH:MM:SS" or "MM:SS" → seconds. */
export function hmsToSeconds(v: unknown): number | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const parts = v.split(':').map(Number);
  if (parts.some(n => Number.isNaN(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
