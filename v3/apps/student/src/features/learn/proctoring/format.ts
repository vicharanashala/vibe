import type { Readiness } from './readiness';

const MB = 1024 * 1024;

export function formatMb(bytes: number): string {
  return (bytes / MB).toFixed(1);
}

/** "1.0 of 4.0 MB" when the size is known, "1.0 MB" when it isn't. */
export function progressText({ received, total }: Pick<Readiness, 'received' | 'total'>): string {
  return total ? `${formatMb(received)} of ${formatMb(total)} MB` : `${formatMb(received)} MB`;
}

/** Whole percent from bytes actually received, or null when the size isn't known. */
export function progressPercent({ received, total }: Pick<Readiness, 'received' | 'total'>): number | null {
  if (!total) return null;
  return Math.min(100, Math.floor((received / total) * 100));
}
