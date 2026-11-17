/** Formatting shared by the Overview's insights. */

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function count(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

/** 0–1 → "35%". */
export function percent(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

/** Hours with one decimal below 10 ("2.5 h"), whole hours above ("1,240 h"). */
export function hours(h: number) {
  const rounded = h < 10 ? Math.round(h * 10) / 10 : Math.round(h);
  return `${rounded.toLocaleString()} h`;
}

/** A span in days: "under a day", "1 day", "4 days". */
export function days(d: number) {
  if (d < 1) return 'under a day';
  const n = Math.round(d);
  return `${n.toLocaleString()} ${n === 1 ? 'day' : 'days'}`;
}

/** Seconds into a video as m:ss ("4:10"), or h:mm:ss past an hour. */
export function timestamp(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "just now", "6 minutes ago", "2 hours ago", "3 days ago". */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${count(minutes, 'minute')} ago`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${count(h, 'hour')} ago`;
  return `${count(Math.floor(h / 24), 'day')} ago`;
}

/** "2026-11-17" (an IST calendar day) → "17 Nov". */
export function shortDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** "2026-11-17" → "Tue, 17 Nov 2026". */
export function longDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function hourLabel(h: number) {
  return `${String(h).padStart(2, '0')}:00`;
}
