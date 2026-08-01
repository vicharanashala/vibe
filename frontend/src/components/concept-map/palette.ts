/**
 * Fixed categorical order (validated for colorblind + contrast safety) —
 * assigned by node position, never randomized. Beyond 8 nodes the order
 * wraps; the concept-map node cap (25) makes that an acceptable tradeoff
 * for a wayfinding diagram rather than an analytical chart.
 */
const CATEGORY_COLORS: readonly { light: string; dark: string }[] = [
  { light: '#2a78d6', dark: '#3987e5' }, // blue
  { light: '#008300', dark: '#008300' }, // green
  { light: '#e87ba4', dark: '#d55181' }, // magenta
  { light: '#eda100', dark: '#c98500' }, // yellow
  { light: '#1baf7a', dark: '#199e70' }, // aqua
  { light: '#eb6834', dark: '#d95926' }, // orange
  { light: '#4a3aa7', dark: '#9085e9' }, // violet
  { light: '#e34948', dark: '#e66767' }, // red
];

export function categoryColor(index: number, isDark: boolean): string {
  const c = CATEGORY_COLORS[((index % CATEGORY_COLORS.length) + CATEGORY_COLORS.length) % CATEGORY_COLORS.length];
  return isDark ? c.dark : c.light;
}

/**
 * A "kind of hand-written" look for concept text — legible print-style
 * handwriting fonts already shipped with major OSes, so no web-font fetch is
 * needed. Falls back to the browser's generic cursive, then sans-serif.
 */
export const HAND_FONT =
  "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive, sans-serif";
